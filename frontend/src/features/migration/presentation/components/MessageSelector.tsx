import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Grid,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  Maximize2,
  MessageSquare,
  RefreshCw,
  Search,
  Square,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { ChannelMessageItem } from "../../domain/types";
import { Button } from "@/shared/components/ui/button";
import { MediaGallerySkeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { VideoSanitizerModal } from "./VideoSanitizerModal";
import { BatchSanitizerModal } from "./BatchSanitizerModal";
import { CreateAlbumModal } from "./CreateAlbumModal";

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface ThumbnailProps {
  channelId: number;
  messageId: number;
  mediaType: string | null;
  className?: string;
  fit?: "cover" | "contain";
}

const MessageThumbnailImage: React.FC<ThumbnailProps> = ({
  channelId,
  messageId,
  mediaType,
  className = "",
  fit = "cover",
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const isVisualMedia = mediaType === "video" || mediaType === "photo" || mediaType === "document";

  if (!isVisualMedia || error) {
    return (
      <div
        className={`w-full h-full bg-secondary/50 border border-border flex flex-col items-center justify-center text-muted-foreground ${className}`}
      >
        {mediaType === "video" ? (
          <Video className="w-5 h-5 text-purple-400/40 mb-0.5" />
        ) : mediaType === "photo" ? (
          <ImageIcon className="w-5 h-5 text-cyan-400/40 mb-0.5" />
        ) : mediaType === "document" ? (
          <FileText className="w-5 h-5 text-amber-400/40 mb-0.5" />
        ) : (
          <MessageSquare className="w-5 h-5 text-zinc-600/40 mb-0.5" />
        )}
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
          {mediaType || "texto"}
        </span>
      </div>
    );
  }

  const thumbUrl = `/api/channels/${channelId}/messages/${messageId}/thumbnail`;

  return (
    <div className={`relative w-full h-full bg-zinc-950 overflow-hidden flex items-center justify-center ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-900 animate-pulse flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-zinc-700 animate-spin" />
        </div>
      )}
      <img
        src={thumbUrl}
        alt={`Miniatura mensaje #${messageId}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full transition-opacity duration-300 ${
          fit === "contain" ? "object-contain" : "object-cover"
        } ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

export const MessageSelector: React.FC = () => {
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const sourceMessages = useMigrationStore((state) => state.sourceMessages);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);
  const isLoadingMessages = useMigrationStore((state) => state.isLoadingMessages);
  const hasMoreMessages = useMigrationStore((state) => state.hasMoreMessages);
  const isLoadingMoreMessages = useMigrationStore((state) => state.isLoadingMoreMessages);
  const clonedItems = useMigrationStore((state) => state.clonedContentItems);
  const syncStatus = useMigrationStore((state) => state.syncStatus);
  const isCheckingSync = useMigrationStore((state) => state.isCheckingSync);
  const isSyncingDelta = useMigrationStore((state) => state.isSyncingDelta);
  const fetchSourceMessages = useMigrationStore((state) => state.fetchSourceMessages);
  const loadMoreSourceMessages = useMigrationStore((state) => state.loadMoreSourceMessages);
  const toggleSelectMessage = useMigrationStore((state) => state.toggleSelectMessage);
  const selectAllMessages = useMigrationStore((state) => state.selectAllMessages);
  const deselectAllMessages = useMigrationStore((state) => state.deselectAllMessages);
  const checkSyncStatus = useMigrationStore((state) => state.checkSyncStatus);
  const startDeltaSync = useMigrationStore((state) => state.startDeltaSync);
  const selectOnlyMissingMessages = useMigrationStore((state) => state.selectOnlyMissingMessages);
  const channels = useMigrationStore((state) => state.channels);

  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Filter criteria state
  const [filterState, setFilterState] = useState<{
    type: string;
    sync: "all" | "missing" | "cloned";
    search: string;
  }>({
    type: "all",
    sync: "all",
    search: "",
  });

  // Hook 2: UI view mode and modal inspection states
  const [uiState, setUiState] = useState<{
    viewMode: "grid" | "list";
    previewModalMsg: ChannelMessageItem | null;
    sanitizerMsg: ChannelMessageItem | null;
    batchSanitizerOpen: boolean;
    createAlbumOpen: boolean;
  }>({
    viewMode: "grid",
    previewModalMsg: null,
    sanitizerMsg: null,
    batchSanitizerOpen: false,
    createAlbumOpen: false,
  });

  const selectedMessagesList = useMemo(() => {
    const idSet = new Set(selectedMessageIds);
    return sourceMessages.filter((m) => idSet.has(m.id));
  }, [sourceMessages, selectedMessageIds]);

  const clonedMsgIds = useMemo(() => new Set(clonedItems.map((c) => c.source_message_id)), [clonedItems]);

  const filteredMessages = useMemo(() => {
    return sourceMessages.filter((msg) => {
      if (filterState.type !== "all" && msg.media_type !== filterState.type) {
        return false;
      }
      const isCloned = msg.is_migrated || clonedMsgIds.has(msg.id);
      if (filterState.sync === "missing" && isCloned) {
        return false;
      }
      if (filterState.sync === "cloned" && !isCloned) {
        return false;
      }
      if (filterState.search.trim()) {
        const q = filterState.search.toLowerCase();
        const textMatch = msg.text.toLowerCase().includes(q);
        const idMatch = msg.id.toString().includes(q);
        if (!textMatch && !idMatch) return false;
      }
      return true;
    });
  }, [sourceMessages, filterState, clonedMsgIds]);

  // Only multimedia messages (video, photo, document) are traversed in the cinema preview
  const previewableMessages = useMemo(() => {
    return filteredMessages.filter((msg) => msg.media_type && msg.media_type !== "text");
  }, [filteredMessages]);

  // Lightbox gallery navigation indices (derived state, 0 extra useState hooks)
  const previewIndex = useMemo(() => {
    if (!uiState.previewModalMsg) return -1;
    return previewableMessages.findIndex((m) => m.id === uiState.previewModalMsg?.id);
  }, [previewableMessages, uiState.previewModalMsg]);

  const hasPrevPreview = previewIndex > 0;
  const hasNextPreview = previewIndex >= 0 && previewIndex < previewableMessages.length - 1;

  const handlePrevPreview = useCallback(() => {
    if (previewIndex > 0) {
      setUiState((prev) => ({
        ...prev,
        previewModalMsg: previewableMessages[previewIndex - 1],
      }));
    }
  }, [previewIndex, previewableMessages]);

  const handleNextPreview = useCallback(() => {
    if (previewIndex >= 0 && previewIndex < previewableMessages.length - 1) {
      setUiState((prev) => ({
        ...prev,
        previewModalMsg: previewableMessages[previewIndex + 1],
      }));
    }
  }, [previewIndex, previewableMessages]);

  useEffect(() => {
    if (!uiState.previewModalMsg) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevPreview();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextPreview();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setUiState((prev) => ({ ...prev, previewModalMsg: null }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiState.previewModalMsg, handlePrevPreview, handleNextPreview]);

  const countsByType = useMemo(() => {
    const counts = { all: sourceMessages.length, video: 0, photo: 0, document: 0, text: 0 };
    for (const m of sourceMessages) {
      if (m.media_type === "video") counts.video++;
      else if (m.media_type === "photo") counts.photo++;
      else if (m.media_type === "document") counts.document++;
      else counts.text++;
    }
    return counts;
  }, [sourceMessages]);

  const syncCounts = useMemo(() => {
    let cloned = 0;
    let missing = 0;
    for (const m of sourceMessages) {
      if (m.is_migrated || clonedMsgIds.has(m.id)) {
        cloned++;
      } else {
        missing++;
      }
    }
    return {
      cloned: syncStatus ? syncStatus.already_cloned_count : cloned,
      missing: syncStatus ? syncStatus.missing_count : missing,
    };
  }, [sourceMessages, clonedMsgIds, syncStatus]);

  const selectedSizeSum = useMemo(() => {
    return sourceMessages
      .filter((m) => selectedMessageIds.includes(m.id))
      .reduce((acc, curr) => acc + (curr.file_size || 0), 0);
  }, [sourceMessages, selectedMessageIds]);

  if (!selectedSourceId) {
    return (
      <div className="bg-card rounded-md border border-border p-4 shadow-sm space-y-4 flex flex-col min-h-[520px]">
        <div className="border-b border-border pb-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono">
              Mensajes, videos e imágenes del canal a copiar
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Elegí un canal de origen en el panel "De:" para cargar y previsualizar su contenido.
            </p>
          </div>
          <span className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded font-mono">
            Sin canal activo
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-border rounded-md bg-secondary/30">
          <div className="w-12 h-12 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Video className="w-6 h-6" />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-xs font-semibold text-foreground">
              Canal de origen no seleccionado
            </p>
            <p className="text-[11px] text-muted-foreground">
              Seleccioná un canal en el campo <span className="text-primary font-mono">De:</span> del panel izquierdo para explorar y elegir los mensajes antes de clonar.
            </p>
          </div>

          {/* Wireframe skeleton matching the 4-column cards layout */}
          <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-2 px-4 opacity-25 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-md border border-dashed border-white/20 bg-white/5 flex flex-col justify-between p-2"
              >
                <div className="w-4 h-4 rounded border border-white/20" />
                <div className="w-12 h-2 rounded bg-white/10 self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allFilteredSelected =
    filteredMessages.length > 0 &&
    filteredMessages.every((m) => selectedMessageIds.includes(m.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      deselectAllMessages();
    } else {
      selectAllMessages();
    }
  };

  const getTypeBadge = (type: string | null) => {
    switch (type) {
      case "video":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
            <Video className="w-2.5 h-2.5" />
            <span className="hidden xs:inline">Video</span>
          </span>
        );
      case "photo":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
            <ImageIcon className="w-2.5 h-2.5" />
            <span className="hidden xs:inline">Foto</span>
          </span>
        );
      case "document":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            <FileText className="w-2.5 h-2.5" />
            <span className="hidden xs:inline">Archivo</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-white/5 shrink-0">
            <MessageSquare className="w-2.5 h-2.5" />
            <span className="hidden xs:inline">Texto</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-card rounded-md border border-border p-3 sm:p-3.5 shadow-sm flex flex-col h-full min-h-0 overflow-hidden space-y-2.5">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 border-b border-border pb-2.5 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground font-mono truncate">
              Mensajes y multimedia del canal
            </h2>
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-mono shrink-0">
              {selectedMessageIds.length > 0
                ? `${selectedMessageIds.length} selec. (${formatBytes(selectedSizeSum)})`
                : `${filteredMessages.length} elementos`}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 hidden xs:block">
            Hacé click en cada miniatura para seleccionarlo o previsualizarlo antes de migrar.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted/80 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setUiState((prev) => ({ ...prev, viewMode: "grid" }))}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                uiState.viewMode === "grid"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista Cuadrícula Visual"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Galería</span>
            </button>
            <button
              onClick={() => setUiState((prev) => ({ ...prev, viewMode: "list" }))}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                uiState.viewMode === "list"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista Lista Compacta"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Lista</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSourceMessages(selectedSourceId)}
            disabled={isLoadingMessages}
            className="h-7.5 px-2 text-xs text-muted-foreground hover:text-foreground border border-border"
            title="Recargar mensajes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? "animate-spin text-primary" : ""}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleSelectAll}
            disabled={filteredMessages.length === 0}
            className="h-7.5 px-2.5 text-xs border-border text-foreground hover:bg-muted"
          >
            {allFilteredSelected ? (
              <>
                <Square className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <span>Desmarcar ({filteredMessages.length})</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 mr-1 text-primary" />
                <span>Marcar ({filteredMessages.length})</span>
              </>
            )}
          </Button>

          {selectedMessageIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUiState((prev) => ({ ...prev, createAlbumOpen: true }))}
                className={cn(
                  "h-7.5 px-2.5 text-xs font-mono gap-1.5 shadow-sm transition-all",
                  selectedMessageIds.length >= 2 && selectedMessageIds.length <= 10
                    ? "border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                    : "border-border text-muted-foreground opacity-80"
                )}
                title={
                  selectedMessageIds.length < 2
                    ? "Seleccioná al menos 2 elementos para crear un álbum"
                    : selectedMessageIds.length > 10
                    ? "Telegram permite un máximo de 10 elementos por álbum"
                    : "Agrupar en álbum con pie de foto / hashtag compartido"
                }
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Agrupar Álbum ({selectedMessageIds.length})</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setUiState((prev) => ({ ...prev, batchSanitizerOpen: true }))}
                className="h-7.5 px-2.5 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/10 font-mono gap-1.5 shadow-sm"
                title="Quitar marcas de agua en lote con FFmpeg e IA para todos los elementos seleccionados"
              >
                <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Quitar Marcas ({selectedMessageIds.length})</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delta Sync Banner (incremental sync between source and target) */}
      {selectedTargetId && selectedSourceId && selectedTargetId !== selectedSourceId && (
        <div className="shrink-0 rounded-lg border border-border bg-secondary/50 p-2 sm:p-2.5 shadow-sm">
          {isCheckingSync ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono py-0.5">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              <span>Comprobando novedades en canal origen contra destino...</span>
            </div>
          ) : syncStatus?.is_in_sync ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Canales 100% sincronizados ({syncStatus.already_cloned_count} mensajes en destino). No hay novedades pendientes.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkSyncStatus()}
                disabled={isCheckingSync}
                className="h-6.5 px-2 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Recomprobar
              </Button>
            </div>
          ) : syncStatus && syncStatus.missing_count > 0 ? (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Novedades detectadas: {syncStatus.missing_count} mensajes nuevos
                  </span>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full font-mono shrink-0">
                    ✓ {syncStatus.already_cloned_count} ya clonados
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Se detectaron mensajes nuevos publicados después de la última clonación. Podés clonar solo las novedades sin duplicar contenido.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectOnlyMissingMessages}
                  className="h-7.5 text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 font-mono w-full sm:w-auto"
                  title="Marca en la galería solo los mensajes faltantes"
                >
                  Seleccionar novedades
                </Button>
                <Button
                  size="sm"
                  onClick={startDeltaSync}
                  disabled={isSyncingDelta}
                  className="h-7.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md font-mono w-full sm:w-auto"
                >
                  {isSyncingDelta ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      <span className="truncate">Sincronizar novedades (+{syncStatus.missing_count})</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono py-0.5">
              <span>Sincronización lista para verificar.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkSyncStatus()}
                className="h-6 px-2 text-[11px] text-cyan-400 hover:bg-white/5"
              >
                Comprobar diferencias
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Section */}
      <div className="shrink-0 space-y-1.5">
        {/* Row 1: Sync Status Filters (only shown when target channel is selected) */}
        {selectedTargetId && (
          <div className="grid grid-cols-3 gap-1 bg-secondary/60 p-0.5 rounded-lg border border-border w-full">
            <button
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, sync: "all" }))}
              className={cn(
                "py-1 px-1.5 rounded-md text-[11px] font-mono transition-all text-center flex items-center justify-center gap-1",
                filterState.sync === "all"
                  ? "bg-card text-foreground font-semibold shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Todos</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, sync: "missing" }))}
              className={cn(
                "py-1 px-1.5 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1",
                filterState.sync === "missing"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold shadow-sm"
                  : "text-amber-600/80 dark:text-amber-400/80 hover:text-amber-600 dark:hover:text-amber-300"
              )}
            >
              <span>★ Novedades</span>
              <span className="text-[10px] px-1 rounded bg-amber-500/10 font-bold">{syncCounts.missing}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, sync: "cloned" }))}
              className={cn(
                "py-1 px-1.5 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1",
                filterState.sync === "cloned"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-semibold shadow-sm"
                  : "text-emerald-600/80 dark:text-emerald-400/80 hover:text-emerald-600 dark:hover:text-emerald-300"
              )}
            >
              <span>✓ Clonados</span>
              <span className="text-[10px] px-1 rounded bg-emerald-500/10 font-bold">{syncCounts.cloned}</span>
            </button>
          </div>
        )}

        {/* Row 2: Type Filters & Search */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 justify-between">
          {/* 5-Column Type filters (fills 100% width evenly on mobile & tablet without clipping) */}
          <div className="grid grid-cols-5 gap-1 bg-secondary/60 p-0.5 rounded-lg border border-border w-full xl:flex-1">
            {[
              { id: "all", label: "Todos", shortLabel: "Todos", count: countsByType.all },
              { id: "video", label: "Videos", shortLabel: "Videos", count: countsByType.video },
              { id: "photo", label: "Fotos", shortLabel: "Fotos", count: countsByType.photo },
              { id: "document", label: "Archivos", shortLabel: "Docs", count: countsByType.document },
              { id: "text", label: "Texto", shortLabel: "Texto", count: countsByType.text },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setFilterState((prev) => ({ ...prev, type: item.id }))}
                className={cn(
                  "py-1 px-0.5 sm:px-1.5 rounded-md text-[10px] sm:text-[11px] font-mono transition-all flex items-center justify-center gap-0.5 sm:gap-1 min-w-0 text-center h-7",
                  filterState.type === item.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={`${item.label} (${item.count})`}
              >
                <span className="hidden sm:inline truncate">{item.label}</span>
                <span className="sm:hidden truncate">{item.shortLabel}</span>
                <span
                  className={cn(
                    "text-[9px] sm:text-[10px] opacity-80 shrink-0",
                    filterState.type === item.id ? "text-primary-foreground/90 font-bold" : ""
                  )}
                >
                  ({item.count})
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full xl:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por texto o #ID..."
              value={filterState.search}
              onChange={(e) => setFilterState((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full bg-secondary/60 border border-border rounded-lg pl-8 pr-3 py-0.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary h-7"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Gallery Grid or List */}
      {isLoadingMessages ? (
        <MediaGallerySkeleton count={12} />
      ) : filteredMessages.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center py-10 text-center text-muted-foreground text-xs bg-secondary/40 rounded-md border border-border font-mono">
          No se encontraron mensajes con los filtros seleccionados.
        </div>
      ) : uiState.viewMode === "grid" ? (
        /* VISUAL GALLERY GRID (Responsive columns taking full advantage of widescreen) */
        <div className="flex-1 min-h-0 overflow-y-auto p-1 pr-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6 gap-2 sm:gap-2.5">
            {filteredMessages.map((msg) => {
              const isSelected = selectedMessageIds.includes(msg.id);
              const sizeStr = formatBytes(msg.file_size);

              return (
                <div
                  key={msg.id}
                  onClick={() => toggleSelectMessage(msg.id)}
                  className={`group relative rounded-md border overflow-hidden cursor-pointer select-none transition-all duration-200 w-full aspect-[16/10] min-h-[96px] sm:min-h-[105px] flex flex-col justify-between ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/20 scale-[0.99]"
                      : "border-border hover:border-primary/40 bg-card hover:shadow-md"
                  }`}
                >
                {/* Media Image / Thumbnail */}
                <div className="absolute inset-0 z-0">
                  <MessageThumbnailImage
                    channelId={selectedSourceId}
                    messageId={msg.id}
                    mediaType={msg.media_type}
                  />
                  {/* Subtle vignette for legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Top overlay: Checkbox + Type Badge */}
                <div className="relative z-10 p-1.5 flex items-center justify-between">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : "bg-black/60 border border-white/30 text-transparent group-hover:border-white"
                    }`}
                  >
                    <Check className={`w-2.5 h-2.5 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                  </div>

                  <div className="flex items-center gap-1">
                    {msg.is_migrated || clonedMsgIds.has(msg.id) ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/25 text-emerald-300 border border-emerald-500/35" title="Este mensaje ya fue clonado previamente">
                        ✓ Clonado
                      </span>
                    ) : selectedTargetId ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/35" title="Novedad: mensaje nuevo aún no clonado">
                        ★ Novedad
                      </span>
                    ) : null}
                    {getTypeBadge(msg.media_type)}
                  </div>
                </div>

                {/* Center Hover Action: Zoom Preview & Delogo */}
                <div className="relative z-10 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUiState((prev) => ({ ...prev, previewModalMsg: msg }));
                    }}
                    className="p-1.5 rounded-full bg-black/70 border border-white/20 text-white hover:bg-primary hover:text-primary-foreground transition-colors"
                    title="Previsualizar mensaje completo"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                  {(msg.media_type === "video" || msg.media_type === "photo") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUiState((prev) => ({ ...prev, sanitizerMsg: msg }));
                      }}
                      className="p-1.5 rounded-full bg-purple-900/80 border border-purple-400/40 text-purple-200 hover:bg-purple-600 hover:text-white transition-colors"
                      title="Quitar marca de agua con FFmpeg e IA"
                    >
                      <Wand2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Bottom overlay: Message info & Size */}
                <div className="relative z-10 p-1.5 space-y-0.5 text-left">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300">
                    <span className="font-semibold text-zinc-100">#{msg.id}</span>
                    {sizeStr && (
                      <span className="bg-background/80 px-1.5 py-0.2 rounded text-[10px] text-primary border border-border">
                        {sizeStr}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-200 truncate leading-tight">
                    {msg.text || <span className="text-zinc-400 italic">[Multimedia sin texto]</span>}
                  </p>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        /* COMPACT TABLE / LIST VIEW */
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1.5 border border-border rounded-md bg-secondary/40 divide-y divide-border/40">
          {filteredMessages.map((msg) => {
            const isSelected = selectedMessageIds.includes(msg.id);
            const sizeStr = formatBytes(msg.file_size);

            return (
              <div
                key={msg.id}
                onClick={() => toggleSelectMessage(msg.id)}
                className={`flex items-center gap-3 p-2.5 px-3 text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? "bg-primary/10 hover:bg-primary/15 text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                  }`}
                >
                  <Check className={`w-3 h-3 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                </div>

                {/* Mini thumb thumbnail preview in list mode */}
                <div className="w-9 h-9 rounded-md overflow-hidden bg-secondary shrink-0 border border-border relative">
                  <MessageThumbnailImage
                    channelId={selectedSourceId}
                    messageId={msg.id}
                    mediaType={msg.media_type}
                  />
                </div>

                <span className="font-mono text-[11px] text-muted-foreground w-12 shrink-0">
                  #{msg.id}
                </span>

                <div className="shrink-0 flex items-center gap-1.5 w-auto sm:w-40">
                  {msg.is_migrated || clonedMsgIds.has(msg.id) ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-emerald-500/25 text-emerald-300 border border-emerald-500/35">
                      ✓ Clonado
                    </span>
                  ) : selectedTargetId ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/35">
                      ★ Novedad
                    </span>
                  ) : null}
                  {getTypeBadge(msg.media_type)}
                </div>

                <div className="flex-1 truncate text-xs min-w-0">
                  {msg.text ? (
                    <span className="text-foreground">{msg.text}</span>
                  ) : (
                    <span className="text-muted-foreground italic">[Sin descripción]</span>
                  )}
                </div>

                {sizeStr && (
                  <span className="text-[10px] font-mono text-primary shrink-0 bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 hidden xs:inline">
                    {sizeStr}
                  </span>
                )}

                <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden md:inline">
                  {msg.date}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  {(msg.media_type === "video" || msg.media_type === "photo") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUiState((prev) => ({ ...prev, sanitizerMsg: msg }));
                      }}
                      className="p-1 rounded text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                      title="Quitar marca de agua con FFmpeg e IA"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUiState((prev) => ({ ...prev, previewModalMsg: msg }));
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Ver detalles"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {hasMoreMessages && (
        <div className="shrink-0 pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border">
          <span className="text-[11px] font-mono text-muted-foreground">
            Mostrando {filteredMessages.length} mensajes (cargados {sourceMessages.length} de este canal)
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoadingMoreMessages}
            onClick={() => loadMoreSourceMessages()}
            className="flex items-center gap-1.5 h-8 px-4 text-xs font-semibold bg-secondary border border-border hover:bg-secondary/80 hover:border-primary/40 text-foreground hover:text-primary transition-all"
          >
            {isLoadingMoreMessages ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Cargando más mensajes...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 text-primary" />
                Cargar más mensajes (+100)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Immersive Cinema Fullscreen Media Viewer (Overlay-first experience) */}
      {uiState.previewModalMsg &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200"
            onClick={() => setUiState((prev) => ({ ...prev, previewModalMsg: null }))}
          >
            {/* Top Floating Glass Header Bar */}
            <div
              className="relative z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent backdrop-blur-sm border-b border-white/10 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white font-mono tracking-wide">
                  Mensaje #{uiState.previewModalMsg.id}
                </span>
                {getTypeBadge(uiState.previewModalMsg.media_type)}
                {previewIndex >= 0 && (
                  <span className="text-xs font-mono text-zinc-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                    {previewIndex + 1} de {previewableMessages.length}
                  </span>
                )}
                {clonedMsgIds.has(uiState.previewModalMsg.id) && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Ya clonado</span>
                  </span>
                )}
              </div>

              {/* Top Right Quick Actions */}
              <div className="flex items-center gap-2">
                {/* Select / Deselect Button */}
                <Button
                  variant={selectedMessageIds.includes(uiState.previewModalMsg.id) ? "destructive" : "default"}
                  size="sm"
                  onClick={() => {
                    if (!uiState.previewModalMsg) return;
                    toggleSelectMessage(uiState.previewModalMsg.id);
                  }}
                  className="h-8 text-xs px-3.5 font-mono gap-1.5 shadow-lg backdrop-blur-sm"
                >
                  {selectedMessageIds.includes(uiState.previewModalMsg.id) ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Desmarcar</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Seleccionar para clonar</span>
                    </>
                  )}
                </Button>

                {/* FFmpeg Sanitizer Button */}
                {(uiState.previewModalMsg.media_type === "video" || uiState.previewModalMsg.media_type === "photo") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const target = uiState.previewModalMsg;
                      setUiState((prev) => ({ ...prev, previewModalMsg: null, sanitizerMsg: target }));
                    }}
                    className="h-8 text-xs px-3 border-purple-500/40 text-purple-200 hover:bg-purple-600/30 gap-1.5 font-mono bg-purple-950/40"
                    title="Quitar Marca de agua con FFmpeg"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-purple-300" />
                    <span className="hidden sm:inline">Quitar Marca</span>
                  </Button>
                )}

                <div className="w-[1px] h-5 bg-white/20 mx-1 hidden sm:block" />

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, previewModalMsg: null }))}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/25 text-zinc-300 hover:text-white transition-all border border-white/10"
                  title="Cerrar visor (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Central Full-Screen Media Stage with Floating Navigation Chevrons */}
            <div
              className="relative flex-1 min-h-0 w-full flex items-center justify-center p-2 sm:p-6 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Floating Chevron */}
              {hasPrevPreview && (
                <button
                  type="button"
                  onClick={handlePrevPreview}
                  className="absolute left-3 sm:left-6 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 hover:border-primary/60 transition-all hover:scale-110 shadow-2xl backdrop-blur-md"
                  title="Elemento anterior (Flecha Izquierda ←)"
                >
                  <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>
              )}

              {/* Right Floating Chevron */}
              {hasNextPreview && (
                <button
                  type="button"
                  onClick={handleNextPreview}
                  className="absolute right-3 sm:right-6 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 hover:border-primary/60 transition-all hover:scale-110 shadow-2xl backdrop-blur-md"
                  title="Siguiente elemento (Flecha Derecha →)"
                >
                  <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>
              )}

              {/* Center Media: takes maximum viewport height & width */}
              <div className="relative max-w-full max-h-full flex items-center justify-center">
                {uiState.previewModalMsg.media_type === "video" ? (
                  <video
                    key={uiState.previewModalMsg.id}
                    src={`/api/channels/${selectedSourceId}/messages/${uiState.previewModalMsg.id}/video`}
                    poster={`/api/channels/${selectedSourceId}/messages/${uiState.previewModalMsg.id}/thumbnail`}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[78vh] sm:max-h-[82vh] w-auto max-w-[94vw] object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="max-h-[78vh] sm:max-h-[82vh] max-w-[94vw] flex items-center justify-center">
                    <MessageThumbnailImage
                      key={uiState.previewModalMsg.id}
                      channelId={selectedSourceId}
                      messageId={uiState.previewModalMsg.id}
                      mediaType={uiState.previewModalMsg.media_type}
                      fit="contain"
                      className="max-h-[78vh] sm:max-h-[82vh] w-auto max-w-[94vw] object-contain rounded-lg shadow-2xl"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Floating Glass Footer Bar (Caption, Metadata & Shortcuts) */}
            <div
              className="relative z-50 px-4 py-3 bg-gradient-to-t from-black/95 via-black/75 to-transparent backdrop-blur-md border-t border-white/10 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Caption / Description */}
                <div className="min-w-0 flex-1">
                  {uiState.previewModalMsg.text ? (
                    <p className="text-xs text-zinc-200 line-clamp-2 hover:line-clamp-none transition-all cursor-pointer font-sans leading-relaxed bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg max-h-24 overflow-y-auto">
                      {uiState.previewModalMsg.text}
                    </p>
                  ) : (
                    <span className="text-[11px] text-zinc-500 italic font-mono">
                      Multimedia sin texto
                    </span>
                  )}
                </div>

                {/* Metadata & Shortcuts */}
                <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-zinc-400">
                  {uiState.previewModalMsg.file_size && (
                    <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[11px]">
                      {formatBytes(uiState.previewModalMsg.file_size)}
                    </span>
                  )}
                  {uiState.previewModalMsg.date && (
                    <span className="hidden md:inline text-[11px] text-zinc-400">
                      {uiState.previewModalMsg.date}
                    </span>
                  )}
                  <span className="hidden sm:inline-block text-[11px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    ← → Navegar | Esc Salir
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Video / Photo Sanitizer Modal */}
      {selectedSourceId && uiState.sanitizerMsg && (
        <VideoSanitizerModal
          isOpen={Boolean(uiState.sanitizerMsg)}
          onClose={() => setUiState((prev) => ({ ...prev, sanitizerMsg: null }))}
          message={uiState.sanitizerMsg}
          sourceChannelId={selectedSourceId}
          channels={channels}
          selectedTargetId={selectedTargetId}
        />
      )}

      {/* Batch Watermark Sanitizer Modal */}
      {selectedSourceId && uiState.batchSanitizerOpen && (
        <BatchSanitizerModal
          isOpen={uiState.batchSanitizerOpen}
          onClose={() => setUiState((prev) => ({ ...prev, batchSanitizerOpen: false }))}
          selectedMessageIds={selectedMessageIds}
          sourceChannelId={selectedSourceId}
          channels={channels}
          selectedTargetId={selectedTargetId}
        />
      )}

      {/* Create & Publish Telegram Album (MediaGroup) Modal */}
      {selectedSourceId && uiState.createAlbumOpen && (
        <CreateAlbumModal
          isOpen={uiState.createAlbumOpen}
          onClose={() => setUiState((prev) => ({ ...prev, createAlbumOpen: false }))}
          sourceChannelId={selectedSourceId}
          selectedMessages={selectedMessagesList}
          channels={channels}
          selectedTargetId={selectedTargetId}
          onSuccess={() => {
            deselectAllMessages();
            if (selectedTargetId) {
              checkSyncStatus();
            }
          }}
        />
      )}
    </div>
  );
};
