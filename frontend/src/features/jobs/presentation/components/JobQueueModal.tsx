import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import { JobItem, JobQueueStatus, QueueItem } from "../../domain/types";
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface JobQueueModalProps {
  job: JobItem | null;
  queueStatus: JobQueueStatus | null;
  isLoading: boolean;
  onClose: () => void;
  onRetryFailed: (jobId: string) => Promise<number>;
}

export const JobQueueModal: React.FC<JobQueueModalProps> = ({
  job,
  queueStatus,
  isLoading,
  onClose,
  onRetryFailed,
}) => {
  const [retrying, setRetrying] = React.useState(false);

  if (!job) return null;

  const stats = queueStatus?.stats || {};
  const items = queueStatus?.items || [];
  const failedCount = stats.failed || 0;
  const progressPct =
    job.total_videos > 0
      ? Math.round((job.processed_videos / job.total_videos) * 100)
      : 0;

  const handleRetry = async () => {
    setRetrying(true);
    await onRetryFailed(job.job_id);
    setRetrying(false);
  };

  const getItemBadge = (status: QueueItem["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completado
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="w-3 h-3 mr-1" /> Fallido
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10 text-[10px] animate-pulse">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> En curso
          </Badge>
        );
      case "SKIPPED":
        return (
          <Badge variant="secondary" className="text-zinc-400 text-[10px]">
            Omitido (Dedup)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-zinc-400 border-zinc-700 bg-zinc-900 text-[10px]">
            <Clock className="w-3 h-3 mr-1" /> Pendiente
          </Badge>
        );
    }
  };

  return (
    <Dialog open={Boolean(job)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-[#0e1015] border-zinc-800 text-zinc-100 p-4 sm:p-6 shadow-xl max-h-[85vh] flex flex-col min-h-0">
        <DialogHeader className="border-b border-zinc-800 pb-3 space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
              <DialogTitle className="text-sm font-semibold text-zinc-100 font-mono">
                Cola de Migración: <span className="text-zinc-400 font-normal">#{job.job_id.slice(0, 8)}</span>
              </DialogTitle>
            </div>
            {failedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={retrying}
                className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10 gap-1 self-start sm:self-auto"
              >
                <RotateCcw className={cn("w-3 h-3", retrying && "animate-spin")} />
                {retrying ? "Reintentando..." : `Reintentar ${failedCount} fallidos`}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="font-semibold text-cyan-300 truncate max-w-[160px] sm:max-w-xs">
              {job.source_title || `Canal ${job.source_id}`}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="font-semibold text-emerald-300 truncate max-w-[160px] sm:max-w-xs">
              {job.target_title || `Canal ${job.target_id}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-mono text-zinc-400">
              <span>Progreso: {job.processed_videos} de {job.total_videos} items</span>
              <span className="text-cyan-400">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5 bg-zinc-800" />
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 text-center text-xs font-mono">
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Total</span>
              <span className="font-bold text-zinc-200">{stats.total || items.length}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Pendientes</span>
              <span className="font-bold text-zinc-400">{stats.pending || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">En curso</span>
              <span className="font-bold text-cyan-400">{stats.in_progress || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Completos</span>
              <span className="font-bold text-emerald-400">{stats.completed || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Fallidos</span>
              <span className={cn("font-bold", failedCount > 0 ? "text-rose-400" : "text-zinc-500")}>
                {failedCount}
              </span>
            </div>
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block">Omitidos</span>
              <span className="font-bold text-amber-400">{stats.skipped || 0}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Queue Items Table */}
        <div className="flex-1 overflow-y-auto min-h-0 border border-zinc-800 rounded-lg mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-zinc-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              Cargando elementos de cola...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No hay elementos registrados en la cola de este trabajo.
            </div>
          ) : (
            <Table className="w-full text-xs">
              <TableHeader className="bg-[#090a0e] text-zinc-400 sticky top-0 font-mono border-b border-zinc-800 z-10">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="py-2 px-3">Msg ID Origen</TableHead>
                  <TableHead className="py-2 px-3">Tipo</TableHead>
                  <TableHead className="py-2 px-3">Estado</TableHead>
                  <TableHead className="py-2 px-3">Msg ID Destino</TableHead>
                  <TableHead className="py-2 px-3">Reintentos</TableHead>
                  <TableHead className="py-2 px-3">Detalle / Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-800/60 font-mono text-xs">
                {items.map((item) => (
                  <TableRow key={item.source_message_id} className="hover:bg-zinc-800/20">
                    <TableCell className="py-2 px-3 text-zinc-300">
                      #{item.source_message_id}
                    </TableCell>
                    <TableCell className="py-2 px-3 uppercase text-[11px] text-zinc-400">
                      {item.media_type}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      {getItemBadge(item.status)}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-emerald-400 font-mono">
                      {item.target_message_id ? `#${item.target_message_id}` : "-"}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-zinc-400">
                      {item.retry_count}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-xs max-w-xs truncate">
                      {item.error_message ? (
                        <span className="text-rose-400 flex items-center gap-1" title={item.error_message}>
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.error_message}</span>
                        </span>
                      ) : item.caption ? (
                        <span className="text-zinc-500 font-sans truncate block" title={item.caption}>
                          {item.caption}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="pt-3 flex justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
