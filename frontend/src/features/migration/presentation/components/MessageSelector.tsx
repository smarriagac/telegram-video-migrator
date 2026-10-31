import React, { useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Eye,
  FileText,
  Filter,
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
}

const MessageThumbnailImage: React.FC<ThumbnailProps> = ({
  channelId,
  messageId,
  mediaType,
  className = "",
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const isVisualMedia = mediaType === "video" || mediaType === "photo" || mediaType === "document";

  if (!isVisualMedia || error) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex flex-col items-center justify-center text-zinc-600 ${className}`}
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
    <div className={`relative w-full h-full bg-zinc-950 overflow-hidden ${className}`}>
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
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};

export const MessageSelector: React.FC = () => {
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const sourceMessages = useMigrationStore((state) => state.sourceMessages);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);
  const isLoadingMessages = useMigrationStore((state) => state.isLoadingMessages);
  const hasMoreMessages = useMigrationStore((state) => state.hasMoreMessages);
  const isLoadingMoreMessages = useMigrationStore((state) => state.isLoadingMoreMessages);
  const fetchSourceMessages = useMigrationStore((state) => state.fetchSourceMessages);
  const loadMoreSourceMessages = useMigrationStore((state) => state.loadMoreSourceMessages);
  const toggleSelectMessage = useMigrationStore((state) => state.toggleSelectMessage);
  const selectAllMessages = useMigrationStore((state) => state.selectAllMessages);
  const deselectAllMessages = useMigrationStore((state) => state.deselectAllMessages);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [previewModalMsg, setPreviewModalMsg] = useState<ChannelMessageItem | null>(null);

  const filteredMessages = useMemo(() => {
    return sourceMessages.filter((msg) => {
      if (typeFilter !== "all" && msg.media_type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch = msg.text.toLowerCase().includes(q);
        const idMatch = msg.id.toString().includes(q);
        if (!textMatch && !idMatch) return false;
      }
      return true;
    });
  }, [sourceMessages, typeFilter, searchQuery]);

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

  const selectedSizeSum = useMemo(() => {
    return sourceMessages
      .filter((m) => selectedMessageIds.includes(m.id))
      .reduce((acc, curr) => acc + (curr.file_size || 0), 0);
  }, [sourceMessages, selectedMessageIds]);

  if (!selectedSourceId) {
    return (
      <div className="bg-[#14161F]/95 backdrop-blur-md rounded-2xl border border-white/5 p-4 shadow-2xl space-y-4 flex flex-col min-h-[520px]">
        <div className="border-b border-white/5 pb-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white capitalize font-mono">
              Mensajes, videos e imágenes del canal a copiar
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Elegí un canal de origen en el panel "De:" para cargar y previsualizar su contenido.
            </p>
          </div>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-white/5 px-2 py-0.5 rounded font-mono">
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
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Video className="w-2.5 h-2.5" /> Video
          </span>
        );
      case "photo":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <ImageIcon className="w-2.5 h-2.5" /> Foto
          </span>
        );
      case "document":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <FileText className="w-2.5 h-2.5" /> Archivo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-white/5">
            <MessageSquare className="w-2.5 h-2.5" /> Texto
          </span>
        );
    }
  };

  return (
    <div className="bg-[#14161F]/95 backdrop-blur-md rounded-2xl border border-white/5 p-4 shadow-2xl space-y-4 flex flex-col min-h-[520px]">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-white capitalize font-mono">
              Mensajes, videos e imágenes del canal a copiar
            </h2>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono">
              {selectedMessageIds.length > 0
                ? `${selectedMessageIds.length} seleccionados (${formatBytes(selectedSizeSum)})`
                : `${filteredMessages.length} elementos`}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Hacé click en cada miniatura para seleccionarlo o previsualizarlo antes de migrar.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
              <span className="hidden md:inline text-[11px]">Galería</span>
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
              <span className="hidden md:inline text-[11px]">Lista</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSourceMessages(selectedSourceId)}
            disabled={isLoadingMessages}
            className="h-8 px-2.5 text-xs text-zinc-400 hover:text-zinc-200 border border-white/5"
            title="Recargar mensajes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleSelectAll}
            disabled={filteredMessages.length === 0}
            className="h-8 px-3 text-xs border-white/10 text-zinc-200 hover:bg-white/5"
          >
            {allFilteredSelected ? (
              <>
                <Square className="w-3.5 h-3.5 mr-1.5 text-zinc-400" /> Desmarcar ({filteredMessages.length})
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> Marcar ({filteredMessages.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-0.5">
          <span className="text-[10px] text-zinc-500 flex items-center mr-1 font-mono">
            <Filter className="w-3 h-3 mr-1" /> Filtro:
          </span>
          {[
            { id: "all", label: `Todos (${countsByType.all})` },
            { id: "video", label: `Videos (${countsByType.video})` },
            { id: "photo", label: `Fotos (${countsByType.photo})` },
            { id: "document", label: `Archivos (${countsByType.document})` },
            { id: "text", label: `Texto (${countsByType.text})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTypeFilter(item.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all whitespace-nowrap ${
                typeFilter === item.id
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "bg-zinc-900/80 border border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por texto o #ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0E1017] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 h-8"
          />
        </div>
      </div>

      {/* Main Content: Gallery Grid or List */}
      {isLoadingMessages ? (
        <div className="py-14 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2.5">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="font-mono text-zinc-400">Escaneando multimedia y generando miniaturas...</span>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 text-xs bg-[#0E1017] rounded-xl border border-white/5 font-mono">
          No se encontraron mensajes con los filtros seleccionados.
        </div>
      ) : viewMode === "grid" ? (
        /* VISUAL GALLERY GRID (4 columns on desktop matching wireframe) */
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto p-1">
          {filteredMessages.map((msg) => {
            const isSelected = selectedMessageIds.includes(msg.id);
            const sizeStr = formatBytes(msg.file_size);

            return (
              <div
                key={msg.id}
                onClick={() => toggleSelectMessage(msg.id)}
                className={`group relative rounded-xl border overflow-hidden cursor-pointer select-none transition-all duration-200 aspect-[4/3] flex flex-col justify-between ${
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
                  {/* Subtle Gradient vignette for legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />
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
      ) : (
        /* COMPACT TABLE / LIST VIEW */
        <div className="max-h-96 overflow-y-auto space-y-1 pr-1 border border-white/5 rounded-xl bg-[#0E1017]/80 divide-y divide-white/[0.03]">
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

                <div className="shrink-0 w-20">
                  {getTypeBadge(msg.media_type)}
                </div>

                <div className="flex-1 truncate text-xs">
                  {msg.text ? (
                    <span className="text-zinc-200">{msg.text}</span>
                  ) : (
                    <span className="text-zinc-600 italic">[Sin descripción]</span>
                  )}
                </div>

                {sizeStr && (
                  <span className="text-[10px] font-mono text-cyan-400/90 shrink-0 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/20">
                    {sizeStr}
                  </span>
                )}

                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
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
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5">
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
      {previewModalMsg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewModalMsg(null)}
        >
          <div
            className="bg-[#14161F] border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-4 p-5"
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

            {/* Media Preview Box */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/5 flex items-center justify-center">
              <MessageThumbnailImage
                channelId={selectedSourceId}
                messageId={previewModalMsg.id}
                mediaType={previewModalMsg.media_type}
                className="object-contain"
              />
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
        </div>
      )}
    </div>
  );
};
