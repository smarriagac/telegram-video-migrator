import React, { useMemo, useState } from "react";
import {
  CheckSquare,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Square,
  Video,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { ChannelMessageItem } from "../../domain/types";
import { Button } from "@/shared/components/ui/button";

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const MessageSelector: React.FC = () => {
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const sourceMessages = useMigrationStore((state) => state.sourceMessages);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);
  const isLoadingMessages = useMigrationStore((state) => state.isLoadingMessages);
  const fetchSourceMessages = useMigrationStore((state) => state.fetchSourceMessages);
  const toggleSelectMessage = useMigrationStore((state) => state.toggleSelectMessage);
  const selectAllMessages = useMigrationStore((state) => state.selectAllMessages);
  const deselectAllMessages = useMigrationStore((state) => state.deselectAllMessages);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  if (!selectedSourceId) {
    return null;
  }

  const allFilteredSelected =
    filteredMessages.length > 0 &&
    filteredMessages.every((m) => selectedMessageIds.includes(m.id));

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      deselectAllMessages();
    } else {
      selectAllMessages();
    }
  };

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case "video":
        return <Video className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case "photo":
        return <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case "document":
        return <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
  };

  return (
    <div className="bg-[#14161F]/90 backdrop-blur-md rounded-xl border border-white/5 p-3.5 shadow-xl space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
              Selector de Mensajes
            </span>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono">
              {selectedMessageIds.length > 0
                ? `${selectedMessageIds.length} seleccionados`
                : "Todos (por defecto)"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Elegí qué elementos migrar o dejá todos seleccionados para clonar el canal entero.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSourceMessages(selectedSourceId)}
            disabled={isLoadingMessages}
            className="h-7 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
            title="Refrescar mensajes del canal"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingMessages ? "animate-spin" : ""}`} />
            Actualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleSelectAllFiltered}
            disabled={filteredMessages.length === 0}
            className="h-7 px-2.5 text-[11px] border-white/10 text-zinc-300"
          >
            {allFilteredSelected ? (
              <>
                <Square className="w-3 h-3 mr-1.5 text-zinc-400" /> Desmarcar todo
              </>
            ) : (
              <>
                <CheckSquare className="w-3 h-3 mr-1.5 text-cyan-400" /> Marcar todo
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <span className="text-[10px] text-zinc-500 flex items-center mr-1">
            <Filter className="w-3 h-3 mr-0.5" /> Tipo:
          </span>
          {(["all", "video", "photo", "document", "text"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors capitalize ${
                typeFilter === t
                  ? "bg-cyan-500 text-black font-semibold"
                  : "bg-zinc-900 border border-white/5 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "all" ? "Todos" : t}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por texto o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0E1017] border border-white/10 rounded-md pl-7 pr-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 h-7"
          />
        </div>
      </div>

      {/* Messages List / Table */}
      {isLoadingMessages ? (
        <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Cargando mensajes del canal de origen...</span>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="py-6 text-center text-zinc-500 text-xs bg-[#0E1017] rounded-lg border border-white/5">
          No se encontraron mensajes que coincidan con los filtros.
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 border border-white/5 rounded-lg bg-[#0E1017]/80 divide-y divide-white/[0.03]">
          {filteredMessages.map((msg: ChannelMessageItem) => {
            const isSelected = selectedMessageIds.includes(msg.id);
            return (
              <div
                key={msg.id}
                onClick={() => toggleSelectMessage(msg.id)}
                className={`flex items-center gap-2.5 p-2 px-3 text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? "bg-cyan-950/20 hover:bg-cyan-950/30 text-white"
                    : "hover:bg-white/[0.02] text-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // handled by parent div onClick
                  className="rounded border-zinc-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-zinc-900 cursor-pointer"
                />

                <span className="font-mono text-[11px] text-zinc-500 w-12 shrink-0">
                  #{msg.id}
                </span>

                <div className="flex items-center gap-1 shrink-0 w-20">
                  {getTypeIcon(msg.media_type)}
                  <span className="text-[10px] font-mono text-zinc-400 capitalize">
                    {msg.media_type || "texto"}
                  </span>
                </div>

                <div className="flex-1 truncate text-[11px]">
                  {msg.text ? (
                    <span>{msg.text}</span>
                  ) : (
                    <span className="text-zinc-600 italic">[Sin descripción]</span>
                  )}
                </div>

                {msg.file_size ? (
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {formatBytes(msg.file_size)}
                  </span>
                ) : null}

                <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                  {msg.date}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
