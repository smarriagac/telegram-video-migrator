import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckSquare,
  Eye,
  FileText,
  Grid,
  Image as ImageIcon,
  List,
  Loader2,
  Maximize2,
  MessageSquare,
  RefreshCw,
  Search,
  Square,
  Video,
  X,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { ChannelMessageItem } from "../../domain/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

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
        className={`w-full h-full bg-[#12141a] border border-zinc-800/60 flex flex-col items-center justify-center text-zinc-600 ${className}`}
      >
        {mediaType === "video" ? (
          <Video className="w-8 h-8 text-purple-400/40 mb-1" />
        ) : mediaType === "photo" ? (
          <ImageIcon className="w-8 h-8 text-cyan-400/40 mb-1" />
        ) : mediaType === "document" ? (
          <FileText className="w-8 h-8 text-amber-400/40 mb-1" />
        ) : (
          <MessageSquare className="w-8 h-8 text-zinc-600/40 mb-1" />
        )}
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
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

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterState, setFilterState] = useState<{
    type: string;
    sync: "all" | "missing" | "cloned";
    search: string;
  }>({
    type: "all",
    sync: "all",
    search: "",
  });
  const [previewModalMsg, setPreviewModalMsg] = useState<ChannelMessageItem | null>(null);

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
      <div className="bg-[#0e1015] rounded-xl border border-zinc-800 p-4 shadow-sm space-y-4 flex flex-col min-h-[520px]">
        <div className="border-b border-zinc-800 pb-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100 font-mono">
              Mensajes, videos e imágenes del canal a copiar
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Elegí un canal de origen en el panel "De:" para cargar y previsualizar su contenido.
            </p>
          </div>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded font-mono">
            Sin canal activo
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-white/10 rounded-xl bg-black/20">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Video className="w-6 h-6" />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-xs font-semibold text-zinc-200">
              Canal de origen no seleccionado
            </p>
            <p className="text-[11px] text-zinc-400">
              Seleccioná un canal en el campo <span className="text-cyan-400 font-mono">De:</span> del panel izquierdo para explorar y elegir los mensajes antes de clonar.
            </p>
          </div>

          {/* Wireframe skeleton matching the 4-column cards layout */}
          <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-2 px-4 opacity-25 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col justify-between p-2"
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
    <div className="bg-[#0e1015] rounded-xl border border-zinc-800 p-3 sm:p-3.5 shadow-sm flex flex-col h-full min-h-0 overflow-hidden space-y-2.5">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 border-b border-zinc-800 pb-2.5 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-zinc-100 font-mono truncate">
              Mensajes y multimedia del canal
            </h2>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono shrink-0">
              {selectedMessageIds.length > 0
                ? `${selectedMessageIds.length} selec. (${formatBytes(selectedSizeSum)})`
                : `${filteredMessages.length} elementos`}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 hidden xs:block">
            Hacé click en cada miniatura para seleccionarlo o previsualizarlo antes de migrar.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                viewMode === "grid"
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Vista Cuadrícula Visual"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Galería</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                viewMode === "list"
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
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
            className="h-8 px-2 sm:px-2.5 text-xs text-zinc-400 hover:text-zinc-200 border border-white/5"
            title="Recargar mensajes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleSelectAll}
            disabled={filteredMessages.length === 0}
            className="h-8 px-2.5 sm:px-3 text-xs border-white/10 text-zinc-200 hover:bg-white/5"
          >
            {allFilteredSelected ? (
              <>
                <Square className="w-3.5 h-3.5 mr-1 sm:mr-1.5 text-zinc-400" />
                <span>Desmarcar ({filteredMessages.length})</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 mr-1 sm:mr-1.5 text-cyan-400" />
                <span>Marcar ({filteredMessages.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Delta Sync Banner (incremental sync between source and target) */}
      {selectedTargetId && selectedSourceId && selectedTargetId !== selectedSourceId && (
        <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 shadow-sm">
          {isCheckingSync ? (
            <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono py-1">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Comprobando novedades en canal origen contra destino...</span>
            </div>
          ) : syncStatus?.is_in_sync ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Canales 100% sincronizados ({syncStatus.already_cloned_count} mensajes en destino). No hay novedades pendientes.</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkSyncStatus()}
                disabled={isCheckingSync}
                className="h-7 px-2.5 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Recomprobar
              </Button>
            </div>
          ) : syncStatus && syncStatus.missing_count > 0 ? (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="space-y-1 min-w-0">
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
                  className="h-8 text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 font-mono w-full sm:w-auto"
                  title="Marca en la galería solo los mensajes faltantes"
                >
                  Seleccionar novedades
                </Button>
                <Button
                  size="sm"
                  onClick={startDeltaSync}
                  disabled={isSyncingDelta}
                  className="h-8 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-md shadow-cyan-950/40 font-mono w-full sm:w-auto"
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
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono py-1">
              <span>Sincronización lista para verificar.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkSyncStatus()}
                className="h-7 px-2 text-[11px] text-cyan-400 hover:bg-white/5"
              >
                Comprobar diferencias
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Section */}
      <div className="shrink-0 space-y-2">
        {/* Row 1: Sync Status Filters (only shown when target channel is selected) */}
        {selectedTargetId && (
          <div className="grid grid-cols-3 gap-1 bg-zinc-950/80 p-0.5 rounded-lg border border-white/5 w-full">
            <button
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, sync: "all" }))}
              className={cn(
                "py-1.5 px-2 rounded-md text-[11px] font-mono transition-all text-center flex items-center justify-center gap-1",
                filterState.sync === "all"
                  ? "bg-zinc-800 text-white font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>Todos</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, sync: "missing" }))}
              className={cn(
                "py-1.5 px-2 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1",
                filterState.sync === "missing"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                  : "text-amber-400/80 hover:text-amber-300"
              )}
            >
              <span>★ Novedades</span>
              <span className="text-[10px] px-1 rounded bg-amber-500/10 font-bold">{syncCounts.missing}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, sync: "cloned" }))}
              className={cn(
                "py-1.5 px-2 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1",
                filterState.sync === "cloned"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm"
                  : "text-emerald-400/80 hover:text-emerald-300"
              )}
            >
              <span>✓ Clonados</span>
              <span className="text-[10px] px-1 rounded bg-emerald-500/10 font-bold">{syncCounts.cloned}</span>
            </button>
          </div>
        )}

        {/* Row 2: Type Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-between">
          {/* Type filters */}
          <div className="flex items-center gap-1 bg-zinc-950/80 p-0.5 rounded-lg border border-white/5 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {[
              { id: "all", label: "Todos", count: countsByType.all },
              { id: "video", label: "Videos", count: countsByType.video },
              { id: "photo", label: "Fotos", count: countsByType.photo },
              { id: "document", label: "Archivos", count: countsByType.document },
              { id: "text", label: "Texto", count: countsByType.text },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setFilterState((prev) => ({ ...prev, type: item.id }))}
                className={cn(
                  "flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1 shrink-0 whitespace-nowrap",
                  filterState.type === item.id
                    ? "bg-cyan-500 text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "text-[10px] opacity-80",
                    filterState.type === item.id ? "text-black/80 font-bold" : ""
                  )}
                >
                  ({item.count})
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-48 xl:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por texto o #ID..."
              value={filterState.search}
              onChange={(e) => setFilterState((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full bg-[#0E1017] border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 h-8"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Gallery Grid or List */}
      {isLoadingMessages ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2.5 py-14 text-center text-zinc-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="font-mono text-zinc-400">Escaneando multimedia y generando miniaturas...</span>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center py-10 text-center text-zinc-500 text-xs bg-[#0E1017] rounded-xl border border-white/5 font-mono">
          No se encontraron mensajes con los filtros seleccionados.
        </div>
      ) : viewMode === "grid" ? (
        /* VISUAL GALLERY GRID (Responsive columns taking full advantage of widescreen) */
        <div className="flex-1 min-h-0 overflow-y-auto p-1 pr-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
            {filteredMessages.map((msg) => {
              const isSelected = selectedMessageIds.includes(msg.id);
              const sizeStr = formatBytes(msg.file_size);

              return (
                <div
                  key={msg.id}
                  onClick={() => toggleSelectMessage(msg.id)}
                  className={`group relative rounded-xl border overflow-hidden cursor-pointer select-none transition-all duration-200 w-full aspect-[4/3] min-h-[140px] flex flex-col justify-between ${
                    isSelected
                      ? "border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-950/30 scale-[0.99]"
                      : "border-white/5 hover:border-white/20 bg-zinc-950 hover:shadow-md"
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
                <div className="relative z-10 p-2 flex items-center justify-between">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-cyan-500 text-black shadow-md scale-105"
                        : "bg-black/60 border border-white/30 text-transparent group-hover:border-white"
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
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

                {/* Center Hover Action: Zoom Preview */}
                <div className="relative z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewModalMsg(msg);
                    }}
                    className="p-1.5 rounded-full bg-black/70 border border-white/20 text-white hover:bg-cyan-500 hover:text-black transition-colors"
                    title="Previsualizar mensaje completo"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Bottom overlay: Message info & Size */}
                <div className="relative z-10 p-2 space-y-0.5 text-left">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300">
                    <span className="font-semibold text-zinc-200">#{msg.id}</span>
                    {sizeStr && (
                      <span className="bg-black/70 px-1.5 py-0.2 rounded text-[10px] text-cyan-300 border border-white/10">
                        {sizeStr}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-300 truncate leading-tight">
                    {msg.text || <span className="text-zinc-500 italic">[Multimedia sin texto]</span>}
                  </p>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        /* COMPACT TABLE / LIST VIEW */
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1.5 border border-white/5 rounded-xl bg-[#0E1017]/80 divide-y divide-white/[0.03]">
          {filteredMessages.map((msg) => {
            const isSelected = selectedMessageIds.includes(msg.id);
            const sizeStr = formatBytes(msg.file_size);

            return (
              <div
                key={msg.id}
                onClick={() => toggleSelectMessage(msg.id)}
                className={`flex items-center gap-3 p-2.5 px-3 text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? "bg-cyan-950/20 hover:bg-cyan-950/30 text-white"
                    : "hover:bg-white/[0.02] text-zinc-400"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "bg-cyan-500 text-black" : "border border-zinc-700 bg-zinc-900"
                  }`}
                >
                  <Check className={`w-3 h-3 stroke-[3] ${isSelected ? "opacity-100" : "opacity-0"}`} />
                </div>

                {/* Mini thumb thumbnail preview in list mode */}
                <div className="w-9 h-9 rounded-md overflow-hidden bg-zinc-900 shrink-0 border border-white/10 relative">
                  <MessageThumbnailImage
                    channelId={selectedSourceId}
                    messageId={msg.id}
                    mediaType={msg.media_type}
                  />
                </div>

                <span className="font-mono text-[11px] text-zinc-500 w-12 shrink-0">
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
                    <span className="text-zinc-200">{msg.text}</span>
                  ) : (
                    <span className="text-zinc-600 italic">[Sin descripción]</span>
                  )}
                </div>

                {sizeStr && (
                  <span className="text-[10px] font-mono text-cyan-400/90 shrink-0 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/20 hidden xs:inline">
                    {sizeStr}
                  </span>
                )}

                <span className="text-[10px] font-mono text-zinc-500 shrink-0 hidden md:inline">
                  {msg.date}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewModalMsg(msg);
                  }}
                  className="p-1 rounded text-zinc-500 hover:text-white transition-colors"
                  title="Ver detalles"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {hasMoreMessages && (
        <div className="shrink-0 pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5">
          <span className="text-[11px] font-mono text-zinc-500">
            Mostrando {filteredMessages.length} mensajes (cargados {sourceMessages.length} de este canal)
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoadingMoreMessages}
            onClick={() => loadMoreSourceMessages()}
            className="flex items-center gap-1.5 h-8 px-4 text-xs font-semibold bg-zinc-900 border border-white/10 hover:border-cyan-500/40 hover:text-cyan-400 transition-all"
          >
            {isLoadingMoreMessages ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                Cargando más mensajes...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                Cargar más mensajes (+100)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Lightbox / Details Modal */}
      {previewModalMsg &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewModalMsg(null)}
          >
            <div
              className="bg-[#14161F] border border-white/10 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 p-4 sm:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">
                    Mensaje #{previewModalMsg.id}
                  </span>
                  {getTypeBadge(previewModalMsg.media_type)}
                </div>
                <button
                  onClick={() => setPreviewModalMsg(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Previously Cloned Alert */}
              {clonedMsgIds.has(previewModalMsg.id) && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Este mensaje ya fue clonado previamente hacia un canal de destino registrado en el historial.
                  </span>
                </div>
              )}

              {/* Media Preview Box (Full uncropped contain) */}
              <div className="relative w-full min-h-[280px] max-h-[55vh] rounded-xl overflow-hidden bg-black/95 border border-white/10 flex items-center justify-center">
                {previewModalMsg.media_type === "video" ? (
                  <video
                    src={`/api/channels/${selectedSourceId}/messages/${previewModalMsg.id}/video`}
                    poster={`/api/channels/${selectedSourceId}/messages/${previewModalMsg.id}/thumbnail`}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[55vh] w-auto max-w-full object-contain rounded-lg"
                  />
                ) : (
                  <MessageThumbnailImage
                    channelId={selectedSourceId}
                    messageId={previewModalMsg.id}
                    mediaType={previewModalMsg.media_type}
                    fit="contain"
                  />
                )}
              </div>

              {/* Caption / Description */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Texto / Descripción:
                </span>
                <p className="text-xs text-zinc-200 bg-zinc-950/60 p-3 rounded-lg border border-white/5 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {previewModalMsg.text || <span className="text-zinc-600 italic">Este mensaje no contiene texto.</span>}
                </p>
              </div>

              {/* Metadata Footer */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/40 p-2.5 rounded-lg border border-white/5">
                <div>
                  <span className="text-zinc-600 block text-[10px]">TAMAÑO ESTIMADO</span>
                  <span className="text-zinc-200">{formatBytes(previewModalMsg.file_size) || "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-600 block text-[10px]">FECHA ORIGINAL</span>
                  <span className="text-zinc-200">{previewModalMsg.date || "N/A"}</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant={selectedMessageIds.includes(previewModalMsg.id) ? "destructive" : "default"}
                  size="sm"
                  onClick={() => {
                    toggleSelectMessage(previewModalMsg.id);
                    setPreviewModalMsg(null);
                  }}
                  className="h-8 text-xs px-4"
                >
                  {selectedMessageIds.includes(previewModalMsg.id)
                    ? "Desmarcar este elemento"
                    : "Seleccionar para clonar"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewModalMsg(null)}
                  className="h-8 text-xs text-zinc-400 hover:text-white"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
