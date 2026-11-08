import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Edit3,
  RefreshCw,
  ShieldAlert,
  CheckSquare,
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
  // Hook 1: DLQ collection, loading, active action, bulk selection, and feedback
  const [dlqState, setDlqState] = useState<{
    items: QueueItem[];
    total: number;
    isLoading: boolean;
    page: number;
    actionInProgressId: number | string | null;
    feedback: { message: string; isError?: boolean } | null;
    selectedKeys: string[];
    isBulkActing: boolean;
  }>({
    items: [],
    total: 0,
    isLoading: true,
    page: 1,
    actionInProgressId: null,
    feedback: null,
    selectedKeys: [],
    isBulkActing: false,
  });

  // Hook 2: Editing caption modal state
  const [editState, setEditState] = useState<{
    editingItem: { jobId: string; sourceMsgId: number; caption: string } | null;
    isSaving: boolean;
  }>({
    editingItem: null,
    isSaving: false,
  });

  const itemKey = (jobId: string, msgId: number) => `${jobId}:${msgId}`;

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
        selectedKeys: [],
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

  const handleToggleSelect = (jobId: string, sourceMsgId: number) => {
    const key = itemKey(jobId, sourceMsgId);
    setDlqState((prev) => {
      const isSelected = prev.selectedKeys.includes(key);
      return {
        ...prev,
        selectedKeys: isSelected
          ? prev.selectedKeys.filter((k) => k !== key)
          : [...prev.selectedKeys, key],
      };
    });
  };

  const handleSelectAllVisible = () => {
    setDlqState((prev) => {
      const allKeys = prev.items.map((it) => itemKey(it.job_id, it.source_message_id));
      const allSelected = allKeys.length > 0 && allKeys.every((k) => prev.selectedKeys.includes(k));
      return {
        ...prev,
        selectedKeys: allSelected ? [] : allKeys,
      };
    });
  };

  const handleBulkRetry = async () => {
    const selectedItems = dlqState.items
      .filter((it) => dlqState.selectedKeys.includes(itemKey(it.job_id, it.source_message_id)))
      .map((it) => ({ job_id: it.job_id, source_message_id: it.source_message_id }));

    if (selectedItems.length === 0) return;

    setDlqState((prev) => ({ ...prev, isBulkActing: true }));
    try {
      const res = await jobsApi.bulkRetryDLQ(selectedItems);
      showFeedback(`Se reencolaron ${res.retried_count} mensajes para reintento.`);
      const retriedSet = new Set(selectedItems.map((s) => itemKey(s.job_id, s.source_message_id)));
      setDlqState((prev) => ({
        ...prev,
        items: prev.items.filter((it) => !retriedSet.has(itemKey(it.job_id, it.source_message_id))),
        total: Math.max(0, prev.total - res.retried_count),
        selectedKeys: [],
        isBulkActing: false,
      }));
    } catch (err: any) {
      setDlqState((prev) => ({ ...prev, isBulkActing: false }));
      showFeedback(err.message || "Error al reintentar lote", true);
    }
  };

  const handleBulkSkip = async () => {
    const selectedItems = dlqState.items
      .filter((it) => dlqState.selectedKeys.includes(itemKey(it.job_id, it.source_message_id)))
      .map((it) => ({ job_id: it.job_id, source_message_id: it.source_message_id }));

    if (selectedItems.length === 0) return;

    setDlqState((prev) => ({ ...prev, isBulkActing: true }));
    try {
      const res = await jobsApi.bulkSkipDLQ(selectedItems);
      showFeedback(`Se omitieron ${res.skipped_count} mensajes.`);
      const skippedSet = new Set(selectedItems.map((s) => itemKey(s.job_id, s.source_message_id)));
      setDlqState((prev) => ({
        ...prev,
        items: prev.items.filter((it) => !skippedSet.has(itemKey(it.job_id, it.source_message_id))),
        total: Math.max(0, prev.total - res.skipped_count),
        selectedKeys: [],
        isBulkActing: false,
      }));
    } catch (err: any) {
      setDlqState((prev) => ({ ...prev, isBulkActing: false }));
      showFeedback(err.message || "Error al omitir lote", true);
    }
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
        selectedKeys: prev.selectedKeys.filter((k) => k !== itemKey(jobId, sourceMsgId)),
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
        selectedKeys: prev.selectedKeys.filter((k) => k !== itemKey(jobId, sourceMsgId)),
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

  const allVisibleSelected =
    dlqState.items.length > 0 &&
    dlqState.items.every((it) => dlqState.selectedKeys.includes(itemKey(it.job_id, it.source_message_id)));

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

      {/* Bulk Action Contextual Toolbar */}
      {dlqState.selectedKeys.length > 0 && (
        <div className="p-2.5 rounded-lg bg-secondary/80 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-mono text-[10px] flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              <span>{dlqState.selectedKeys.length} seleccionados</span>
            </Badge>
            <span className="text-muted-foreground text-[11px] hidden sm:inline">
              Operación masiva sobre los errores marcados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={dlqState.isBulkActing}
              onClick={handleBulkRetry}
              className="h-7 text-xs font-mono gap-1.5 bg-amber-500 text-black font-semibold hover:bg-amber-400"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", dlqState.isBulkActing && "animate-spin")} />
              <span>Reintentar Seleccionados ({dlqState.selectedKeys.length})</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={dlqState.isBulkActing}
              onClick={handleBulkSkip}
              className="h-7 text-xs font-mono gap-1 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Omitir ({dlqState.selectedKeys.length})</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={dlqState.isBulkActing}
              onClick={() => setDlqState((prev) => ({ ...prev, selectedKeys: [] }))}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Deseleccionar
            </Button>
          </div>
        </div>
      )}

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
                <TableHead className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleSelectAllVisible}
                    aria-label="Seleccionar todos los visibles"
                    className="w-3.5 h-3.5 rounded border-border bg-secondary cursor-pointer accent-primary"
                  />
                </TableHead>
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
              {dlqState.items.map((it) => {
                const key = itemKey(it.job_id, it.source_message_id);
                const isSelected = dlqState.selectedKeys.includes(key);
                return (
                  <TableRow
                    key={key}
                    className={cn("hover:bg-muted/40", isSelected && "bg-primary/5")}
                  >
                    <TableCell className="py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(it.job_id, it.source_message_id)}
                        aria-label={`Seleccionar mensaje #${it.source_message_id}`}
                        className="w-3.5 h-3.5 rounded border-border bg-secondary cursor-pointer accent-primary"
                      />
                    </TableCell>
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
                        disabled={dlqState.actionInProgressId === it.source_message_id || dlqState.isBulkActing}
                        onClick={() => handleRetrySingle(it.job_id, it.source_message_id)}
                        className="h-7 text-[11px] px-2 font-mono gap-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                      >
                        <RotateCcw className={cn("w-3 h-3", dlqState.actionInProgressId === it.source_message_id && "animate-spin")} />
                        <span>Reintentar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={dlqState.isBulkActing}
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
                        disabled={dlqState.actionInProgressId === it.source_message_id || dlqState.isBulkActing}
                        onClick={() => handleSkipSingle(it.job_id, it.source_message_id)}
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        Omitir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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
