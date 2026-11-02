import { create } from "zustand";
import {
  SyncBinding,
  LiveSyncHealth,
  CreateSyncBindingPayload,
  UpdateSyncBindingPayload,
} from "../domain/types";
import { syncApi } from "../infrastructure/syncApi";

interface SyncState {
  bindings: SyncBinding[];
  health: LiveSyncHealth | null;
  isLoading: boolean;
  isReloading: boolean;
  error: string | null;

  // Selected binding for rules modal
  selectedBinding: SyncBinding | null;
  isCreateModalOpen: boolean;
  isRulesModalOpen: boolean;

  fetchData: () => Promise<void>;
  createBinding: (payload: CreateSyncBindingPayload) => Promise<void>;
  toggleActive: (binding: SyncBinding) => Promise<void>;
  updateRules: (
    sourceId: number,
    targetId: number,
    payload: UpdateSyncBindingPayload
  ) => Promise<void>;
  deleteBinding: (sourceId: number, targetId: number) => Promise<void>;
  reloadDaemon: () => Promise<void>;

  setSelectedBinding: (binding: SyncBinding | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  setRulesModalOpen: (open: boolean) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  bindings: [],
  health: null,
  isLoading: false,
  isReloading: false,
  error: null,
  selectedBinding: null,
  isCreateModalOpen: false,
  isRulesModalOpen: false,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [bindings, health] = await Promise.all([
        syncApi.fetchBindings(),
        syncApi.fetchHealth().catch(() => null),
      ]);
      set({ bindings, health, isLoading: false });
    } catch (err: any) {
      set({
        error: err.message || "Error al sincronizar datos de canales vinculados",
        isLoading: false,
      });
    }
  },

  createBinding: async (payload: CreateSyncBindingPayload) => {
    set({ isLoading: true, error: null });
    try {
      const newBinding = await syncApi.createBinding(payload);
      set((state) => ({
        bindings: [
          ...state.bindings.filter(
            (b) =>
              !(
                b.source_channel_id === newBinding.source_channel_id &&
                b.target_channel_id === newBinding.target_channel_id
              )
          ),
          newBinding,
        ],
        isLoading: false,
        isCreateModalOpen: false,
      }));
    } catch (err: any) {
      set({
        error: err.message || "Error al registrar vinculación",
        isLoading: false,
      });
      throw err;
    }
  },

  toggleActive: async (binding: SyncBinding) => {
    try {
      const updated = await syncApi.updateBinding(
        binding.source_channel_id,
        binding.target_channel_id,
        { is_active: !binding.is_active }
      );
      set((state) => ({
        bindings: state.bindings.map((b) =>
          b.source_channel_id === updated.source_channel_id &&
          b.target_channel_id === updated.target_channel_id
            ? updated
            : b
        ),
      }));
    } catch (err: any) {
      set({ error: err.message || "Error al cambiar estado de la sincronización" });
    }
  },

  updateRules: async (
    sourceId: number,
    targetId: number,
    payload: UpdateSyncBindingPayload
  ) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await syncApi.updateBinding(sourceId, targetId, payload);
      set((state) => ({
        bindings: state.bindings.map((b) =>
          b.source_channel_id === updated.source_channel_id &&
          b.target_channel_id === updated.target_channel_id
            ? updated
            : b
        ),
        isLoading: false,
        isRulesModalOpen: false,
        selectedBinding: null,
      }));
    } catch (err: any) {
      set({
        error: err.message || "Error al guardar reglas de transformación",
        isLoading: false,
      });
      throw err;
    }
  },

  deleteBinding: async (sourceId: number, targetId: number) => {
    set({ isLoading: true, error: null });
    try {
      await syncApi.deleteBinding(sourceId, targetId);
      set((state) => ({
        bindings: state.bindings.filter(
          (b) => !(b.source_channel_id === sourceId && b.target_channel_id === targetId)
        ),
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.message || "Error al desvincular canal",
        isLoading: false,
      });
    }
  },

  reloadDaemon: async () => {
    set({ isReloading: true });
    try {
      await syncApi.reloadDaemon();
      await get().fetchData();
    } catch (err: any) {
      set({ error: err.message || "Error al recargar daemon" });
    } finally {
      set({ isReloading: false });
    }
  },

  setSelectedBinding: (binding) => set({ selectedBinding: binding }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setRulesModalOpen: (open) => set({ isRulesModalOpen: open }),
}));
