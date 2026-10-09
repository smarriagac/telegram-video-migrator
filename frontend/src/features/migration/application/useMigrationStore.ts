import { create } from "zustand";
import { Channel, LogEntry, MigrationJob, ProgressEventPayload } from "../domain/types";
import { migrationApi } from "../infrastructure/migrationApi";

interface MigrationStore {
  channels: Channel[];
  selectedSourceId: number | null;
  selectedTargetId: number | null;
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
      }
    } catch (err: any) {
      set({
        isLoadingChannels: false,
        error: err.message || "Failed to load channels",
      });
      get().addLog(`Error loading channels: ${err.message}`, "error");
    }
  },

  selectSource: (id) => set({ selectedSourceId: id, error: null }),
  selectTarget: (id) => set({ selectedTargetId: id, error: null }),

  startMigration: async () => {
    const { selectedSourceId, selectedTargetId } = get();
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
      const job = await migrationApi.startMigration(selectedSourceId, selectedTargetId);
      set({
        activeJob: job,
        isStartingJob: false,
        progress: {
          job_id: job.job_id,
          status: "PENDING",
          percentage: 0,
          processed_videos: 0,
          total_videos: 0,
        },
      });
      get().addLog(`Migration job initialized: ${job.job_id}`, "info");
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
