import React, { useEffect, useState } from "react";
import { RotateCcw, Search, Sliders, Film } from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { useMigrationStream } from "../application/useMigrationStream";
import { MigrationControlPanel } from "./components/MigrationControlPanel";
import { MessageSelector } from "./components/MessageSelector";
import { ConfirmModal } from "./components/ConfirmModal";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { cn } from "@/shared/lib/utils";

export const MigrationView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks in this view
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [viewState, setViewState] = useState<{
    searchFilter: string;
    mobileTab: "panel" | "messages";
  }>({
    searchFilter: "",
    mobileTab: "panel",
  });

  // Domain & Job State managed strictly via Zustand
  const activeJob = useMigrationStore((state) => state.activeJob);
  const fetchChannels = useMigrationStore((state) => state.fetchChannels);
  const startMigration = useMigrationStore((state) => state.startMigration);
  const error = useMigrationStore((state) => state.error);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);

  // Hook connecting SSE streaming lifecycle
  useMigrationStream(activeJob?.job_id ?? null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleConfirmStart = async () => {
    setIsConfirmOpen(false);
    await startMigration();
  };

  return (
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-hidden">
      {/* Top Header */}
      <ViewHeader
        icon={<BrandLogo size="md" />}
        iconBoxColor="none"
        title="Telegram Video Migrator"
        subtitle="Clonación masiva directa por referencia (MTProto) · Sin descarga a disco · Copia limpia"
      >
        {/* Search Input using local state hook #2 */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar canal por nombre o usuario"
              placeholder="Buscar canal..."
              value={viewState.searchFilter}
              onChange={(e) => setViewState((prev) => ({ ...prev, searchFilter: e.target.value }))}
              className="bg-[#14161F] border border-white/10 rounded-md pl-8 pr-3 py-1.5 h-8 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 w-full sm:w-44 transition-all"
            />
          </div>
          <button
            onClick={() => fetchChannels()}
            className="p-2 rounded-md bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-colors h-8 w-8 flex items-center justify-center shrink-0"
            title="Recargar canales"
            aria-label="Recargar lista de canales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </ViewHeader>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between animate-in fade-in flex-shrink-0"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Mobile Tab Switcher (< 768px): clean full-screen toggle between Control Panel and Media Gallery */}
      <div className="md:hidden flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-lg shrink-0">
        <button
          type="button"
          onClick={() => setViewState((prev) => ({ ...prev, mobileTab: "panel" }))}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            viewState.mobileTab === "panel"
              ? "bg-cyan-500 text-black shadow-sm"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Panel de Control</span>
        </button>
        <button
          type="button"
          onClick={() => setViewState((prev) => ({ ...prev, mobileTab: "messages" }))}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            viewState.mobileTab === "messages"
              ? "bg-cyan-500 text-black shadow-sm"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Galería y Mensajes</span>
          {selectedMessageIds.length > 0 && (
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                viewState.mobileTab === "messages"
                  ? "bg-black text-cyan-400"
                  : "bg-cyan-500/20 text-cyan-300"
              )}
            >
              {selectedMessageIds.length}
            </span>
          )}
        </button>
      </div>

      {/* 2-Panel Split Layout (Fluid side-by-side on >= 768px tablet & desktop; full-view tabbed on < 768px mobile) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-3.5 items-stretch overflow-hidden">
        {/* Column 1: Migration Control Panel (De -> Para + Actions + Progress) */}
        <div
          className={cn(
            "md:col-span-5 lg:col-span-4 xl:col-span-3 w-full h-full min-h-0",
            viewState.mobileTab === "panel" ? "flex flex-col" : "hidden md:flex md:flex-col"
          )}
        >
          <MigrationControlPanel
            onOpenConfirm={() => setIsConfirmOpen(true)}
            filterQuery={viewState.searchFilter}
          />
        </div>

        {/* Column 2: Media Gallery & Selector Canvas */}
        <div
          className={cn(
            "md:col-span-7 lg:col-span-8 xl:col-span-9 w-full min-w-0 h-full min-h-0",
            viewState.mobileTab === "messages" ? "flex flex-col" : "hidden md:flex md:flex-col"
          )}
        >
          <MessageSelector />
        </div>
      </div>

      {/* Confirmation Modal using local state hook #1 */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmStart}
      />
    </div>
  );
};
