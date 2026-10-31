import { create } from "zustand";
import {
  Channel,
  ChannelMessageItem,
  JobQueueStatus,
  LogEntry,
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
  queueStatus: JobQueueStatus | null;
  activeJob: MigrationJob | null;
  progress: ProgressEventPayload | null;
  logs: LogEntry[];
  isLoadingChannels: boolean;
  isStartingJob: boolean;
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  selectSource: (id: number | null) => void;
  selectTarget: (id: number | null) => void;
  fetchSourceMessages: (channelId: number) => Promise<void>;
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
  queueStatus: null,
  activeJob: null,
  progress: null,
  logs: [],
  isLoadingChannels: false,
  isStartingJob: false,
  error: null,

  fetchChannels: async () => {
    set({ isLoadingChannels: true, error: null });
    try {
      const channels = await migrationApi.fetchChannels();
      set({ channels, isLoadingChannels: false });
      if (channels.length >= 2 && !get().selectedSourceId && !get().selectedTargetId) {
        set({ selectedSourceId: channels[0].id, selectedTargetId: channels[1].id });
        get().fetchSourceMessages(channels[0].id);
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
    set({ selectedSourceId: id, error: null, selectedMessageIds: [] });
    if (id) {
      get().fetchSourceMessages(id);
    } else {
      set({ sourceMessages: [] });
    }
  },

  selectTarget: (id) => set({ selectedTargetId: id, error: null }),

  fetchSourceMessages: async (channelId: number) => {
    set({ isLoadingMessages: true });
    try {
      const msgs = await migrationApi.fetchChannelMessages(channelId, 100);
      set({ sourceMessages: msgs, isLoadingMessages: false });
    } catch (err: any) {
      set({ isLoadingMessages: false });
      get().addLog(`Error previewing messages: ${err.message}`, "warn");
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
    const { selectedSourceId, selectedTargetId, selectedMessageIds } = get();
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
      const job = await migrationApi.startMigration(
        selectedSourceId,
        selectedTargetId,
        selectedMessageIds.length > 0 ? selectedMessageIds : undefined
      );
      set({
        activeJob: job,
        isStartingJob: false,
        progress: {
          job_id: job.job_id,
          status: "PENDING",
          percentage: 0,
          processed_videos: 0,
          total_videos: job.total_videos || selectedMessageIds.length || 0,
        },
      });
      get().addLog(`Migration job initialized: ${job.job_id}`, "info");
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
