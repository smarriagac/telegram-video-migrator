import React from "react";
import { ArrowRight, CheckCircle2, Tv } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { SearchableChannelSelect } from "./SearchableChannelSelect";
import { ChannelCardsSkeleton } from "@/shared/components/ui/skeleton";

interface ChannelSelectorProps {
  filterQuery?: string;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({ filterQuery = "" }) => {
  const channels = useMigrationStore((state) => state.channels);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const selectSource = useMigrationStore((state) => state.selectSource);
  const selectTarget = useMigrationStore((state) => state.selectTarget);
  const isLoading = useMigrationStore((state) => state.isLoadingChannels);
  const activeJob = useMigrationStore((state) => state.activeJob);

  const isRunning = activeJob?.status === "RUNNING" || activeJob?.status === "PAUSED_FLOOD_WAIT";

  const filteredChannels = channels.filter((c) =>
    c.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.username && c.username.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  if (isLoading) {
    return <ChannelCardsSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative">
      {/* Connector icon for desktop */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-md bg-secondary border border-border items-center justify-center text-primary shadow-sm">
        <ArrowRight className="w-3.5 h-3.5" />
      </div>

      {/* Source Channel Card */}
      <div className="bg-card rounded-md border border-border p-3.5 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <h3 className="text-xs font-semibold tracking-wider text-primary uppercase">
              Canal Origen (Fuente)
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {channels.length} disponibles
          </span>
        </div>

        <label className="text-xs text-muted-foreground mb-1 block">Seleccionar canal de videos:</label>
        <SearchableChannelSelect
          disabled={isRunning}
          value={selectedSourceId}
          onChange={selectSource}
          channels={filteredChannels}
          disabledId={selectedTargetId}
          placeholder="Buscar canal origen..."
          accentColor="cyan"
        />

        <div className="mt-2.5 p-2 rounded-lg bg-secondary/60 border border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-muted-foreground" />
            Modo de clonación:
          </span>
          <span className="text-primary font-medium font-mono text-xs">Referencia Directa</span>
        </div>
      </div>

      {/* Destination Channel Card */}
      <div className="bg-card rounded-md border border-border p-3.5 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
              Canal Destino (Receptor)
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Copia limpia
          </span>
        </div>

        <label className="text-xs text-muted-foreground mb-1 block">Seleccionar canal receptor:</label>
        <SearchableChannelSelect
          disabled={isRunning}
          value={selectedTargetId}
          onChange={selectTarget}
          channels={filteredChannels}
          disabledId={selectedSourceId}
          placeholder="Buscar canal destino..."
          accentColor="emerald"
        />

        <div className="mt-2.5 p-2 rounded-lg bg-secondary/60 border border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Encabezado de reenvío:
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Oculto (Limpio)</span>
        </div>
      </div>
    </div>
  );
};
