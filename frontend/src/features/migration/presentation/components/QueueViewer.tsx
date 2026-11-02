import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { QueueItem } from "../../domain/types";
import { Button } from "@/shared/components/ui/button";

export const QueueViewer: React.FC = () => {
  const activeJob = useMigrationStore((state) => state.activeJob);
  const queueStatus = useMigrationStore((state) => state.queueStatus);
  const fetchQueueStatus = useMigrationStore((state) => state.fetchQueueStatus);
  const progress = useMigrationStore((state) => state.progress);

  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (activeJob?.job_id) {
      fetchQueueStatus(activeJob.job_id);
    }
  }, [activeJob?.job_id, progress?.processed_videos, fetchQueueStatus]);

  if (!activeJob) {
    return null;
  }

  const stats = progress?.queue_stats || queueStatus?.stats || {
    total: activeJob.total_videos,
    pending: Math.max(0, activeJob.total_videos - activeJob.processed_videos),
    in_progress: 0,
    completed: activeJob.processed_videos,
    failed: 0,
    skipped: 0,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "FAILED":
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "IN_PROGRESS":
        return <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />;
    }
  };

  return (
    <div className="bg-[#0e1015] rounded-md border border-zinc-800 p-3.5 shadow-sm space-y-3">
      {/* Header and Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono">
            Sistema de Encolado Persistente
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchQueueStatus(activeJob.job_id)}
            className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <RefreshCw className="w-2.5 h-2.5 mr-1" /> Refrescar cola
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-6 px-2.5 text-xs text-zinc-300"
          >
            {isOpen ? "Ocultar detalles" : "Ver elementos en cola"}
          </Button>
        </div>
      </div>

      {/* Metric Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
        <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 block">Total</span>
          <span className="text-sm font-semibold text-zinc-100">{stats.total}</span>
        </div>
        <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] text-zinc-400 block">Pendientes</span>
          <span className="text-sm font-semibold text-zinc-300">{stats.pending}</span>
        </div>
        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-400 block">En Curso</span>
          <span className="text-sm font-semibold text-cyan-300">{stats.in_progress}</span>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] text-emerald-400 block">Exitosos</span>
          <span className="text-sm font-semibold text-emerald-300">{stats.completed}</span>
        </div>
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <span className="text-[10px] text-rose-400 block">Fallidos</span>
          <span className="text-sm font-semibold text-rose-300">{stats.failed}</span>
        </div>
      </div>

      {/* Expanded Live Items View */}
      {isOpen && queueStatus?.items && (
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1 border border-zinc-800 rounded-lg bg-[#090a0e] divide-y divide-zinc-800/60">
          {queueStatus.items.map((item: QueueItem) => (
            <div
              key={item.source_message_id}
              className="flex items-center gap-2.5 p-2 px-3 text-xs"
            >
              {getStatusIcon(item.status)}
              <span className="font-mono text-[11px] text-zinc-400 w-12 shrink-0">
                #{item.source_message_id}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0 w-16">
                {item.media_type}
              </span>
              <span className="flex-1 truncate text-[11px] text-zinc-300">
                {item.caption || (
                  <span className="text-zinc-600 italic">[Sin texto]</span>
                )}
              </span>
              {item.error_message && (
                <span className="text-[10px] text-rose-400 font-mono truncate max-w-xs">
                  {item.error_message}
                </span>
              )}
              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
