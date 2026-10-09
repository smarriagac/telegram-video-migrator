import React from "react";
import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { JobStatus } from "../../domain/types";
import { Progress } from "@/shared/components/ui/progress";

export const ProgressBar: React.FC = () => {
  const activeJob = useMigrationStore((state) => state.activeJob);
  const progress = useMigrationStore((state) => state.progress);

  if (!activeJob && !progress) {
    return null;
  }

  const status: JobStatus = progress?.status || activeJob?.status || "PENDING";
  const processed = progress?.processed_videos ?? activeJob?.processed_videos ?? 0;
  const total = progress?.total_videos ?? activeJob?.total_videos ?? 0;
  const percentage = progress?.percentage ?? (total > 0 ? Math.round((processed / total) * 100) : 0);

  const getStatusBadge = () => {
    switch (status) {
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Migrando en tiempo real
          </span>
        );
      case "PAUSED_FLOOD_WAIT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Pausa preventiva (FloodWait: {progress?.wait_seconds ?? 30}s)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" />
            Completado con éxito
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-700/20 text-zinc-400 border border-zinc-700/30">
            <XCircle className="w-3.5 h-3.5" />
            Cancelado
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Error en la tarea
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400">
            Iniciando...
          </span>
        );
    }
  };

  return (
    <div
      role="region"
      aria-label="Progreso de la migración"
      className="bg-[#14161F]/90 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono">Progreso de Clonación</span>
          <h4 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
            {percentage}% <span className="text-xs font-normal text-zinc-500 font-mono">({processed} de {total} videos)</span>
          </h4>
        </div>
        {getStatusBadge()}
      </div>

      {/* Accessible Radix Progress Component */}
      <Progress
        value={percentage}
        aria-label="Porcentaje de videos migrados"
      />

      {progress?.message && (
        <p
          aria-live="polite"
          className="text-xs text-zinc-400 font-mono truncate"
        >
          <span className="text-zinc-500">Último evento:</span> {progress.message}
        </p>
      )}
    </div>
  );
};
