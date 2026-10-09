import React, { useEffect, useState } from "react";
import { Play, RotateCcw, Search, StopCircle, Tv2 } from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { useMigrationStream } from "../application/useMigrationStream";
import { ChannelSelector } from "./components/ChannelSelector";
import { ProgressBar } from "./components/ProgressBar";
import { TerminalLog } from "./components/TerminalLog";
import { ConfirmModal } from "./components/ConfirmModal";
import { Button } from "@/shared/components/ui/button";

export const MigrationView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks in this view
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Domain & Job State managed strictly via Zustand
  const activeJob = useMigrationStore((state) => state.activeJob);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const fetchChannels = useMigrationStore((state) => state.fetchChannels);
  const startMigration = useMigrationStore((state) => state.startMigration);
  const cancelMigration = useMigrationStore((state) => state.cancelMigration);
  const resetJob = useMigrationStore((state) => state.resetJob);
  const error = useMigrationStore((state) => state.error);

  // Hook connecting SSE streaming lifecycle
  useMigrationStream(activeJob?.job_id ?? null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const isRunning =
    activeJob?.status === "RUNNING" || activeJob?.status === "PAUSED_FLOOD_WAIT";
  const isFinished =
    activeJob?.status === "COMPLETED" ||
    activeJob?.status === "FAILED" ||
    activeJob?.status === "CANCELLED";

  const handleConfirmStart = async () => {
    setIsConfirmOpen(false);
    await startMigration();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tv2 className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Telegram Video Migrator
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Clonación masiva directa por referencia (MTProto) · Sin descarga a disco · Copia limpia
          </p>
        </div>

        {/* Search Input using local state hook #2 */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar canal por nombre o usuario"
              placeholder="Buscar canal..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-md pl-9 pr-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 w-48 transition-all"
            />
          </div>
          <button
            onClick={() => fetchChannels()}
            className="p-2 rounded-md bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Recargar canales"
            aria-label="Recargar lista de canales"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between animate-in fade-in"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Channel Selector */}
      <ChannelSelector filterQuery={searchFilter} />

      {/* Action Center Banner */}
      <section
        aria-label="Controles de migración"
        className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-r from-[#14161F] to-[#12141C] border border-white/5 shadow-xl"
      >
        <div>
          <h4 className="text-sm font-semibold text-white">Ejecutar Migración</h4>
          <p className="text-xs text-zinc-400 mt-0.5">
            Comienza a clonar automáticamente respetando límites de Telegram.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isRunning ? (
            <Button
              variant="destructive"
              onClick={() => cancelMigration()}
              className="flex items-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              Detener Migración
            </Button>
          ) : isFinished ? (
            <Button
              variant="secondary"
              onClick={() => resetJob()}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Nueva Migración
            </Button>
          ) : (
            <Button
              variant="default"
              disabled={!selectedSourceId || !selectedTargetId || selectedSourceId === selectedTargetId}
              onClick={() => setIsConfirmOpen(true)}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Iniciar en 1 Click
            </Button>
          )}
        </div>
      </section>

      {/* Real-time Progress Bar */}
      <ProgressBar />

      {/* Streaming Terminal Log */}
      <TerminalLog />

      {/* Confirmation Modal using local state hook #1 */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmStart}
      />
    </div>
  );
};
