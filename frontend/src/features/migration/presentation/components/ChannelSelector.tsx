import React from "react";
import { ArrowRight, CheckCircle2, Tv } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

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
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        <div className="h-44 bg-zinc-900/60 rounded-2xl border border-white/5" />
        <div className="h-44 bg-zinc-900/60 rounded-2xl border border-white/5" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
      {/* Connector icon for desktop */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-zinc-900 border border-white/10 items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/40">
        <ArrowRight className="w-5 h-5" />
      </div>

      {/* Source Channel Card */}
      <div className="bg-[#14161F]/90 backdrop-blur-md rounded-2xl border border-white/5 p-5 shadow-xl transition-all">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-semibold tracking-wider text-cyan-400 uppercase">
              Canal Origen (Fuente)
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {channels.length} disponibles
          </span>
        </div>

        <label className="text-xs text-zinc-400 mb-1.5 block">Seleccionar canal de videos:</label>
        <Select
          disabled={isRunning}
          value={selectedSourceId ? String(selectedSourceId) : ""}
          onValueChange={(val) => selectSource(val ? Number(val) : null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar canal origen..." />
          </SelectTrigger>
          <SelectContent>
            {filteredChannels.map((c) => (
              <SelectItem
                key={c.id}
                value={String(c.id)}
                disabled={c.id === selectedTargetId}
              >
                {c.title} {c.username ? `(@${c.username})` : `[ID: ${c.id}]`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mt-4 p-3 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Tv className="w-4 h-4 text-zinc-500" />
            Modo de clonación:
          </span>
          <span className="text-cyan-300 font-medium font-mono">Referencia Directa</span>
        </div>
      </div>

      {/* Destination Channel Card */}
      <div className="bg-[#14161F]/90 backdrop-blur-md rounded-2xl border border-white/5 p-5 shadow-xl transition-all">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold tracking-wider text-emerald-400 uppercase">
              Canal Destino (Receptor)
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Copia limpia
          </span>
        </div>

        <label className="text-xs text-zinc-400 mb-1.5 block">Seleccionar canal receptor:</label>
        <Select
          disabled={isRunning}
          value={selectedTargetId ? String(selectedTargetId) : ""}
          onValueChange={(val) => selectTarget(val ? Number(val) : null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar canal destino..." />
          </SelectTrigger>
          <SelectContent>
            {filteredChannels.map((c) => (
              <SelectItem
                key={c.id}
                value={String(c.id)}
                disabled={c.id === selectedSourceId}
              >
                {c.title} {c.username ? `(@${c.username})` : `[ID: ${c.id}]`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mt-4 p-3 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Encabezado de reenvío:
          </span>
          <span className="text-emerald-400 font-medium">Oculto (Limpio)</span>
        </div>
      </div>
    </div>
  );
};
