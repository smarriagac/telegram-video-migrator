import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileVideo,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  HardDrive,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import {
  bigMediaUploadApi,
  UploadProgressInfo,
  CompleteUploadResult,
} from "../../infrastructure/bigMediaUploadApi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetChannelId: number | null;
  targetChannelTitle?: string;
  onUploadSuccess?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const BigMediaUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetChannelId,
  targetChannelTitle,
  onUploadSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Media file selection and metadata form state
  const [formState, setFormState] = useState<{
    file: File | null;
    caption: string;
    isDragging: boolean;
  }>({
    file: null,
    caption: "",
    isDragging: false,
  });

  // Hook 2: Chunked resumable pipeline lifecycle, metrics, and progress
  const [pipelineState, setPipelineState] = useState<{
    uploadId: string | null;
    isUploading: boolean;
    isPaused: boolean;
    progress: UploadProgressInfo | null;
    error: string | null;
    successResult: CompleteUploadResult | null;
  }>({
    uploadId: null,
    isUploading: false,
    isPaused: false,
    progress: null,
    error: null,
    successResult: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormState((prev) => ({ ...prev, file: e.target.files![0] }));
      setPipelineState((prev) => ({
        ...prev,
        uploadId: null,
        error: null,
        successResult: null,
        progress: null,
      }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, isDragging: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormState((prev) => ({ ...prev, file: e.dataTransfer.files[0] }));
      setPipelineState((prev) => ({
        ...prev,
        uploadId: null,
        error: null,
        successResult: null,
        progress: null,
      }));
    }
  };

  const handleStartUpload = async () => {
    if (!formState.file) {
      setPipelineState((prev) => ({ ...prev, error: "Seleccioná un archivo para continuar." }));
      return;
    }
    if (!targetChannelId) {
      setPipelineState((prev) => ({ ...prev, error: "No se especificó un canal de destino." }));
      return;
    }

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    setPipelineState((prev) => ({
      ...prev,
      isUploading: true,
      isPaused: false,
      error: null,
      successResult: null,
    }));

    try {
      const result = await bigMediaUploadApi.uploadFileResumable(
        formState.file,
        {
          targetChannelId,
          caption: formState.caption.trim() || undefined,
          existingUploadId: pipelineState.uploadId || undefined,
        },
        (progressInfo) => {
          setPipelineState((prev) => ({
            ...prev,
            progress: progressInfo,
            isPaused: progressInfo.phase === "PAUSED",
          }));
        },
        abortCtrl.signal
      );

      setPipelineState((prev) => ({
        ...prev,
        isUploading: false,
        isPaused: false,
        successResult: result,
      }));

      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      if (err?.name === "AbortError" || abortCtrl.signal.aborted) {
        setPipelineState((prev) => ({ ...prev, isUploading: false, isPaused: true }));
      } else {
        setPipelineState((prev) => ({
          ...prev,
          isUploading: false,
          isPaused: false,
          error: err?.message || "Fallo en la subida chonkeada.",
        }));
      }
    }
  };

  const handlePause = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCancel = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (pipelineState.uploadId) {
      try {
        await bigMediaUploadApi.cancelUpload(pipelineState.uploadId);
      } catch {
        // Ignore error on cancel
      }
    }
    setPipelineState({
      uploadId: null,
      isUploading: false,
      isPaused: false,
      progress: null,
      error: null,
      successResult: null,
    });
    setFormState({ file: null, caption: "", isDragging: false });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isBigFile = (formState.file?.size || 0) > 10 * 1024 * 1024;
  const isMegaFile = (formState.file?.size || 0) > 1024 * 1024 * 1024;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !pipelineState.isUploading && onClose()}>
      <DialogContent className="max-w-xl bg-card border border-border p-6 space-y-4 shadow-xl">
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                Subida Chonkeada Resumible (&gt;2GB MTProto)
                {isMegaFile && (
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                    MTProto BigFile
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sube archivos pesados en bloques de 5MB con tolerancia a caídas de red y transmisión MTProto.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Target Channel Banner */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border text-xs">
          <span className="text-muted-foreground">Destino:</span>
          <span className="font-semibold text-foreground truncate max-w-[260px]">
            {targetChannelTitle || `Canal ${targetChannelId}`}
          </span>
        </div>

        {/* Feedback / Error Alerts */}
        {pipelineState.error && (
          <div className="p-3 rounded-lg text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{pipelineState.error}</span>
          </div>
        )}

        {pipelineState.successResult && (
          <div className="p-3 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                ¡Archivo transmitido con éxito! (Mensaje #{pipelineState.successResult.message_id})
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleCancel} className="h-6 text-[11px] px-2">
              Subir otro
            </Button>
          </div>
        )}

        {/* File Dropzone or Selected File Preview */}
        {!pipelineState.isUploading && !pipelineState.successResult && (
          <>
            {!formState.file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setFormState((prev) => ({ ...prev, isDragging: true }));
                }}
                onDragLeave={() => setFormState((prev) => ({ ...prev, isDragging: false }))}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center",
                  formState.isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 bg-secondary/20"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/*,image/*,.mkv,.mp4,.avi,.mov"
                  className="hidden"
                />
                <HardDrive className="w-10 h-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">
                  Arrastrá tu archivo o hacé clic para explorar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Soporta videos MP4, MKV, AVI sin límite de tamaño (hasta 4GB para Premium).
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileVideo className="w-8 h-8 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                      {formState.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatBytes(formState.file.size)}
                      </span>
                      {isBigFile && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                          Chunking 5MB
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFormState((prev) => ({ ...prev, file: null }))}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Caption Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Pie de foto / Descripción (opcional)
              </label>
              <textarea
                value={formState.caption}
                onChange={(e) => setFormState((prev) => ({ ...prev, caption: e.target.value }))}
                placeholder="Escribí un texto o descripción para el mensaje..."
                rows={2}
                className="w-full text-xs rounded-lg border border-border bg-background p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </>
        )}

        {/* Upload In-Progress State: Telemetry and Controls */}
        {(pipelineState.isUploading || pipelineState.isPaused) && (
          <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className={cn("w-4 h-4 text-primary", pipelineState.isUploading && "animate-spin")} />
                <span className="text-xs font-semibold text-foreground">
                  {pipelineState.progress?.phase === "TELEGRAM_STITCHING"
                    ? "Ensamblando y Transmitiendo a Telegram MTProto..."
                    : pipelineState.isPaused
                    ? "Subida Pausada"
                    : "Subiendo Bloques al Servidor..."}
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-primary">
                {pipelineState.progress?.percent ?? 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${pipelineState.progress?.percent ?? 0}%` }}
              />
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded bg-background/60 border border-border/50 text-center">
                <span className="text-muted-foreground block text-[10px]">Velocidad</span>
                <span className="font-mono font-semibold text-foreground">
                  {pipelineState.progress?.speedMbps ?? 0} Mbps
                </span>
              </div>
              <div className="p-2 rounded bg-background/60 border border-border/50 text-center">
                <span className="text-muted-foreground block text-[10px]">Tiempo Restante</span>
                <span className="font-mono font-semibold text-foreground">
                  {pipelineState.progress?.etaSeconds
                    ? `${Math.floor(pipelineState.progress.etaSeconds / 60)}m ${pipelineState.progress.etaSeconds % 60}s`
                    : "--"}
                </span>
              </div>
              <div className="p-2 rounded bg-background/60 border border-border/50 text-center">
                <span className="text-muted-foreground block text-[10px]">Bloques 5MB</span>
                <span className="font-mono font-semibold text-foreground">
                  {pipelineState.progress?.currentChunk ?? 0} / {pipelineState.progress?.totalChunks ?? 0}
                </span>
              </div>
            </div>

            {/* In-Flight Controls */}
            <div className="flex items-center justify-end gap-2 pt-2">
              {pipelineState.isPaused ? (
                <Button size="sm" onClick={handleStartUpload} className="text-xs h-7 flex items-center gap-1.5">
                  <Play className="w-3 h-3" /> Reanudar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handlePause} className="text-xs h-7 flex items-center gap-1.5">
                  <Pause className="w-3 h-3" /> Pausar
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={handleCancel} className="text-xs h-7">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        {!pipelineState.isUploading && !pipelineState.isPaused && !pipelineState.successResult && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cerrar
            </Button>
            <Button
              size="sm"
              disabled={!formState.file || !targetChannelId}
              onClick={handleStartUpload}
              className="text-xs flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" /> Iniciar Subida Chonkeada
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
