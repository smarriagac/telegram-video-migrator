import { create } from "zustand";
import { AnalyticsOverview } from "../domain/types";
import { analyticsApi } from "../infrastructure/analyticsApi";

interface AnalyticsState {
  data: AnalyticsOverview | null;
  isLoading: boolean;
  error: string | null;
  fetchOverview: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchOverview: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await analyticsApi.fetchOverview();
      set({ data, isLoading: false });
    } catch (err: any) {
      set({
        error: err.message || "Error al sincronizar analíticas de migración",
        isLoading: false,
      });
    }
  },
}));
