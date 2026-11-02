import { create } from "zustand";
import { JobItem, JobQueueStatus } from "../domain/types";
import { jobsApi } from "../infrastructure/jobsApi";

interface JobsState {
  jobs: JobItem[];
  total: number;
  page: number;
  pageSize: number;
  statusFilter: string;
  selectedJob: JobItem | null;
  selectedJobQueue: JobQueueStatus | null;
  isLoading: boolean;
  isQueueLoading: boolean;
  error: string | null;

  fetchJobs: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setStatusFilter: (filter: string) => void;
  selectJob: (job: JobItem | null) => Promise<void>;
  pauseJob: (jobId: string) => Promise<boolean>;
  resumeJob: (jobId: string) => Promise<boolean>;
  cancelJob: (jobId: string) => Promise<boolean>;
  retryFailed: (jobId: string) => Promise<number>;
  deleteJob: (jobId: string) => Promise<boolean>;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  total: 0,
  page: 1,
  pageSize: 20,
  statusFilter: "ALL",
  selectedJob: null,
  selectedJobQueue: null,
  isLoading: false,
  isQueueLoading: false,
  error: null,

  fetchJobs: async () => {
    const { page, pageSize, statusFilter } = get();
    set({ isLoading: true, error: null });
    try {
      const data = await jobsApi.fetchJobs({
        page,
        pageSize,
        status: statusFilter,
      });
      set({
        jobs: data.items,
        total: data.total,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.message || "Error al cargar trabajos",
        isLoading: false,
      });
    }
  },

  setPage: (page: number) => {
    set({ page });
    get().fetchJobs();
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 });
    get().fetchJobs();
  },

  setStatusFilter: (statusFilter: string) => {
    set({ statusFilter, page: 1 });
    get().fetchJobs();
  },

  selectJob: async (job: JobItem | null) => {
    set({ selectedJob: job, selectedJobQueue: null });
    if (!job) return;

    set({ isQueueLoading: true });
    try {
      const queue = await jobsApi.fetchJobQueue(job.job_id);
      set({ selectedJobQueue: queue, isQueueLoading: false });
    } catch (err) {
      set({ isQueueLoading: false });
    }
  },

  pauseJob: async (jobId: string) => {
    try {
      await jobsApi.pauseJob(jobId);
      await get().fetchJobs();
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  resumeJob: async (jobId: string) => {
    try {
      await jobsApi.resumeJob(jobId);
      await get().fetchJobs();
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  cancelJob: async (jobId: string) => {
    try {
      await jobsApi.cancelJob(jobId);
      await get().fetchJobs();
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  retryFailed: async (jobId: string) => {
    try {
      const res = await jobsApi.retryFailedItems(jobId);
      await get().fetchJobs();
      if (get().selectedJob?.job_id === jobId) {
        await get().selectJob(get().selectedJob);
      }
      return res.requeued_items;
    } catch (err: any) {
      set({ error: err.message });
      return 0;
    }
  },

  deleteJob: async (jobId: string) => {
    try {
      await jobsApi.deleteJob(jobId);
      if (get().selectedJob?.job_id === jobId) {
        set({ selectedJob: null, selectedJobQueue: null });
      }
      await get().fetchJobs();
      return true;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },
}));
