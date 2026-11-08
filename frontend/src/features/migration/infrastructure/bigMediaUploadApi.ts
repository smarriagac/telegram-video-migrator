export interface InitUploadParams {
  filename: string;
  fileSizeBytes: number;
  mimeType?: string;
  targetChannelId: number;
  caption?: string;
  accountId?: number;
  chunkSize?: number;
}

export interface InitUploadResult {
  upload_id: string;
  filename: string;
  file_size_bytes: number;
  chunk_size: number;
  total_chunks: number;
  status: string;
}

export interface ChunkUploadResult {
  upload_id: string;
  chunk_index: number;
  completed_chunks: number[];
  progress_percent: number;
}

export interface UploadStatusResult {
  upload_id: string;
  filename: string;
  file_size_bytes: number;
  chunk_size: number;
  total_chunks: number;
  completed_chunks: number[];
  missing_chunks: number[];
  progress_percent: number;
  status: string;
}

export interface CompleteUploadResult {
  success: boolean;
  upload_id: string;
  message_id: number;
  channel_id: number;
  file_size: number;
  text?: string;
}

export interface UploadProgressInfo {
  percent: number;
  speedMbps: number;
  etaSeconds: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  phase: "IDLE" | "TRANSMITTING" | "TELEGRAM_STITCHING" | "COMPLETED" | "PAUSED" | "ERROR";
  error?: string;
}

const API_BASE = "/api/media/upload";

function getAuthHeaders(isOctetStream: boolean = false): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    ...(isOctetStream ? { "Content-Type": "application/octet-stream" } : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const bigMediaUploadApi = {
  async initUpload(params: InitUploadParams): Promise<InitUploadResult> {
    const res = await fetch(`${API_BASE}/init`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        filename: params.filename,
        file_size_bytes: params.fileSizeBytes,
        mime_type: params.mimeType || "video/mp4",
        target_channel_id: params.targetChannelId,
        caption: params.caption,
        account_id: params.accountId,
        chunk_size: params.chunkSize,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Init upload failed" }));
      throw new Error(err.detail || `Init failed (${res.status})`);
    }
    return res.json();
  },

  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkBlob: Blob,
    signal?: AbortSignal
  ): Promise<ChunkUploadResult> {
    const res = await fetch(`${API_BASE}/${uploadId}/chunk?chunk_index=${chunkIndex}`, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: chunkBlob,
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Chunk upload failed" }));
      throw new Error(err.detail || `Chunk ${chunkIndex} failed (${res.status})`);
    }
    return res.json();
  },

  async getStatus(uploadId: string): Promise<UploadStatusResult> {
    const res = await fetch(`${API_BASE}/${uploadId}/status`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to get status (${res.status})`);
    }
    return res.json();
  },

  async completeUpload(uploadId: string): Promise<CompleteUploadResult> {
    const res = await fetch(`${API_BASE}/${uploadId}/complete`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Complete failed" }));
      throw new Error(err.detail || `Completion failed (${res.status})`);
    }
    return res.json();
  },

  async cancelUpload(uploadId: string): Promise<{ cancelled: boolean }> {
    const res = await fetch(`${API_BASE}/${uploadId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Cancel failed (${res.status})`);
    }
    return res.json();
  },

  /**
   * Orchestrates high-speed chunked uploading with resumability, speed tracking and ETA.
   */
  async uploadFileResumable(
    file: File,
    params: {
      targetChannelId: number;
      caption?: string;
      accountId?: number;
      chunkSize?: number;
      existingUploadId?: string;
    },
    onProgress: (info: UploadProgressInfo) => void,
    signal?: AbortSignal
  ): Promise<CompleteUploadResult> {
    const chunkSize = params.chunkSize || 5 * 1024 * 1024; // 5MB standard chunks
    let uploadId = params.existingUploadId;
    let totalChunks = Math.ceil(file.size / chunkSize);
    let completedSet = new Set<number>();

    // 1. Initialize or resume session
    if (uploadId) {
      try {
        const status = await this.getStatus(uploadId);
        completedSet = new Set(status.completed_chunks);
        totalChunks = status.total_chunks;
      } catch {
        uploadId = undefined;
      }
    }

    if (!uploadId) {
      const initRes = await this.initUpload({
        filename: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || "video/mp4",
        targetChannelId: params.targetChannelId,
        caption: params.caption,
        accountId: params.accountId,
        chunkSize,
      });
      uploadId = initRes.upload_id;
      totalChunks = initRes.total_chunks;
    }

    let uploadedBytes = Array.from(completedSet).length * chunkSize;
    const startTime = performance.now();
    let lastBytes = uploadedBytes;
    let lastTime = startTime;

    onProgress({
      percent: Math.round((completedSet.size / totalChunks) * 100),
      speedMbps: 0,
      etaSeconds: 0,
      uploadedBytes,
      totalBytes: file.size,
      currentChunk: completedSet.size,
      totalChunks,
      phase: "TRANSMITTING",
    });

    // 2. Upload missing chunks sequentially with retry
    for (let i = 0; i < totalChunks; i++) {
      if (completedSet.has(i)) continue;
      if (signal?.aborted) {
        onProgress({
          percent: Math.round((completedSet.size / totalChunks) * 100),
          speedMbps: 0,
          etaSeconds: 0,
          uploadedBytes,
          totalBytes: file.size,
          currentChunk: i,
          totalChunks,
          phase: "PAUSED",
        });
        throw new DOMException("Upload paused by operator", "AbortError");
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunkBlob = file.slice(start, end);

      // Attempt chunk upload with retry
      let attempts = 0;
      let success = false;
      while (!success && attempts < 3) {
        try {
          await this.uploadChunk(uploadId, i, chunkBlob, signal);
          success = true;
          completedSet.add(i);
        } catch (err: any) {
          if (signal?.aborted) throw err;
          attempts++;
          if (attempts >= 3) throw err;
          await new Promise((r) => setTimeout(r, 1000 * attempts));
        }
      }

      uploadedBytes += (end - start);
      const now = performance.now();
      const elapsedSec = (now - lastTime) / 1000;
      let speedMbps = 0;
      if (elapsedSec > 0.3) {
        const bytesDiff = uploadedBytes - lastBytes;
        speedMbps = Number(((bytesDiff * 8) / (elapsedSec * 1024 * 1024)).toFixed(2));
        lastBytes = uploadedBytes;
        lastTime = now;
      }

      const remainingBytes = file.size - uploadedBytes;
      const avgSpeedBytesPerSec = uploadedBytes / ((now - startTime) / 1000 || 1);
      const etaSeconds = avgSpeedBytesPerSec > 0 ? Math.round(remainingBytes / avgSpeedBytesPerSec) : 0;

      onProgress({
        percent: Math.min(100, Math.round((completedSet.size / totalChunks) * 100)),
        speedMbps,
        etaSeconds,
        uploadedBytes: Math.min(uploadedBytes, file.size),
        totalBytes: file.size,
        currentChunk: completedSet.size,
        totalChunks,
        phase: "TRANSMITTING",
      });
    }

    // 3. Finalize assembly and Telegram MTProto transmission
    onProgress({
      percent: 100,
      speedMbps: 0,
      etaSeconds: 0,
      uploadedBytes: file.size,
      totalBytes: file.size,
      currentChunk: totalChunks,
      totalChunks,
      phase: "TELEGRAM_STITCHING",
    });

    const completionResult = await this.completeUpload(uploadId);

    onProgress({
      percent: 100,
      speedMbps: 0,
      etaSeconds: 0,
      uploadedBytes: file.size,
      totalBytes: file.size,
      currentChunk: totalChunks,
      totalChunks,
      phase: "COMPLETED",
    });

    return completionResult;
  },
};
