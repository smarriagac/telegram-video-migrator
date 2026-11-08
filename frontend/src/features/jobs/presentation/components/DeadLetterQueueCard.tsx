import React, { useEffect, useState } from "react";
import {
  RotateCcw,
  XCircle,
  CheckCircle2,
  Edit3,
  RefreshCw,
  ShieldAlert,
  CheckSquare,
  Search,
  Zap,
  X,
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
import { jobsApi, DLQSummary } from "../../infrastructure/jobsApi";
import { QueueItem } from "../../domain/types";
import { cn } from "@/shared/lib/utils";

type ErrorCategory = "ALL" | "FLOOD_WAIT" | "TIMEOUT_NETWORK" | "PERMISSION_AUTH" | "MEDIA_CORRUPT" | "OTHER";

export const DeadLetterQueueCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Core DLQ records, aggregated summary counters, and pagination
  const [dataState, setDataState] = useState<{
    items: QueueItem[];
    total: number;
    summary: DLQSummary | null;
    isLoading: boolean;
    page: number;
  }>({
    items: [],
    total: 0,
    summary: null,
    isLoading: true,
    page: 1,
  });

  // Hook 2: UI interactive filters, selection keys, in-flight action flags, feedback, and editing modal
  const [uiState, setUiState] = useState<{
    category: ErrorCategory;
    mediaType: string;
    search: string;
    selectedKeys: string[];
    actionInProgressId: number | string | null;
    isBulkActing: boolean;
    feedback: { message: string; isError?: boolean } | null;
    editingItem: { jobId: string; sourceMsgId: number; caption: string } | null;
    isSavingCaption: boolean;
  }>({
    category: "ALL",
    mediaType: "ALL",
    search: "",
    selectedKeys: [],
    actionInProgressId: null,
    isBulkActing: false,
    feedback: null,
    editingItem: null,
    isSavingCaption: false,
  });

  const itemKey = (jobId: string, msgId: number) => `${jobId}:${msgId}`;

  const loadDlq = async (
    page = dataState.page,
    cat = uiState.category,
    mType = uiState.mediaType,
    searchQuery = uiState.search
  ) => {
    setDataState((prev) => ({ ...prev, isLoading: true }));
    try {
      const limit = 50;
      const offset = (page - 1) * limit;

      const [res, summaryRes] = await Promise.all([
        jobsApi.fetchDLQ({
          limit,
          offset,
          errorCategory: cat,
          mediaType: mType,
          search: searchQuery,
        }),
        jobsApi.fetchDLQSummary(),
      ]);

      setDataState({
        items: res.items,
        total: res.total,
        summary: summaryRes,
        isLoading: false,
        page,
      });
      setUiState((prev) => ({ ...prev, selectedKeys: [] }));
    } catch (err: any) {
      setDataState((prev) => ({ ...prev, isLoading: false }));
      setUiState((prev) => ({
        ...prev,
        feedback: { message: err.message || "Error al cargar la DLQ", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadDlq(1, uiState.category, uiState.mediaType, uiState.search);
  }, [uiState.category, uiState.mediaType]);

  const showFeedback = (message: string, isError = false) => {
    setUiState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setUiState((prev) => ({ ...prev, feedback: null }));
    }, 4500);
  };

  const handleToggleSelect = (jobId: string, sourceMsgId: number) => {
    const key = itemKey(jobId, sourceMsgId);
    setUiState((prev) => {
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
    setUiState((prev) => {
      const allKeys = dataState.items.map((it) => itemKey(it.job_id, it.source_message_id));
      const allSelected = allKeys.length > 0 && allKeys.every((k) => prev.selectedKeys.includes(k));
      return {
        ...prev,
        selectedKeys: allSelected ? [] : allKeys,
      };
    });
  };

  const handleSingleRetry = async (jobId: string, sourceMsgId: number) => {
    setUiState((prev) => ({ ...prev, actionInProgressId: sourceMsgId }));
    try {
      await jobsApi.retrySingleItem(jobId, sourceMsgId);
      showFeedback(`Mensaje #${sourceMsgId} re-encolado con éxito para procesamiento.`);
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message, true);
    } finally {
      setUiState((prev) => ({ ...prev, actionInProgressId: null }));
    }
  };

  const handleSingleSkip = async (jobId: string, sourceMsgId: number) => {
    setUiState((prev) => ({ ...prev, actionInProgressId: sourceMsgId }));
    try {
      await jobsApi.skipSingleItem(jobId, sourceMsgId);
      showFeedback(`Mensaje #${sourceMsgId} marcado como omitido.`);
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message, true);
    } finally {
      setUiState((prev) => ({ ...prev, actionInProgressId: null }));
    }
  };

  const handleSaveCaption = async () => {
    if (!uiState.editingItem) return;
    setUiState((prev) => ({ ...prev, isSavingCaption: true }));
    try {
      await jobsApi.updateItemCaption(
        uiState.editingItem.jobId,
        uiState.editingItem.sourceMsgId,
        uiState.editingItem.caption
      );
      showFeedback(`Caption del mensaje #${uiState.editingItem.sourceMsgId} actualizado.`);
      setUiState((prev) => ({ ...prev, editingItem: null, isSavingCaption: false }));
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message, true);
      setUiState((prev) => ({ ...prev, isSavingCaption: false }));
    }
  };

  const handleBulkRetry = async () => {
    const selectedItems = dataState.items
      .filter((it) => uiState.selectedKeys.includes(itemKey(it.job_id, it.source_message_id)))
      .map((it) => ({ job_id: it.job_id, source_message_id: it.source_message_id }));

    if (selectedItems.length === 0) return;

    setUiState((prev) => ({ ...prev, isBulkActing: true }));
    try {
      const res = await jobsApi.bulkRetryDLQ(selectedItems);
      showFeedback(`Se re-encolaron ${res.retried_count} elementos exitosamente.`);
      setUiState((prev) => ({ ...prev, selectedKeys: [], isBulkActing: false }));
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message || "Error en el reintento por lote", true);
      setUiState((prev) => ({ ...prev, isBulkActing: false }));
    }
  };

  const handleBulkSkip = async () => {
    const selectedItems = dataState.items
      .filter((it) => uiState.selectedKeys.includes(itemKey(it.job_id, it.source_message_id)))
      .map((it) => ({ job_id: it.job_id, source_message_id: it.source_message_id }));

    if (selectedItems.length === 0) return;

    setUiState((prev) => ({ ...prev, isBulkActing: true }));
    try {
      const res = await jobsApi.bulkSkipDLQ(selectedItems);
      showFeedback(`Se omitieron ${res.skipped_count} elementos.`);
      setUiState((prev) => ({ ...prev, selectedKeys: [], isBulkActing: false }));
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message || "Error al omitir por lote", true);
      setUiState((prev) => ({ ...prev, isBulkActing: false }));
    }
  };

  // 1-Click Action by Filter
  const handle1ClickRetryFilter = async () => {
    setUiState((prev) => ({ ...prev, isBulkActing: true }));
    try {
      const res = await jobsApi.retryByFilterDLQ({
        errorCategory: uiState.category,
        mediaType: uiState.mediaType,
        search: uiState.search,
      });
      showFeedback(`Acción 1-Clic: ${res.retried_count} errores reintentados exitosamente.`);
      setUiState((prev) => ({ ...prev, isBulkActing: false }));
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message || "Error en reintento 1-clic", true);
      setUiState((prev) => ({ ...prev, isBulkActing: false }));
    }
  };

  const handle1ClickSkipFilter = async () => {
    setUiState((prev) => ({ ...prev, isBulkActing: true }));
    try {
      const res = await jobsApi.skipByFilterDLQ({
        errorCategory: uiState.category,
        mediaType: uiState.mediaType,
        search: uiState.search,
      });
      showFeedback(`Acción 1-Clic: ${res.skipped_count} errores omitidos.`);
      setUiState((prev) => ({ ...prev, isBulkActing: false }));
      loadDlq();
    } catch (err: any) {
      showFeedback(err.message || "Error al omitir por filtro", true);
      setUiState((prev) => ({ ...prev, isBulkActing: false }));
    }
  };

  const allVisibleKeys = dataState.items.map((it) => itemKey(it.job_id, it.source_message_id));
  const isAllSelected = allVisibleKeys.length > 0 && allVisibleKeys.every((k) => uiState.selectedKeys.includes(k));
  const selectedCount = uiState.selectedKeys.length;
  const summary = dataState.summary;

  const categoryPills: { id: ErrorCategory; label: string; count: number; color: string }[] = [
    { id: "ALL", label: "Todos", count: summary?.total_failed ?? dataState.total, color: "text-foreground" },
    { id: "FLOOD_WAIT", label: "FloodWait", count: summary?.by_category.FLOOD_WAIT ?? 0, color: "text-amber-500" },
    { id: "TIMEOUT_NETWORK", label: "Network / Timeout", count: summary?.by_category.TIMEOUT_NETWORK ?? 0, color: "text-blue-500" },
    { id: "PERMISSION_AUTH", label: "Permisos", count: summary?.by_category.PERMISSION_AUTH ?? 0, color: "text-rose-500" },
    { id: "MEDIA_CORRUPT", label: "Multimedia / Codec", count: summary?.by_category.MEDIA_CORRUPT ?? 0, color: "text-purple-500" },
    { id: "OTHER", label: "Otros", count: summary?.by_category.OTHER ?? 0, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Dead-Letter Queue (DLQ) &amp; Filtros de Recuperación
              </h2>
              <Badge variant="outline" className="font-mono text-[10px] text-rose-500 border-rose-500/30">
                {dataState.total} fallos
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Diagnostica fallos clasificados por causa raíz y recupera lotes en 1-clic.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDlq(dataState.page)}
          disabled={dataState.isLoading || uiState.isBulkActing}
          className="text-xs flex items-center gap-1.5 h-8"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", dataState.isLoading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* Semantic Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
        {categoryPills.map((pill) => {
          const isActive = uiState.category === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setUiState((prev) => ({ ...prev, category: pill.id }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              )}
            >
              <span>{pill.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-foreground"
                )}
              >
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar + 1-Click Action Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-secondary/20">
        <div className="flex items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={uiState.search}
              onChange={(e) => setUiState((prev) => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadDlq(1, uiState.category, uiState.mediaType, uiState.search);
              }}
              placeholder="Buscar por error, caption o ID..."
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            {uiState.search && (
              <button
                onClick={() => {
                  setUiState((prev) => ({ ...prev, search: "" }));
                  loadDlq(1, uiState.category, uiState.mediaType, "");
                }}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Media Type Select */}
          <select
            value={uiState.mediaType}
            onChange={(e) => setUiState((prev) => ({ ...prev, mediaType: e.target.value }))}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Todo Tipo de Media</option>
            <option value="video">Solo Videos</option>
            <option value="photo">Solo Fotos</option>
            <option value="document">Solo Documentos</option>
          </select>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => loadDlq(1, uiState.category, uiState.mediaType, uiState.search)}
            className="text-xs h-8 px-2.5"
          >
            Filtrar
          </Button>
        </div>

        {/* 1-Click Action Buttons for Active Filter */}
        {dataState.total > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={handle1ClickRetryFilter}
              disabled={uiState.isBulkActing}
              className="text-xs h-8 flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm"
              title="Reintentar todos los elementos que coinciden con los filtros actuales"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Reintentar Filtro ({dataState.total})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handle1ClickSkipFilter}
              disabled={uiState.isBulkActing}
              className="text-xs h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
              title="Omitir todos los elementos que coinciden con los filtros actuales"
            >
              <XCircle className="w-3.5 h-3.5" />
              Omitir Filtro ({dataState.total})
            </Button>
          </div>
        )}
      </div>

      {/* Manual Selection Floating Action Toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">
              {selectedCount} {selectedCount === 1 ? "elemento seleccionado" : "elementos seleccionados"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBulkRetry}
              disabled={uiState.isBulkActing}
              className="text-xs h-7 flex items-center gap-1.5 bg-primary text-primary-foreground"
            >
              <RotateCcw className="w-3 h-3" />
              Reintentar ({selectedCount})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkSkip}
              disabled={uiState.isBulkActing}
              className="text-xs h-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
            >
              <XCircle className="w-3 h-3" />
              Omitir ({selectedCount})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUiState((prev) => ({ ...prev, selectedKeys: [] }))}
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
            >
              Deseleccionar
            </Button>
          </div>
        </div>
      )}

      {/* Global Feedback Banner */}
      {uiState.feedback && (
        <div
          className={cn(
            "p-3 rounded-lg text-xs flex items-center gap-2 transition-all",
            uiState.feedback.isError
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {uiState.feedback.isError ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{uiState.feedback.message}</span>
        </div>
      )}

      {/* Main DLQ Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card/40">
        {dataState.isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            Cargando elementos de la DLQ...
          </div>
        ) : dataState.items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-xs font-semibold text-foreground">
              No hay elementos fallidos con los filtros actuales
            </h3>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Todos los mensajes se han migrado con éxito o han sido resueltos.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAllVisible}
                    aria-label="Seleccionar todos los visibles"
                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </TableHead>
                <TableHead className="w-20 font-mono text-[11px]">Msg ID</TableHead>
                <TableHead className="w-24 font-mono text-[11px]">Tipo</TableHead>
                <TableHead className="font-mono text-[11px]">Causa del Error</TableHead>
                <TableHead className="w-20 font-mono text-[11px] text-center">Reintentos</TableHead>
                <TableHead className="w-44 font-mono text-[11px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataState.items.map((item) => {
                const key = itemKey(item.job_id, item.source_message_id);
                const isSelected = uiState.selectedKeys.includes(key);
                const inProgress = uiState.actionInProgressId === item.source_message_id;

                return (
                  <TableRow
                    key={key}
                    className={cn(
                      "transition-colors text-xs",
                      isSelected && "bg-primary/5 dark:bg-primary/10"
                    )}
                  >
                    <TableCell className="text-center py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.job_id, item.source_message_id)}
                        aria-label={`Seleccionar mensaje ${item.source_message_id}`}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-foreground font-semibold py-2.5">
                      #{item.source_message_id}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {item.media_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 max-w-md">
                      <div className="space-y-0.5">
                        <span className="text-rose-500 dark:text-rose-400 font-mono text-[11px] block truncate" title={item.error_message || ""}>
                          {item.error_message || "Error desconocido"}
                        </span>
                        {item.caption && (
                          <span className="text-muted-foreground text-[10px] block truncate" title={item.caption}>
                            Caption: {item.caption}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono py-2.5">
                      {item.retry_count}
                    </TableCell>
                    <TableCell className="text-right py-2.5 space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setUiState((prev) => ({
                            ...prev,
                            editingItem: {
                              jobId: item.job_id,
                              sourceMsgId: item.source_message_id,
                              caption: item.caption,
                            },
                          }))
                        }
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Caption
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSingleRetry(item.job_id, item.source_message_id)}
                        disabled={inProgress}
                        className="h-7 text-[11px] px-2"
                      >
                        <RotateCcw className={cn("w-3 h-3 mr-1", inProgress && "animate-spin")} />
                        Reintentar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSingleSkip(item.job_id, item.source_message_id)}
                        disabled={inProgress}
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
      {uiState.editingItem && (
        <Dialog
          open={Boolean(uiState.editingItem)}
          onOpenChange={(open) => !open && setUiState((prev) => ({ ...prev, editingItem: null, isSavingCaption: false }))}
        >
          <DialogContent className="max-w-md bg-card border-border text-foreground p-4">
            <DialogHeader className="border-b border-border pb-2">
              <DialogTitle className="text-sm font-semibold font-mono">
                Editar Caption del Mensaje #{uiState.editingItem.sourceMsgId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Corregí el texto o eliminá links conflictivos antes de relanzar el post.
              </p>
              <textarea
                rows={4}
                value={uiState.editingItem.caption}
                onChange={(e) =>
                  setUiState((prev) => ({
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
                  onClick={() => setUiState((prev) => ({ ...prev, editingItem: null, isSavingCaption: false }))}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCaption}
                  disabled={uiState.isSavingCaption}
                  className="h-8 text-xs bg-primary text-primary-foreground"
                >
                  {uiState.isSavingCaption ? "Guardando..." : "Guardar Caption"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
