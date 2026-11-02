import React, { useEffect, useState } from "react";
import {
  Layers,
  RefreshCw,
  Search,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ListOrdered,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  XCircle,
} from "lucide-react";
import { useJobsStore } from "../application/useJobsStore";
import { JobStatus } from "../domain/types";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import { JobQueueModal } from "./components/JobQueueModal";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { cn } from "@/shared/lib/utils";

export const JobsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Local search query for filtering visible jobs
  const [searchQuery, setSearchQuery] = useState("");
  // Hook 2: Temporary action feedback message
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const jobs = useJobsStore((state) => state.jobs);
  const total = useJobsStore((state) => state.total);
  const page = useJobsStore((state) => state.page);
  const pageSize = useJobsStore((state) => state.pageSize);
  const statusFilter = useJobsStore((state) => state.statusFilter);
  const selectedJob = useJobsStore((state) => state.selectedJob);
  const selectedJobQueue = useJobsStore((state) => state.selectedJobQueue);
  const isLoading = useJobsStore((state) => state.isLoading);
  const isQueueLoading = useJobsStore((state) => state.isQueueLoading);
  const error = useJobsStore((state) => state.error);

  const fetchJobs = useJobsStore((state) => state.fetchJobs);
  const setPage = useJobsStore((state) => state.setPage);
  const setPageSize = useJobsStore((state) => state.setPageSize);
  const setStatusFilter = useJobsStore((state) => state.setStatusFilter);
  const selectJob = useJobsStore((state) => state.selectJob);
  const pauseJob = useJobsStore((state) => state.pauseJob);
  const resumeJob = useJobsStore((state) => state.resumeJob);
  const cancelJob = useJobsStore((state) => state.cancelJob);
  const retryFailed = useJobsStore((state) => state.retryFailed);
  const deleteJob = useJobsStore((state) => state.deleteJob);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const showFeedback = (message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handlePause = async (jobId: string) => {
    const ok = await pauseJob(jobId);
    if (ok) showFeedback("Trabajo pausado.");
    else showFeedback("Error al pausar el trabajo.", true);
  };

  const handleResume = async (jobId: string) => {
    const ok = await resumeJob(jobId);
    if (ok) showFeedback("Trabajo reanudado en segundo plano.");
    else showFeedback("Error al reanudar el trabajo.", true);
  };

  const handleCancel = async (jobId: string) => {
    if (!window.confirm("¿Seguro que deseás cancelar este trabajo de migración?")) return;
    const ok = await cancelJob(jobId);
    if (ok) showFeedback("Trabajo cancelado.");
    else showFeedback("Error al cancelar.", true);
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm("¿Eliminar este trabajo y su registro de cola permanentemente?")) return;
    const ok = await deleteJob(jobId);
    if (ok) showFeedback("Trabajo eliminado.");
    else showFeedback("Error al eliminar el trabajo.", true);
  };

  const handleRetry = async (jobId: string) => {
    const requeued = await retryFailed(jobId);
    if (requeued > 0) {
      showFeedback(`Se reencolaron ${requeued} elementos fallidos para reintento.`);
    } else {
      showFeedback("No se encontraron elementos fallidos para reintentar.", true);
    }
  };

  // Filter visible jobs by search query
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = job.job_id.toLowerCase().includes(q);
    const srcMatch = job.source_title ? job.source_title.toLowerCase().includes(q) : false;
    const tgtMatch = job.target_title ? job.target_title.toLowerCase().includes(q) : false;
    const srcIdMatch = job.source_id.toString().includes(q);
    const tgtIdMatch = job.target_id.toString().includes(q);
    return idMatch || srcMatch || tgtMatch || srcIdMatch || tgtIdMatch;
  });

  // KPI Calculations
  const runningCount = jobs.filter((j) => j.status === "RUNNING").length;
  const completedCount = jobs.filter((j) => j.status === "COMPLETED").length;
  const failedCount = jobs.filter((j) => j.status === "FAILED").length;
  const pausedCount = jobs.filter(
    (j) => j.status === "PAUSED" || j.status === "PAUSED_FLOOD_WAIT"
  ).length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case "RUNNING":
        return (
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 text-[10px] animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5" /> En ejecución
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="outline" className="text-emerald-500 dark:text-emerald-400 border-emerald-500/25 bg-emerald-500/10 text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completado
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="w-3 h-3 mr-1" /> Fallido
          </Badge>
        );
      case "PAUSED":
      case "PAUSED_FLOOD_WAIT":
        return (
          <Badge variant="outline" className="text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px]">
            <Pause className="w-3 h-3 mr-1" /> Pausado
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="text-muted-foreground text-[10px]">
            <XCircle className="w-3 h-3 mr-1" /> Cancelado
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

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-3 sm:space-y-4 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* Header */}
      <ViewHeader
        icon={<ListOrdered className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Cola de Trabajos & Tareas"
        subtitle="Supervisión de procesos en segundo plano, control de ritmo (Drip Feed) y recuperación de fallos."
        badge={
          <Badge variant="outline" className="text-[10px] font-mono bg-primary/15 text-primary border-primary/30">
            Scheduler Queue
          </Badge>
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchJobs()}
          disabled={isLoading}
          className="text-xs text-foreground flex items-center gap-1.5 h-8 border-border bg-secondary/80 hover:bg-secondary"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-primary")} />
          Actualizar
        </Button>
      </ViewHeader>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={cn(
            "p-2.5 rounded-lg border text-xs font-mono shrink-0 transition-all",
            feedback.isError
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          )}
        >
          {feedback.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Trabajos</span>
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-semibold font-mono text-foreground">{total}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>En Ejecución</span>
              <Play className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <p className="text-xl font-semibold font-mono text-primary">{runningCount}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Completados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">{completedCount}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Fallidos / Pausados</span>
              <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-amber-600 dark:text-amber-400">
              {failedCount + pausedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-lg shrink-0">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar">
          {[
            { id: "ALL", label: "Todos" },
            { id: "RUNNING", label: "En Ejecución" },
            { id: "PAUSED", label: "Pausados" },
            { id: "FAILED", label: "Fallidos" },
            { id: "COMPLETED", label: "Completados" },
          ].map((cat) => (
            <Button
              key={cat.id}
              variant={statusFilter === cat.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(cat.id)}
              className={cn(
                "h-8 px-3 text-xs whitespace-nowrap",
                statusFilter === cat.id
                  ? "bg-primary/10 text-primary border border-primary/30 font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Buscar por canal o ID de tarea..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/60 border-border text-foreground placeholder:text-muted-foreground w-full sm:w-64"
          />
        </div>
      </div>

      {/* Main Jobs Table */}
      <Card className="border-border bg-card rounded-lg shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Trabajos Registrados: <span className="font-mono text-primary">{filteredJobs.length}</span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">Auto-refresco cada 5s</span>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground text-xs space-y-2">
              <Layers className="w-8 h-8 text-muted-foreground/60" />
              <p>No se encontraron trabajos para el criterio seleccionado.</p>
            </div>
          ) : (
            <Table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <TableHeader className="bg-secondary/40 text-muted-foreground sticky top-0 font-mono text-xs border-b border-border z-10">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="py-2.5 px-3">ID / Fecha</TableHead>
                  <TableHead className="py-2.5 px-3">Ruta de Canales</TableHead>
                  <TableHead className="py-2.5 px-3">Progreso & Cuota</TableHead>
                  <TableHead className="py-2.5 px-3">Pacing</TableHead>
                  <TableHead className="py-2.5 px-3">Estado</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border font-mono text-xs">
                {filteredJobs.map((job) => {
                  const pct =
                    job.total_videos > 0
                      ? Math.round((job.processed_videos / job.total_videos) * 100)
                      : 0;

                  return (
                    <TableRow key={job.job_id} className="hover:bg-muted/40 transition-colors">
                      {/* ID / Fecha */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                        <div className="font-semibold text-foreground">
                          #{job.job_id.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(job.created_at)}
                        </div>
                      </TableCell>

                      {/* Canales */}
                      <TableCell className="py-2.5 px-3 max-w-xs">
                        <div className="flex items-center gap-1.5 font-sans font-medium text-xs text-foreground truncate">
                          <span className="text-primary truncate font-medium" title={job.source_title || String(job.source_id)}>
                            {job.source_title || `Canal ${job.source_id}`}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-emerald-500 dark:text-emerald-400 truncate font-medium" title={job.target_title || String(job.target_id)}>
                            {job.target_title || `Canal ${job.target_id}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {job.is_full_migration ? "Clonación completa" : "Selección granular"}
                        </div>
                      </TableCell>

                      {/* Progreso */}
                      <TableCell className="py-2.5 px-3 w-48">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{job.processed_videos} / {job.total_videos}</span>
                          <span className="text-primary font-bold">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5 bg-secondary" />
                      </TableCell>

                      {/* Pacing */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                        {job.drip_delay_seconds > 0 ? (
                          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10 text-[10px]">
                            {job.drip_delay_seconds >= 60
                              ? `${Math.round(job.drip_delay_seconds / 60)} min delay`
                              : `${job.drip_delay_seconds}s delay`}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Directo (2s)</span>
                        )}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(job.status)}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 font-sans">
                          {/* Inspeccionar Cola */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectJob(job)}
                            className="h-7 px-2 text-xs"
                            title="Ver cola y detalles de mensajes"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Cola
                          </Button>

                          {/* Pausar / Reanudar */}
                          {job.status === "RUNNING" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePause(job.job_id)}
                              className="h-7 px-2 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                              title="Pausar trabajo"
                            >
                              <Pause className="w-3 h-3" />
                            </Button>
                          ) : job.status === "PAUSED" || job.status === "PAUSED_FLOOD_WAIT" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResume(job.job_id)}
                              className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
                              title="Reanudar trabajo"
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                          ) : null}

                          {/* Reintentar si falló */}
                          {job.status === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(job.job_id)}
                              className="h-7 px-2 text-xs border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                              title="Reintentar elementos fallidos"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}

                          {/* Cancelar si está en ejecución */}
                          {job.status === "RUNNING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(job.job_id)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-400 hover:border-rose-500/30"
                              title="Cancelar trabajo"
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}

                          {/* Eliminar si terminó, falló o canceló */}
                          {(job.status === "COMPLETED" ||
                            job.status === "FAILED" ||
                            job.status === "CANCELLED" ||
                            job.status === "PAUSED") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(job.job_id)}
                              className="h-7 px-1.5 text-muted-foreground hover:text-rose-400"
                              title="Eliminar historial"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-secondary/40 shrink-0">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => setPageSize(Number(val))}
              disabled={isLoading}
            >
              <SelectTrigger className="w-16 h-7 bg-card border-border text-xs text-foreground font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground font-mono">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>por página</span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              Total: <strong className="font-mono text-foreground">{total}</strong> tareas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              Página <strong className="text-primary">{page}</strong> de{" "}
              <strong className="text-foreground">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="h-7 px-2 text-xs flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="h-7 px-2 text-xs flex items-center gap-1"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Queue Modal */}
      <JobQueueModal
        job={selectedJob}
        queueStatus={selectedJobQueue}
        isLoading={isQueueLoading}
        onClose={() => selectJob(null)}
        onRetryFailed={retryFailed}
      />
    </div>
  );
};
