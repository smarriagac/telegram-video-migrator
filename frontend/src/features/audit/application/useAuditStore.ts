import { create } from "zustand";
import { AuditLogItem } from "../domain/types";
import { auditApi } from "../infrastructure/auditApi";

interface AuditStore {
  logs: AuditLogItem[];
  isLoading: boolean;
  error: string | null;
  fetchLogs: (action?: string) => Promise<void>;
}

export const useAuditStore = create<AuditStore>((set) => ({
  logs: [],
  isLoading: false,
  error: null,

  fetchLogs: async (action?: string) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await auditApi.fetchAuditLogs({
        action: action && action !== "ALL" ? action : undefined,
        limit: 200,
      });
      set({ logs, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Error al cargar logs", isLoading: false });
    }
  },
}));
