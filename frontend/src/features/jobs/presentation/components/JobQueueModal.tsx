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
import { jobsApi } from "../../infrastructure/jobsApi";
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Zap,
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
  const [retryingItem, setRetryingItem] = React.useState<number | null>(null);

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

  const getItemBadge = (item: QueueItem) => {
    if (item.is_deduplicated) {
      return (
        <Badge variant="outline" className="text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] font-mono gap-1">
          <Zap className="w-3 h-3 text-amber-400" /> Fast-Forward
        </Badge>
      );
    }
    switch (item.status) {
      case "COMPLETED":
        return (
          <Badge variant="outline" className="text-emerald-500 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 text-[10px]">
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
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-[10px] animate-pulse">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> En curso
          </Badge>
        );
      case "SKIPPED":
        return (
          <Badge variant="secondary" className="text-muted-foreground text-[10px]">
            Omitido (Dedup)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground border-border bg-secondary text-[10px]">
            <Clock className="w-3 h-3 mr-1" /> Pendiente
          </Badge>
        );
    }
  };

  return (
    <Dialog open={Boolean(job)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground p-4 sm:p-6 shadow-xl max-h-[85vh] flex flex-col min-h-0">
        <DialogHeader className="border-b border-border pb-3 space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <DialogTitle className="text-sm font-semibold text-foreground font-mono">
                Cola de Migración: <span className="text-muted-foreground font-normal">#{job.job_id.slice(0, 8)}</span>
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

          <div className="flex items-center gap-2 text-xs text-foreground">
            <span className="font-semibold text-primary truncate max-w-[160px] sm:max-w-xs">
              {job.source_title || `Canal ${job.source_id}`}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-emerald-500 dark:text-emerald-400 truncate max-w-[160px] sm:max-w-xs">
              {job.target_title || `Canal ${job.target_id}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
              <span>Progreso: {job.processed_videos} de {job.total_videos} items</span>
              <span className="text-primary font-bold">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5 bg-secondary" />
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-7 gap-2 pt-2 text-center text-xs font-mono">
            <div className="p-1.5 rounded bg-secondary/50 border border-border">
              <span className="text-[10px] text-muted-foreground block">Total</span>
              <span className="font-bold text-foreground">{stats.total || items.length}</span>
            </div>
            <div className="p-1.5 rounded bg-secondary/50 border border-border">
              <span className="text-[10px] text-muted-foreground block">Pendientes</span>
              <span className="font-bold text-muted-foreground">{stats.pending || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-secondary/50 border border-border">
              <span className="text-[10px] text-muted-foreground block">En curso</span>
              <span className="font-bold text-primary">{stats.in_progress || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-secondary/50 border border-border">
              <span className="text-[10px] text-muted-foreground block">Completos</span>
              <span className="font-bold text-emerald-500 dark:text-emerald-400">{stats.completed || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-secondary/50 border border-border">
              <span className="text-[10px] text-muted-foreground block">Fallidos</span>
              <span className={cn("font-bold", failedCount > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground")}>
                {failedCount}
              </span>
            </div>
            <div className="p-1.5 rounded bg-secondary/50 border border-border">
              <span className="text-[10px] text-muted-foreground block">Omitidos</span>
              <span className="font-bold text-amber-500 dark:text-amber-400">{stats.skipped || 0}</span>
            </div>
            <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 col-span-3 sm:col-span-1">
              <span className="text-[10px] text-amber-400 block flex items-center justify-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Dedup
              </span>
              <span className="font-bold text-amber-400">{stats.deduplicated || 0}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Queue Items Table */}
        <div className="flex-1 overflow-y-auto min-h-0 border border-border rounded-lg mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Cargando elementos de cola...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              No hay elementos registrados en la cola de este trabajo.
            </div>
          ) : (
            <Table className="w-full text-xs">
              <TableHeader className="bg-secondary/40 text-muted-foreground sticky top-0 font-mono border-b border-border z-10">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="py-2 px-3">Msg ID Origen</TableHead>
                  <TableHead className="py-2 px-3">Tipo</TableHead>
                  <TableHead className="py-2 px-3">Estado</TableHead>
                  <TableHead className="py-2 px-3">Msg ID Destino</TableHead>
                  <TableHead className="py-2 px-3">Reintentos</TableHead>
                  <TableHead className="py-2 px-3">Detalle / Error</TableHead>
                  <TableHead className="py-2 px-3 text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border font-mono text-xs">
                {items.map((item) => (
                  <TableRow key={item.source_message_id} className="hover:bg-muted/40">
                    <TableCell className="py-2 px-3 text-foreground">
                      #{item.source_message_id}
                    </TableCell>
                    <TableCell className="py-2 px-3 uppercase text-[11px] text-muted-foreground">
                      {item.media_type}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      {getItemBadge(item)}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-emerald-500 dark:text-emerald-400 font-mono">
                      {item.target_message_id ? `#${item.target_message_id}` : "-"}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-muted-foreground">
                      {item.retry_count}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-xs max-w-xs truncate">
                      {item.is_deduplicated ? (
                        <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1 font-mono text-[11px]" title={item.error_message || item.caption}>
                          <Zap className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.error_message || item.caption || "Deduplicado (Fast-Forward)"}</span>
                        </span>
                      ) : item.error_message ? (
                        <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1" title={item.error_message}>
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.error_message}</span>
                        </span>
                      ) : item.caption ? (
                        <span className="text-muted-foreground font-sans truncate block" title={item.caption}>
                          {item.caption}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-right">
                      {item.status === "FAILED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retryingItem === item.source_message_id}
                          onClick={async () => {
                            setRetryingItem(item.source_message_id);
                            try {
                              await jobsApi.retrySingleItem(job.job_id, item.source_message_id);
                              item.status = "PENDING";
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setRetryingItem(null);
                            }
                          }}
                          className="h-6 text-[10px] px-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1"
                        >
                          <RotateCcw className={cn("w-2.5 h-2.5", retryingItem === item.source_message_id && "animate-spin")} />
                          <span>Reintentar</span>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
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
