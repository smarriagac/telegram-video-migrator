import { create } from "zustand";
import { AuditLogItem } from "../domain/types";
import { auditApi } from "../infrastructure/auditApi";

interface AuditStore {
  logs: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentActionFilter: string | undefined;
  selectedLog: AuditLogItem | null;
  isLoading: boolean;
  error: string | null;
  fetchLogs: (action?: string, page?: number, pageSize?: number) => Promise<void>;
  setPage: (page: number) => Promise<void>;
  setPageSize: (size: number) => Promise<void>;
  setSelectedLog: (log: AuditLogItem | null) => void;
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  logs: [],
  total: 0,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  currentActionFilter: undefined,
  selectedLog: null,
  isLoading: false,
  error: null,

  setSelectedLog: (log: AuditLogItem | null) => set({ selectedLog: log }),

  fetchLogs: async (action?: string, page?: number, pageSize?: number) => {
    const p = page ?? get().page;
    const ps = pageSize ?? get().pageSize;
    const filter =
      action !== undefined ? (action === "ALL" ? undefined : action) : get().currentActionFilter;

    set({ isLoading: true, error: null, currentActionFilter: filter });
    try {
      const data = await auditApi.fetchAuditLogs({
        action: filter,
        page: p,
        pageSize: ps,
      });
      set({
        logs: data.items,
        total: data.total,
        page: data.page,
        pageSize: data.page_size,
        totalPages: data.total_pages,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Error al cargar logs", isLoading: false });
    }
  },

  setPage: async (newPage: number) => {
    set({ page: newPage });
    await get().fetchLogs(undefined, newPage);
  },

  setPageSize: async (newSize: number) => {
    set({ pageSize: newSize, page: 1 });
    await get().fetchLogs(undefined, 1, newSize);
  },
}));
