import { create } from "zustand";
import {
  AutoSyncStatus,
  CaptionRules,
  Channel,
  ChannelCloningHistory,
  ChannelMessageItem,
  ChannelSyncStatus,
  ClonedContentItem,
  JobQueueStatus,
  LogEntry,
  MediaFilterRules,
  MigrationJob,
  ProgressEventPayload,
} from "../domain/types";
import { migrationApi } from "../infrastructure/migrationApi";

interface MigrationStore {
  channels: Channel[];
  selectedSourceId: number | null;
  selectedTargetId: number | null;
  sourceMessages: ChannelMessageItem[];
  selectedMessageIds: number[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  isLoadingMoreMessages: boolean;
  channelCloningHistory: ChannelCloningHistory | null;
  clonedContentItems: ClonedContentItem[];
  isLoadingHistory: boolean;
  syncStatus: ChannelSyncStatus | null;
  isCheckingSync: boolean;
  isSyncingDelta: boolean;
  autoSyncStatus: AutoSyncStatus | null;
  isLoadingAutoSync: boolean;
  queueStatus: JobQueueStatus | null;
  activeJob: MigrationJob | null;
  progress: ProgressEventPayload | null;
  logs: LogEntry[];
  isLoadingChannels: boolean;
  isStartingJob: boolean;
  error: string | null;
  captionRules: CaptionRules;
  dripDelaySeconds: number;
  mediaFilterRules: MediaFilterRules;
  scheduledAt: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  selectSource: (id: number | null) => void;
  selectTarget: (id: number | null) => void;
  setCaptionRules: (rules: Partial<CaptionRules>) => void;
  setDripDelaySeconds: (seconds: number) => void;
  setMediaFilterRules: (rules: Partial<MediaFilterRules>) => void;
  setScheduledAt: (scheduledAt: string | null) => void;
  checkSyncStatus: () => Promise<void>;
  fetchAutoSyncStatus: () => Promise<void>;
  toggleAutoSync: (enabled: boolean) => Promise<void>;
  startDeltaSync: () => Promise<string | null>;
  selectOnlyMissingMessages: () => void;
  fetchSourceMessages: (channelId: number) => Promise<void>;
  loadMoreSourceMessages: () => Promise<void>;
  fetchChannelCloningHistory: (channelId: number) => Promise<void>;
  fetchChannelClonedContent: (channelId: number) => Promise<void>;
  toggleSelectMessage: (id: number) => void;
  selectAllMessages: () => void;
  deselectAllMessages: () => void;
  fetchQueueStatus: (jobId: string) => Promise<void>;
  startMigration: () => Promise<string | null>;
  cancelMigration: () => Promise<void>;
  updateProgress: (payload: ProgressEventPayload) => void;
  addLog: (text: string, level?: LogEntry["level"]) => void;
  clearLogs: () => void;
  resetJob: () => void;
  setError: (err: string | null) => void;
}

export const useMigrationStore = create<MigrationStore>((set, get) => ({
  channels: [],
  selectedSourceId: null,
  selectedTargetId: null,
  sourceMessages: [],
  selectedMessageIds: [],
  isLoadingMessages: false,
  hasMoreMessages: false,
  isLoadingMoreMessages: false,
  channelCloningHistory: null,
  clonedContentItems: [],
  isLoadingHistory: false,
  syncStatus: null,
  isCheckingSync: false,
  isSyncingDelta: false,
  autoSyncStatus: null,
  isLoadingAutoSync: false,
  queueStatus: null,
  activeJob: null,
  progress: null,
  logs: [],
  isLoadingChannels: false,
  isStartingJob: false,
  error: null,
  captionRules: {
    strip_links: false,
    strip_all_mentions: false,
    replace_mentions: {},
    remove_words: [],
    prepend_header: null,
    append_signature: null,
  },
  dripDelaySeconds: 0,
  mediaFilterRules: {
    min_duration_seconds: null,
    max_duration_seconds: null,
    min_height: null,
    min_width: null,
    min_file_size_bytes: null,
    max_file_size_bytes: null,
    allowed_media_types: ["video", "photo", "document", "text"],
  },
  scheduledAt: null,

  setCaptionRules: (rules) => {
    set((state) => ({
      captionRules: { ...state.captionRules, ...rules },
    }));
  },

  setDripDelaySeconds: (seconds) => {
    set({ dripDelaySeconds: seconds });
  },

  setMediaFilterRules: (rules) => {
    set((state) => ({
      mediaFilterRules: { ...state.mediaFilterRules, ...rules },
    }));
  },

  setScheduledAt: (scheduledAt) => {
    set({ scheduledAt });
  },

  fetchChannels: async () => {
    set({ isLoadingChannels: true, error: null });
    try {
      const channels = await migrationApi.fetchChannels();
      set({ channels, isLoadingChannels: false });
      if (channels.length >= 2 && !get().selectedSourceId && !get().selectedTargetId) {
        set({ selectedSourceId: channels[0].id, selectedTargetId: channels[1].id });
        get().fetchSourceMessages(channels[0].id);
        get().fetchChannelCloningHistory(channels[0].id);
        get().fetchChannelClonedContent(channels[0].id);
        get().checkSyncStatus();
        get().fetchAutoSyncStatus();
      }
    } catch (err: any) {
      set({
        isLoadingChannels: false,
        error: err.message || "Failed to load channels",
      });
      get().addLog(`Error loading channels: ${err.message}`, "error");
    }
  },

  selectSource: (id) => {
    set({
      selectedSourceId: id,
      error: null,
      selectedMessageIds: [],
      channelCloningHistory: null,
      clonedContentItems: [],
      syncStatus: null,
      autoSyncStatus: null,
    });
    if (id) {
      get().fetchSourceMessages(id);
      get().fetchChannelCloningHistory(id);
      get().fetchChannelClonedContent(id);
      if (get().selectedTargetId && get().selectedTargetId !== id) {
        get().checkSyncStatus();
        get().fetchAutoSyncStatus();
      }
    } else {
      set({
        sourceMessages: [],
        selectedMessageIds: [],
        hasMoreMessages: false,
        isLoadingMoreMessages: false,
        channelCloningHistory: null,
        clonedContentItems: [],
        syncStatus: null,
        autoSyncStatus: null,
      });
    }
  },

  selectTarget: (id) => {
    set({ selectedTargetId: id, error: null, syncStatus: null, autoSyncStatus: null });
    const { selectedSourceId } = get();
    if (selectedSourceId && id && selectedSourceId !== id) {
      get().fetchSourceMessages(selectedSourceId);
      get().checkSyncStatus();
      get().fetchAutoSyncStatus();
    }
  },

  checkSyncStatus: async () => {
    const { selectedSourceId, selectedTargetId } = get();
    if (!selectedSourceId || !selectedTargetId || selectedSourceId === selectedTargetId) {
      set({ syncStatus: null, isCheckingSync: false });
      return;
    }
    set({ isCheckingSync: true });
    try {
      const status = await migrationApi.fetchChannelSyncStatus(selectedSourceId, selectedTargetId);
      set({ syncStatus: status, isCheckingSync: false });
    } catch (err: any) {
      set({ isCheckingSync: false });
    }
  },

  fetchAutoSyncStatus: async () => {
    const { selectedSourceId, selectedTargetId } = get();
    if (!selectedSourceId || !selectedTargetId || selectedSourceId === selectedTargetId) {
      set({ autoSyncStatus: null, isLoadingAutoSync: false });
      return;
    }
    set({ isLoadingAutoSync: true });
    try {
      const status = await migrationApi.getAutoSyncStatus(selectedSourceId, selectedTargetId);
      set({ autoSyncStatus: status, isLoadingAutoSync: false });
    } catch {
      set({ autoSyncStatus: null, isLoadingAutoSync: false });
    }
  },

  toggleAutoSync: async (enabled: boolean) => {
    const { selectedSourceId, selectedTargetId, channels, captionRules, mediaFilterRules } = get();
    if (!selectedSourceId || !selectedTargetId) return;
    set({ isLoadingAutoSync: true });
    try {
      const sourceChan = channels.find((c) => c.id === selectedSourceId);
      const targetChan = channels.find((c) => c.id === selectedTargetId);
      const res = await migrationApi.toggleAutoSync({
        source_channel_id: selectedSourceId,
        target_channel_id: selectedTargetId,
        is_active: enabled,
        source_title: sourceChan?.title,
        target_title: targetChan?.title,
        source_account_id: sourceChan?.account_id,
        target_account_id: targetChan?.account_id,
        caption_rules: captionRules,
        media_filter_rules: mediaFilterRules,
      });
      set({
        autoSyncStatus: { is_active: res.is_active, binding: res },
        isLoadingAutoSync: false,
      });
      get().addLog(
        `Auto-Sync en vivo ${enabled ? "ACTIVADO" : "DESACTIVADO"} para ${sourceChan?.title || selectedSourceId} -> ${targetChan?.title || selectedTargetId}`,
        "info"
      );
    } catch (err: any) {
      set({ isLoadingAutoSync: false, error: err.message });
      get().addLog(`Error al modificar Auto-Sync: ${err.message}`, "error");
    }
  },

  startDeltaSync: async () => {
    const { selectedSourceId, selectedTargetId, channels } = get();
    if (!selectedSourceId || !selectedTargetId) {
      set({ error: "Seleccioná origen y destino para sincronizar novedades." });
      return null;
    }
    set({ isSyncingDelta: true, error: null });
    try {
      const sourceChan = channels.find((c) => c.id === selectedSourceId);
      const targetChan = channels.find((c) => c.id === selectedTargetId);
      const res = await migrationApi.triggerDeltaSync(
        selectedSourceId,
        selectedTargetId,
        sourceChan?.title,
        targetChan?.title
      );
      if (res.job_id) {
        const total = res.total_videos || 0;
        set({
          activeJob: {
            job_id: res.job_id,
            source_id: selectedSourceId,
            target_id: selectedTargetId,
            status: "PENDING",
            total_videos: total,
            processed_videos: 0,
            last_processed_id: null,
          },
          isSyncingDelta: false,
          progress: {
            job_id: res.job_id,
            status: "PENDING",
            percentage: 0,
            processed_videos: 0,
            total_videos: total,
          },
        });
        get().addLog(`Sincronización incremental iniciada (${total} novedades): ${res.job_id}`, "info");
        get().fetchQueueStatus(res.job_id);
        return res.job_id;
      }
      set({ isSyncingDelta: false });
      return null;
    } catch (err: any) {
      set({ isSyncingDelta: false, error: err.message || "Error al sincronizar novedades" });
      get().addLog(`Error en sincronización incremental: ${err.message}`, "error");
      return null;
    }
  },

  selectOnlyMissingMessages: () => {
    const { syncStatus, sourceMessages } = get();
    if (syncStatus?.missing_messages && syncStatus.missing_messages.length > 0) {
      const missingIds = new Set(syncStatus.missing_messages.map((m) => m.id));
      const loadedMissing = sourceMessages.filter((m) => missingIds.has(m.id)).map((m) => m.id);
      set({
        selectedMessageIds: loadedMissing.length > 0 ? loadedMissing : syncStatus.missing_messages.map((m) => m.id),
      });
    } else {
      const missing = sourceMessages.filter((m) => !m.is_migrated);
      set({ selectedMessageIds: missing.map((m) => m.id) });
    }
  },

  fetchSourceMessages: async (channelId: number) => {
    const { selectedTargetId, channels } = get();
    const sourceChan = channels.find((c) => c.id === channelId);
    set({ isLoadingMessages: true, selectedMessageIds: [], hasMoreMessages: false });
    try {
      const msgs = await migrationApi.fetchChannelMessages(
        channelId,
        100,
        undefined,
        selectedTargetId || undefined,
        sourceChan?.account_id
      );
      set({
        sourceMessages: msgs,
        isLoadingMessages: false,
        hasMoreMessages: msgs.length === 100,
      });
    } catch (err: any) {
      set({ isLoadingMessages: false, hasMoreMessages: false });
      get().addLog(`Error previewing messages: ${err.message}`, "warn");
    }
  },

  loadMoreSourceMessages: async () => {
    const { selectedSourceId, selectedTargetId, sourceMessages, isLoadingMoreMessages, hasMoreMessages, channels } = get();
    if (!selectedSourceId || isLoadingMoreMessages || !hasMoreMessages || sourceMessages.length === 0) {
      return;
    }

    set({ isLoadingMoreMessages: true });
    try {
      const sourceChan = channels.find((c) => c.id === selectedSourceId);
      const oldestId = Math.min(...sourceMessages.map((m) => m.id));
      const nextBatch = await migrationApi.fetchChannelMessages(
        selectedSourceId,
        100,
        oldestId,
        selectedTargetId || undefined,
        sourceChan?.account_id
      );

      if (nextBatch.length === 0) {
        set({ hasMoreMessages: false, isLoadingMoreMessages: false });
        return;
      }

      const existingIds = new Set(sourceMessages.map((m) => m.id));
      const filteredNew = nextBatch.filter((m) => !existingIds.has(m.id));

      set({
        sourceMessages: [...sourceMessages, ...filteredNew],
        hasMoreMessages: nextBatch.length === 100,
        isLoadingMoreMessages: false,
      });
    } catch (err: any) {
      set({ isLoadingMoreMessages: false });
      get().addLog(`Error loading more messages: ${err.message}`, "warn");
    }
  },

  fetchChannelCloningHistory: async (channelId: number) => {
    set({ isLoadingHistory: true });
    try {
      const history = await migrationApi.fetchChannelCloningHistory(channelId);
      set({ channelCloningHistory: history, isLoadingHistory: false });
    } catch (err: any) {
      set({ isLoadingHistory: false });
    }
  },

  fetchChannelClonedContent: async (channelId: number) => {
    try {
      const content = await migrationApi.fetchChannelClonedContent(channelId);
      set({ clonedContentItems: content });
    } catch (err: any) {
      // silent fallback
    }
  },

  toggleSelectMessage: (id: number) => {
    set((state) => {
      const exists = state.selectedMessageIds.includes(id);
      const updated = exists
        ? state.selectedMessageIds.filter((mId) => mId !== id)
        : [...state.selectedMessageIds, id];
      return { selectedMessageIds: updated };
    });
  },

  selectAllMessages: () => {
    set((state) => ({
      selectedMessageIds: state.sourceMessages.map((m) => m.id),
    }));
  },

  deselectAllMessages: () => {
    set({ selectedMessageIds: [] });
  },

  fetchQueueStatus: async (jobId: string) => {
    try {
      const queue = await migrationApi.getJobQueue(jobId);
      set({ queueStatus: queue });
    } catch (err: any) {
      // silent or debug log
    }
  },

  startMigration: async () => {
    const { selectedSourceId, selectedTargetId, selectedMessageIds, captionRules, dripDelaySeconds, mediaFilterRules, scheduledAt } = get();
    if (!selectedSourceId || !selectedTargetId) {
      set({ error: "Please select both source and destination channels." });
      return null;
    }
    if (selectedSourceId === selectedTargetId) {
      set({ error: "Source and destination channels must be different." });
      return null;
    }

    set({ isStartingJob: true, error: null });
    try {
      const sourceChan = get().channels.find((c) => c.id === selectedSourceId);
      const targetChan = get().channels.find((c) => c.id === selectedTargetId);
      const job = await migrationApi.startMigration(
        selectedSourceId,
        selectedTargetId,
        selectedMessageIds.length > 0 ? selectedMessageIds : undefined,
        sourceChan?.title,
        targetChan?.title,
        sourceChan?.account_id,
        targetChan?.account_id,
        captionRules,
        dripDelaySeconds,
        mediaFilterRules,
        scheduledAt
      );
      set({
        activeJob: job,
        isStartingJob: false,
        progress: {
          job_id: job.job_id,
          status: scheduledAt ? "SCHEDULED" : "PENDING",
          percentage: 0,
          processed_videos: 0,
          total_videos: job.total_videos || selectedMessageIds.length || 0,
        },
      });
      get().addLog(
        scheduledAt
          ? `Migration job scheduled for ${new Date(scheduledAt).toLocaleString()}: ${job.job_id}`
          : `Migration job initialized: ${job.job_id}`,
        "info"
      );
      get().fetchQueueStatus(job.job_id);
      return job.job_id;
    } catch (err: any) {
      set({ isStartingJob: false, error: err.message });
      get().addLog(`Failed to start job: ${err.message}`, "error");
      return null;
    }
  },

  cancelMigration: async () => {
    const { activeJob } = get();
    if (!activeJob) return;

    try {
      await migrationApi.cancelJob(activeJob.job_id);
      get().addLog(`Cancellation requested for job: ${activeJob.job_id}`, "warn");
      set((state) => ({
        activeJob: state.activeJob ? { ...state.activeJob, status: "CANCELLED" } : null,
        progress: state.progress ? { ...state.progress, status: "CANCELLED" } : null,
      }));
    } catch (err: any) {
      get().addLog(`Failed to cancel job: ${err.message}`, "error");
    }
  },

  updateProgress: (payload) => {
    set((state) => {
      const updatedJob = state.activeJob
        ? {
            ...state.activeJob,
            status: payload.status,
            total_videos: payload.total_videos ?? state.activeJob.total_videos,
            processed_videos: payload.processed_videos ?? state.activeJob.processed_videos,
          }
        : null;

      return {
        progress: payload,
        activeJob: updatedJob,
      };
    });

    if (payload.message) {
      let level: LogEntry["level"] = "info";
      if (payload.status === "COMPLETED") level = "success";
      else if (payload.status === "PAUSED_FLOOD_WAIT") level = "warn";
      else if (payload.status === "FAILED") level = "error";

      get().addLog(payload.message, level);
    }
  },

  addLog: (text, level = "info") => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      text,
    };
    set((state) => ({
      logs: [newEntry, ...state.logs.slice(0, 199)], // keep last 200 logs
    }));
  },

  clearLogs: () => set({ logs: [] }),

  resetJob: () => set({ activeJob: null, progress: null }),

  setError: (err) => set({ error: err }),
}));
