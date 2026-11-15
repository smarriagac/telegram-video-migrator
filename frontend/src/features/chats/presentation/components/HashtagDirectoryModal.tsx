import React, { useEffect, useState } from "react";
import {
  Hash,
  Copy,
  Send,
  FileEdit,
  Search,
  RefreshCw,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { ChatHashtagInfo } from "../../domain/types";
import { chatApi } from "../../infrastructure/chatApi";

interface HashtagDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
  chatTitle: string;
  accountId?: number | null;
  onPublish: (text: string) => Promise<void>;
  onLoadDraft?: (text: string) => void;
  onSelectHashtag?: (tag: string) => void;
}

interface UiState {
  isLoading: boolean;
  isPublishing: boolean;
  scanLimit: number;
  filterText: string;
  hashtags: ChatHashtagInfo[];
  scannedCount: number;
  customMessage: string;
  copied: boolean;
  error: string | null;
}

const buildDirectoryMessage = (
  tags: ChatHashtagInfo[],
  selected: string[],
  title: string
): string => {
  const activeTags = tags.filter((h) => selected.includes(h.tag));
  if (activeTags.length === 0) {
    return `📌 **ÍNDICE DE CONTENIDO - ${title}**\n\n(No hay etiquetas seleccionadas)`;
  }

  const lines = [
    `📌 **ÍNDICE DE ETIQUETAS Y CONTENIDO**`,
    `Canal: **${title}**`,
    `Toca cualquier etiqueta para filtrar y navegar los mensajes:\n`,
  ];

  for (const h of activeTags) {
    lines.push(`🔹 ${h.tag} — (${h.count} ${h.count === 1 ? "publicación" : "publicaciones"})`);
  }

  lines.push(`\n💡 *Tip: Puedes presionar en cualquier hashtag dentro de este mensaje para buscar automáticamente.*`);
  return lines.join("\n");
};

const DEPTH_PRESETS = [200, 500, 1000, 2500, 5000];

export const HashtagDirectoryModal: React.FC<HashtagDirectoryModalProps> = ({
  isOpen,
  onClose,
  chatId,
  chatTitle,
  accountId,
  onPublish,
  onLoadDraft,
  onSelectHashtag,
}) => {
  // Constraint: Maximum 2 useState hooks
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uiState, setUiState] = useState<UiState>({
    isLoading: false,
    isPublishing: false,
    scanLimit: 1000,
    filterText: "",
    hashtags: [],
    scannedCount: 0,
    customMessage: "",
    copied: false,
    error: null,
  });

  const loadHashtags = async (limit: number = uiState.scanLimit) => {
    if (!isOpen || !chatId) return;
    setUiState((prev) => ({ ...prev, isLoading: true, error: null, scanLimit: limit }));
    try {
      const res = await chatApi.fetchChatHashtags(chatId, limit, accountId);
      const allTagNames = (res.hashtags || []).map((h) => h.tag);
      setSelectedTags(allTagNames);
      setUiState((prev) => ({
        ...prev,
        isLoading: false,
        scanLimit: limit,
        hashtags: res.hashtags || [],
        scannedCount: res.scanned_messages || 0,
        customMessage: res.suggested_message || buildDirectoryMessage(res.hashtags || [], allTagNames, chatTitle),
      }));
    } catch (err: any) {
      setUiState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Error al escanear los hashtags del historial.",
      }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHashtags(uiState.scanLimit);
    }
  }, [isOpen, chatId, accountId]);

  const handleToggleTag = (tag: string) => {
    const isSelected = selectedTags.includes(tag);
    const updated = isSelected ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    setSelectedTags(updated);
    setUiState((prev) => ({
      ...prev,
      customMessage: buildDirectoryMessage(prev.hashtags, updated, chatTitle),
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const updated = select ? uiState.hashtags.map((h) => h.tag) : [];
    setSelectedTags(updated);
    setUiState((prev) => ({
      ...prev,
      customMessage: buildDirectoryMessage(prev.hashtags, updated, chatTitle),
    }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uiState.customMessage);
      setUiState((prev) => ({ ...prev, copied: true }));
      setTimeout(() => setUiState((prev) => ({ ...prev, copied: false })), 2000);
    } catch {
      // fallback
    }
  };

  const handleLoadDraft = () => {
    if (onLoadDraft) {
      onLoadDraft(uiState.customMessage);
    }
    onClose();
  };

  const handlePublish = async () => {
    if (!uiState.customMessage.trim()) return;
    setUiState((prev) => ({ ...prev, isPublishing: true, error: null }));
    try {
      await onPublish(uiState.customMessage);
      setUiState((prev) => ({ ...prev, isPublishing: false }));
      onClose();
    } catch (err: any) {
      setUiState((prev) => ({
        ...prev,
        isPublishing: false,
        error: err.message || "Error al publicar mensaje en el canal.",
      }));
    }
  };

  const handleScanMore = () => {
    const nextLimit = Math.min(uiState.scanLimit + 1000, 10000);
    loadHashtags(nextLimit);
  };

  const filteredHashtags = uiState.hashtags.filter((h) =>
    h.tag.toLowerCase().includes(uiState.filterText.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[92vh] flex flex-col p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg border border-pink-500/20">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Generador de Índice por Hashtags
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Escanea el historial de {chatTitle} y crea un mensaje directorio interactivo para navegar.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanMore}
                disabled={uiState.isLoading || uiState.scanLimit >= 10000}
                className="border-pink-500/40 hover:bg-pink-500/10 text-pink-300 text-xs h-8"
                title="Escanear 1.000 mensajes más hacia atrás en el historial"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                +1.000 msgs
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadHashtags(uiState.scanLimit)}
                disabled={uiState.isLoading}
                className="border-slate-700 hover:bg-slate-800 text-xs h-8 text-slate-300"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${uiState.isLoading ? "animate-spin" : ""}`} />
                Re-escanear
              </Button>
            </div>
          </div>

          {/* Depth Preset Chips */}
          <div className="flex items-center gap-1.5 pt-2 flex-wrap text-xs">
            <span className="text-[11px] font-medium text-slate-400 mr-1">Profundidad del historial:</span>
            {DEPTH_PRESETS.map((limit) => (
              <button
                key={limit}
                type="button"
                disabled={uiState.isLoading}
                onClick={() => loadHashtags(limit)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all border ${
                  uiState.scanLimit === limit
                    ? "bg-pink-600 text-white border-pink-400 font-bold shadow-xs scale-105"
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/60"
                }`}
              >
                {limit >= 1000 ? `${limit / 1000}k` : limit} msgs
              </button>
            ))}
          </div>
        </DialogHeader>

        {uiState.error && (
          <div className="p-3 my-2 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{uiState.error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {uiState.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
              <p className="text-sm text-slate-300 font-medium">
                Escaneando los últimos {uiState.scanLimit.toLocaleString()} mensajes del canal...
              </p>
              <p className="text-xs text-slate-500">
                Extrayendo etiquetas de texto, subtítulos y metadatos MTProto
              </p>
            </div>
          ) : uiState.hashtags.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-lg space-y-2">
              <Hash className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                No se encontraron #hashtags en los {uiState.scannedCount} mensajes analizados
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Probá seleccionando una profundidad mayor arriba (ej. 2.5k o 5k mensajes) para buscar en publicaciones más antiguas del canal.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHashtags(Math.max(uiState.scanLimit * 2, 2500))}
                  className="text-xs text-pink-300 border-pink-500/30 hover:bg-pink-500/10"
                >
                  Escanear historial más profundo (2.500 msgs)
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Stats & Tag Selection Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Encontrados <strong className="text-pink-400 font-bold">{uiState.hashtags.length}</strong> hashtags únicos en{" "}
                    <strong className="text-white">{uiState.scannedCount}</strong> mensajes analizados:
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-pink-400 hover:underline"
                    >
                      Todos
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-slate-400 hover:underline"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <Input
                      placeholder="Filtrar etiquetas..."
                      value={uiState.filterText}
                      onChange={(e) => setUiState((prev) => ({ ...prev, filterText: e.target.value }))}
                      className="pl-8 h-8 text-xs bg-slate-950/60 border-slate-800 text-slate-200"
                    />
                  </div>
                </div>

                {/* Tag Pills */}
                <div className="flex flex-wrap gap-1.5 p-3 max-h-40 overflow-y-auto bg-slate-950/40 border border-slate-800/80 rounded-lg">
                  {filteredHashtags.map((h) => {
                    const isSelected = selectedTags.includes(h.tag);
                    return (
                      <div
                        key={h.tag}
                        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                          isSelected
                            ? "bg-pink-500/20 text-pink-300 border-pink-500/40 hover:bg-pink-500/30"
                            : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:border-slate-600"
                        }`}
                        onClick={() => handleToggleTag(h.tag)}
                      >
                        <span>{h.tag}</span>
                        <Badge
                          variant="secondary"
                          className="px-1 py-0 text-[10px] h-4 bg-slate-800 text-slate-300 border-none group-hover:bg-slate-700"
                        >
                          {h.count}
                        </Badge>
                        {onSelectHashtag && (
                          <button
                            type="button"
                            title={`Navegar a ${h.tag} en el chat`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectHashtag(h.tag);
                              onClose();
                            }}
                            className="p-0.5 hover:text-white rounded hover:bg-pink-500/30 text-pink-400"
                          >
                            <Search className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Message Editor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Mensaje Índice Generado:</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Puedes editar el texto antes de enviarlo
                  </span>
                </label>
                <Textarea
                  value={uiState.customMessage}
                  onChange={(e) => setUiState((prev) => ({ ...prev, customMessage: e.target.value }))}
                  rows={7}
                  className="font-mono text-xs bg-slate-950/80 border-slate-800 text-slate-200 focus-visible:border-pink-500 focus-visible:ring-pink-500/30 leading-relaxed"
                  placeholder="El índice generado aparecerá aquí..."
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={uiState.isLoading || !uiState.customMessage}
              className="border-slate-700 hover:bg-slate-800 text-xs text-slate-300"
            >
              {uiState.copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copiar
                </>
              )}
            </Button>

            {onLoadDraft && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadDraft}
                disabled={uiState.isLoading || !uiState.customMessage}
                className="border-slate-700 hover:bg-slate-800 text-xs text-slate-300"
              >
                <FileEdit className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Cargar en Borrador
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cerrar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePublish}
              disabled={uiState.isLoading || uiState.isPublishing || !uiState.customMessage.trim()}
              className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold px-4 shadow-lg shadow-pink-600/20"
            >
              {uiState.isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Publicar en Canal
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
