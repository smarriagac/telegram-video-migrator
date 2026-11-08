import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Edit3,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { jobsApi } from "../../infrastructure/jobsApi";
import { QueueItem } from "../../domain/types";
import { cn } from "@/shared/lib/utils";

export const DeadLetterQueueCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: DLQ collection, loading, active action, and feedback
  const [dlqState, setDlqState] = useState<{
    items: QueueItem[];
    total: number;
    isLoading: boolean;
    page: number;
    actionInProgressId: number | null;
    feedback: { message: string; isError?: boolean } | null;
  }>({
    items: [],
    total: 0,
    isLoading: true,
    page: 1,
    actionInProgressId: null,
    feedback: null,
  });

  // Hook 2: Editing caption modal state
  const [editState, setEditState] = useState<{
    editingItem: { jobId: string; sourceMsgId: number; caption: string } | null;
    isSaving: boolean;
  }>({
    editingItem: null,
    isSaving: false,
  });

  const loadDlq = async (page = 1) => {
    setDlqState((prev) => ({ ...prev, isLoading: true }));
    try {
      const limit = 50;
      const offset = (page - 1) * limit;
      const res = await jobsApi.fetchDLQ({ limit, offset });
      setDlqState((prev) => ({
        ...prev,
        items: res.items,
        total: res.total,
        isLoading: false,
        page,
      }));
    } catch (err: any) {
      setDlqState((prev) => ({
        ...prev,
        isLoading: false,
        feedback: { message: err.message || "Error al cargar DLQ", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadDlq();
  }, []);

  const showFeedback = (message: string, isError = false) => {
    setDlqState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setDlqState((prev) => ({ ...prev, feedback: null }));
    }, 4000);
  };

  const handleRetrySingle = async (jobId: string, sourceMsgId: number) => {
    setDlqState((prev) => ({ ...prev, actionInProgressId: sourceMsgId }));
    try {
      await jobsApi.retrySingleItem(jobId, sourceMsgId);
      showFeedback(`Mensaje #${sourceMsgId} reencolado para reintento`);
      setDlqState((prev) => ({
        ...prev,
        items: prev.items.filter(
          (it) => !(it.job_id === jobId && it.source_message_id === sourceMsgId)
        ),
        total: Math.max(0, prev.total - 1),
      }));
    } catch (err: any) {
      showFeedback(err.message || "Error al reintentar ítem", true);
    } finally {
      setDlqState((prev) => ({ ...prev, actionInProgressId: null }));
    }
  };

  const handleSkipSingle = async (jobId: string, sourceMsgId: number) => {
    setDlqState((prev) => ({ ...prev, actionInProgressId: sourceMsgId }));
    try {
      await jobsApi.skipSingleItem(jobId, sourceMsgId);
      showFeedback(`Mensaje #${sourceMsgId} marcado como OMITIDO`);
      setDlqState((prev) => ({
        ...prev,
        items: prev.items.filter(
          (it) => !(it.job_id === jobId && it.source_message_id === sourceMsgId)
        ),
        total: Math.max(0, prev.total - 1),
      }));
    } catch (err: any) {
      showFeedback(err.message || "Error al omitir ítem", true);
    } finally {
      setDlqState((prev) => ({ ...prev, actionInProgressId: null }));
    }
  };

  const handleSaveCaption = async () => {
    if (!editState.editingItem) return;
    setEditState((prev) => ({ ...prev, isSaving: true }));
    try {
      const { jobId, sourceMsgId, caption } = editState.editingItem;
      await jobsApi.updateItemCaption(jobId, sourceMsgId, caption);
      showFeedback(`Caption del mensaje #${sourceMsgId} actualizado`);
      setDlqState((prev) => ({
        ...prev,
        items: prev.items.map((it) =>
          it.job_id === jobId && it.source_message_id === sourceMsgId
            ? { ...it, caption }
            : it
        ),
      }));
      setEditState({ editingItem: null, isSaving: false });
    } catch (err: any) {
      setEditState((prev) => ({ ...prev, isSaving: false }));
      showFeedback(err.message || "Error al actualizar caption", true);
    }
  };

  return (
    <div className="bg-card border border-border rounded-md p-4 sm:p-5 space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground font-mono">
                Dead-Letter Queue (DLQ)
              </h3>
              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] font-mono">
                {dlqState.total} {dlqState.total === 1 ? "fallo" : "fallos"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Inspección y recuperación granular de posts fallidos sin reiniciar los jobs completos.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDlq(dlqState.page)}
          disabled={dlqState.isLoading}
          className="h-8 text-xs font-mono flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", dlqState.isLoading && "animate-spin")} />
          <span>Actualizar</span>
        </Button>
      </div>

      {/* Feedback Banner */}
      {dlqState.feedback && (
        <div
          className={cn(
            "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
            dlqState.feedback.isError
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          )}
        >
          {dlqState.feedback.isError ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{dlqState.feedback.message}</span>
        </div>
      )}

      {/* DLQ Table */}
      <div className="border border-border rounded-lg overflow-x-auto min-h-40">
        {dlqState.isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Cargando elementos de la Dead-Letter Queue...</span>
          </div>
        ) : dlqState.items.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="font-semibold text-foreground">La Dead-Letter Queue está limpia.</p>
            <p className="text-[11px]">No hay mensajes o videos con errores pendientes de resolución.</p>
          </div>
        ) : (
          <Table className="w-full text-xs">
            <TableHeader className="bg-secondary/40 font-mono text-muted-foreground border-b border-border">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="py-2.5 px-3">Job ID</TableHead>
                <TableHead className="py-2.5 px-3">Msg ID</TableHead>
                <TableHead className="py-2.5 px-3">Tipo</TableHead>
                <TableHead className="py-2.5 px-3">Reintentos</TableHead>
                <TableHead className="py-2.5 px-3">Motivo del Fallo</TableHead>
                <TableHead className="py-2.5 px-3">Texto / Caption</TableHead>
                <TableHead className="py-2.5 px-3 text-right">Acciones Granulares</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border font-mono text-xs">
              {dlqState.items.map((it) => (
                <TableRow key={`${it.job_id}-${it.source_message_id}`} className="hover:bg-muted/40">
                  <TableCell className="py-2 px-3 text-muted-foreground">
                    #{it.job_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="py-2 px-3 font-bold text-foreground">
                    #{it.source_message_id}
                  </TableCell>
                  <TableCell className="py-2 px-3 uppercase text-[10px] text-muted-foreground">
                    {it.media_type}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                      {it.retry_count} {it.retry_count === 1 ? "vez" : "veces"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 max-w-[220px]">
                    <span className="text-rose-400 flex items-center gap-1 truncate" title={it.error_message || ""}>
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span className="truncate">{it.error_message || "Error desconocido"}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 max-w-[180px] font-sans text-muted-foreground truncate" title={it.caption}>
                    {it.caption || "-"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-right space-x-1 whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={dlqState.actionInProgressId === it.source_message_id}
                      onClick={() => handleRetrySingle(it.job_id, it.source_message_id)}
                      className="h-7 text-[11px] px-2 font-mono gap-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <RotateCcw className={cn("w-3 h-3", dlqState.actionInProgressId === it.source_message_id && "animate-spin")} />
                      <span>Reintentar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditState({
                          editingItem: {
                            jobId: it.job_id,
                            sourceMsgId: it.source_message_id,
                            caption: it.caption || "",
                          },
                          isSaving: false,
                        })
                      }
                      className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={dlqState.actionInProgressId === it.source_message_id}
                      onClick={() => handleSkipSingle(it.job_id, it.source_message_id)}
                      className="h-7 text-[11px] px-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      Omitir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Caption Modal */}
      {editState.editingItem && (
        <Dialog
          open={Boolean(editState.editingItem)}
          onOpenChange={(open) => !open && setEditState({ editingItem: null, isSaving: false })}
        >
          <DialogContent className="max-w-md bg-card border-border text-foreground p-4">
            <DialogHeader className="border-b border-border pb-2">
              <DialogTitle className="text-sm font-semibold font-mono">
                Editar Caption del Mensaje #{editState.editingItem.sourceMsgId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Corregí el texto o eliminá links conflictivos antes de relanzar el post.
              </p>
              <textarea
                rows={4}
                value={editState.editingItem.caption}
                onChange={(e) =>
                  setEditState((prev) => ({
                    ...prev,
                    editingItem: prev.editingItem
                      ? { ...prev.editingItem, caption: e.target.value }
                      : null,
                  }))
                }
                className="w-full text-xs font-mono p-2 rounded bg-secondary/40 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditState({ editingItem: null, isSaving: false })}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCaption}
                  disabled={editState.isSaving}
                  className="h-8 text-xs bg-primary text-primary-foreground"
                >
                  {editState.isSaving ? "Guardando..." : "Guardar Caption"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
