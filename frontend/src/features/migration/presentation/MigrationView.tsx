import React, { useEffect, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { useMigrationStream } from "../application/useMigrationStream";
import { MigrationControlPanel } from "./components/MigrationControlPanel";
import { MessageSelector } from "./components/MessageSelector";
import { ConfirmModal } from "./components/ConfirmModal";
import { BrandLogo } from "@/shared/components/BrandLogo";

export const MigrationView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks in this view
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Domain & Job State managed strictly via Zustand
  const activeJob = useMigrationStore((state) => state.activeJob);
  const fetchChannels = useMigrationStore((state) => state.fetchChannels);
  const startMigration = useMigrationStore((state) => state.startMigration);
  const error = useMigrationStore((state) => state.error);

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
    <div className="w-full max-w-[1900px] px-3 sm:px-4 lg:px-6 mx-auto space-y-4 pb-6">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div className="flex items-center space-x-2.5">
            <BrandLogo size="md" />
            <h1 className="text-lg font-bold tracking-tight text-white">
              Telegram Video Migrator
            </h1>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Clonación masiva directa por referencia (MTProto) · Sin descarga a disco · Copia limpia
          </p>
        </div>

        {/* Search Input using local state hook #2 */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar canal por nombre o usuario"
              placeholder="Buscar canal..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-md pl-8 pr-3 py-1.5 h-8 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 w-44 transition-all"
            />
          </div>
          <button
            onClick={() => fetchChannels()}
            className="p-2 rounded-md bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-colors h-8 w-8 flex items-center justify-center"
            title="Recargar canales"
            aria-label="Recargar lista de canales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between animate-in fade-in"
        >
          <span>{error}</span>
        </div>
      )}

      {/* 2-Panel Split Layout (Optimized: Col 2 'Control Panel' + Col 3 'Media Selector Canvas') */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Column 2: Migration Control Panel (De -> Para + Actions + Progress) */}
        <div className="lg:col-span-4 xl:col-span-3 w-full">
          <MigrationControlPanel
            onOpenConfirm={() => setIsConfirmOpen(true)}
            filterQuery={searchFilter}
          />
        </div>

        {/* Column 3: Media Gallery & Selector Canvas */}
        <div className="lg:col-span-8 xl:col-span-9 w-full min-w-0">
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
