import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Send,
  MessageSquare,
  Users,
  Radio,
  User as UserIcon,
  CheckCheck,
  MoreVertical,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Paperclip,
  Trash2,
  Pencil,
  X,
  FileVideo,
  Image as ImageIcon,
  FileText,
  Check,
  Play,
} from "lucide-react";
import { useChatStore } from "../application/useChatStore";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface ChatMediaThumbnailProps {
  chatId: number;
  messageId: number;
  mediaType: "video" | "photo" | "document" | "text" | undefined;
}

const ChatMediaThumbnail: React.FC<ChatMediaThumbnailProps> = ({
  chatId,
  messageId,
  mediaType,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative mb-2 rounded-lg overflow-hidden bg-black/60 border border-white/10 max-w-sm group/preview shadow-inner">
      {!loaded && !hasError && (
        <div className="w-full h-36 bg-zinc-900/60 animate-pulse flex items-center justify-center text-zinc-600">
          <Loader2 className="w-5 h-5 text-cyan-400/60 animate-spin" />
        </div>
      )}

      {hasError ? (
        <div className="w-full h-36 bg-gradient-to-br from-zinc-900 to-[#12141C] flex flex-col items-center justify-center gap-1.5 text-zinc-400 p-4 text-center">
          {mediaType === "video" ? (
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-1">
              <Play className="w-5 h-5 text-cyan-400 fill-cyan-400 ml-0.5" />
            </div>
          ) : (
            <ImageIcon className="w-8 h-8 text-emerald-400/50 mb-1" />
          )}
          <span className="text-[11px] font-medium text-zinc-300">
            {mediaType === "video" ? "Video de Telegram" : "Foto de Telegram"}
          </span>
          <span className="text-[9px] font-mono text-zinc-500">
            Miniatura no provista por el remitente
          </span>
        </div>
      ) : (
        <img
          src={`/api/dialogs/${chatId}/messages/${messageId}/thumbnail`}
          alt={mediaType === "video" ? "Vista previa de video" : "Foto"}
          className={cn(
            "w-full max-h-64 min-h-[140px] object-cover rounded-md transition-all duration-300 group-hover/preview:scale-[1.02]",
            !loaded && "hidden"
          )}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Type badge overlay */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono flex items-center gap-1.5 text-white border border-white/10 shadow-sm pointer-events-none">
        {mediaType === "video" ? (
          <>
            <FileVideo className="w-3 h-3 text-cyan-400" />
            <span>Video</span>
          </>
        ) : (
          <>
            <ImageIcon className="w-3 h-3 text-emerald-400" />
            <span>Foto</span>
          </>
        )}
      </div>

      {/* Centered Play Button for Videos when loaded */}
      {mediaType === "video" && loaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-cyan-500/90 backdrop-blur-sm flex items-center justify-center shadow-xl group-hover/preview:scale-110 transition-transform">
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
};

export const ChatsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Maximum 2 useState hooks per view.
  // 1: Local controlled input for typing messages / captions
  // 2: Local controlled text for inline editing
  const [inputText, setInputText] = useState<string>("");
  const [editText, setEditText] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const messages = useChatStore((state) => state.messages);
  const searchFilter = useChatStore((state) => state.searchFilter);
  const categoryFilter = useChatStore((state) => state.categoryFilter);
  const isLoadingDialogs = useChatStore((state) => state.isLoadingDialogs);
  const isLoadingMoreDialogs = useChatStore((state) => state.isLoadingMoreDialogs);
  const hasMoreDialogs = useChatStore((state) => state.hasMoreDialogs);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  const isUploading = useChatStore((state) => state.isUploading);
  const selectedFile = useChatStore((state) => state.selectedFile);
  const filePreviewUrl = useChatStore((state) => state.filePreviewUrl);
  const editingMessage = useChatStore((state) => state.editingMessage);
  const error = useChatStore((state) => state.error);

  const loadDialogs = useChatStore((state) => state.loadDialogs);
  const loadMoreDialogs = useChatStore((state) => state.loadMoreDialogs);
  const setCategoryFilter = useChatStore((state) => state.setCategoryFilter);
  const selectChat = useChatStore((state) => state.selectChat);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const uploadMedia = useChatStore((state) => state.uploadMedia);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const setSelectedFile = useChatStore((state) => state.setSelectedFile);
  const setEditingMessage = useChatStore((state) => state.setEditingMessage);
  const setSearchFilter = useChatStore((state) => state.setSearchFilter);
  const clearError = useChatStore((state) => state.clearError);

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const activeMessages = activeChat ? messages[activeChat.id] || [] : [];

  // Filter dialogs by search query AND category
  const filteredChats = chats.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter === "all" || c.type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const channelCount = chats.filter((c) => c.type === "channel").length;
  const groupCount = chats.filter((c) => c.type === "group").length;
  const userCount = chats.filter((c) => c.type === "user").length;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      await uploadMedia(selectedFile, inputText);
      setInputText("");
    } else if (inputText.trim()) {
      await sendMessage(inputText);
      setInputText("");
    }
  };

  const handleStartEdit = (msg: { id: number; text: string }) => {
    setEditingMessage({ id: msg.id, text: msg.text });
    setEditText(msg.text);
  };

  const handleSaveEdit = async (msgId: number) => {
    if (!editText.trim()) return;
    await editMessage(msgId, editText);
  };

  const getChatIcon = (type: "user" | "group" | "channel") => {
    switch (type) {
      case "group":
        return <Users className="w-3.5 h-3.5" />;
      case "channel":
        return <Radio className="w-3.5 h-3.5" />;
      default:
        return <UserIcon className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-105px)] min-h-[560px] flex flex-col space-y-3">
      {/* Header (shrink-0) */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            Chats & Conversaciones
          </h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Diálogos reales de Telegram con scroll fluido, filtros por categoría y carga continua.
          </p>
        </div>

        <Button
          onClick={() => loadDialogs(true)}
          disabled={isLoadingDialogs}
          variant="outline"
          size="sm"
          className="rounded-md border-white/10 text-xs hover:bg-white/5 h-8 shrink-0"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5 mr-1.5", isLoadingDialogs && "animate-spin text-cyan-400")}
          />
          Sincronizar
        </Button>
      </div>

      {/* Main Chat Interface: Bound height with flex/grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 bg-[#14161F] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        {/* Left Column: Chat List (4 cols) */}
        <aside className="md:col-span-5 lg:col-span-4 border-r border-white/5 flex flex-col bg-[#10121A]/50 h-full min-h-0 overflow-hidden">
          {/* Search Bar (shrink-0) */}
          <div className="p-2.5 border-b border-white/5 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar chats o canales..."
                className="w-full bg-zinc-950/80 border border-white/10 rounded-md pl-8 pr-2.5 py-1.5 h-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                aria-label="Buscar chats"
              />
            </div>
          </div>

          {/* Category Filter Pills (shrink-0) */}
          <div className="flex items-center gap-1 p-2 px-2.5 border-b border-white/5 shrink-0 bg-black/20 overflow-x-auto text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors shrink-0",
                categoryFilter === "all"
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white bg-white/5"
              )}
            >
              Todos ({chats.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("channel")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors shrink-0 flex items-center gap-1",
                categoryFilter === "channel"
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white bg-white/5"
              )}
            >
              <Radio className="w-3 h-3" />
              Canales ({channelCount})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("group")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors shrink-0 flex items-center gap-1",
                categoryFilter === "group"
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white bg-white/5"
              )}
            >
              <Users className="w-3 h-3" />
              Grupos ({groupCount})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("user")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors shrink-0 flex items-center gap-1",
                categoryFilter === "user"
                  ? "bg-cyan-500 text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white bg-white/5"
              )}
            >
              <UserIcon className="w-3 h-3" />
              Directos ({userCount})
            </button>
          </div>

          {/* List of Chats (flex-1 min-h-0 overflow-y-auto for flawless scrolling) */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.03]">
            {isLoadingDialogs && chats.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-center text-xs text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Cargando conversaciones desde MTProto...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No se encontraron conversaciones
              </div>
            ) : (
              <>
                {filteredChats.map((chat) => {
                  const isActive = chat.id === activeChat?.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => selectChat(chat.id)}
                      className={cn(
                        "w-full text-left p-2.5 px-3 transition-all flex items-start gap-2.5 hover:bg-white/[0.03]",
                        isActive && "bg-cyan-500/10 border-l-2 border-cyan-400"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md",
                          chat.avatar_color || "bg-cyan-600"
                        )}
                      >
                        {chat.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-200 truncate">
                            {chat.title}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono shrink-0 ml-1">
                            {chat.last_message_date}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] text-zinc-400 truncate max-w-[170px]">
                            {chat.last_message || "Sin mensajes"}
                          </p>
                          {chat.unread_count > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500 text-black font-bold shrink-0 ml-1">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-500 font-mono uppercase">
                          {getChatIcon(chat.type)}
                          <span>{chat.type}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Load More Button inside scroll container */}
                {hasMoreDialogs && (
                  <div className="p-2.5 text-center bg-black/10 border-t border-white/5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMoreDialogs}
                      disabled={isLoadingMoreDialogs}
                      className="w-full text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7"
                    >
                      {isLoadingMoreDialogs ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                          Cargando más...
                        </>
                      ) : (
                        "Cargar más conversaciones (+50)"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Aside Footer info (shrink-0) */}
          <div className="p-2 px-3 border-t border-white/5 text-[10px] text-zinc-500 font-mono flex items-center justify-between shrink-0 bg-[#0d0e15]">
            <span>{filteredChats.length} conversaciones</span>
            <button
              type="button"
              onClick={() => loadDialogs(true)}
              className="hover:text-cyan-400 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", isLoadingDialogs && "animate-spin text-cyan-400")} />
              Recargar
            </button>
          </div>
        </aside>

        {/* Right Column: Active Conversation (7-8 cols) */}
        <section className="md:col-span-7 lg:col-span-8 flex flex-col bg-[#14161F] h-full min-h-0 overflow-hidden">
          {activeChat ? (
            <>
              {/* Conversation Header (shrink-0) */}
              <div className="p-2.5 px-3 border-b border-white/5 flex items-center justify-between bg-[#12141C] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] text-white",
                      activeChat.avatar_color || "bg-cyan-600"
                    )}
                  >
                    {activeChat.title.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white leading-none">
                      {activeChat.title}
                    </h2>
                    <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      MTProto Conectado
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1 rounded-md hover:bg-white/5 text-zinc-400"
                    aria-label="Más opciones"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Error Banner (shrink-0) */}
              {error && (
                <div className="mx-3 mt-2 p-2 px-3 rounded bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between shrink-0">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={clearError}
                    className="p-0.5 hover:text-white"
                    title="Cerrar advertencia"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message Feed (flex-1 min-h-0 overflow-y-auto for smooth scroll) */}
              <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 flex flex-col">
                <div className="text-center my-1 shrink-0">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-zinc-400">
                    Cifrado y transmitido a través de Telegram MTProto
                  </span>
                </div>

                {isLoadingMessages ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                    <span className="text-xs">Cargando mensajes del chat...</span>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                    <p className="text-xs">No hay mensajes recientes en esta conversación.</p>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isEditingThis = editingMessage?.id === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "group relative max-w-[80%] rounded-lg p-2.5 text-xs flex flex-col shadow-md transition-colors",
                          msg.is_outgoing
                            ? "self-end bg-cyan-600/20 border border-cyan-500/30 text-cyan-50"
                            : "self-start bg-[#1C1F2B] border border-white/5 text-zinc-200"
                        )}
                      >
                        {/* Sender & Timestamp */}
                        <div className="flex items-center justify-between gap-2.5 text-[9px] font-mono opacity-60 mb-1 pr-14">
                          <span className="font-semibold">{msg.sender_name}</span>
                          <span>{msg.date}</span>
                        </div>

                        {/* Hover Action Buttons (Edit / Delete) */}
                        {!isEditingThis && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 absolute top-2 right-2">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(msg)}
                              title="Editar mensaje"
                              className="p-1 rounded bg-black/50 hover:bg-black/80 text-zinc-300 hover:text-cyan-300 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("¿Seguro que querés eliminar este mensaje de Telegram?")) {
                                  deleteMessage(msg.id);
                                }
                              }}
                              title="Eliminar mensaje"
                              className="p-1 rounded bg-black/50 hover:bg-black/80 text-zinc-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Media Preview Card (Video / Photo / Document) */}
                        {(msg.media_type === "video" || msg.media_type === "photo") && (
                          <ChatMediaThumbnail
                            chatId={msg.chat_id}
                            messageId={msg.id}
                            mediaType={msg.media_type}
                          />
                        )}
                        {msg.media_type === "document" && (
                          <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 rounded bg-black/30 border border-white/10 text-amber-300 text-[10px] font-mono w-fit">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>Documento / Archivo</span>
                          </div>
                        )}

                        {/* Message content or inline editing */}
                        {isEditingThis ? (
                          <div className="space-y-1.5 mt-0.5">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-black/50 border border-cyan-500/50 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(msg.id);
                                } else if (e.key === "Escape") {
                                  setEditingMessage(null);
                                }
                              }}
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingMessage(null)}
                                className="p-1 px-2 rounded text-[10px] text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(msg.id)}
                                className="p-1 px-2 rounded text-[10px] text-black bg-cyan-400 hover:bg-cyan-300 font-semibold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="leading-relaxed break-words">{msg.text}</p>
                        )}

                        {msg.is_outgoing && !isEditingThis && (
                          <div className="self-end mt-0.5 text-cyan-400 opacity-80">
                            <CheckCheck className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* File Attachment Banner (shrink-0) */}
              {selectedFile && (
                <div className="p-2 px-3 bg-[#0d0e15] border-t border-white/5 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {filePreviewUrl ? (
                      selectedFile.type.startsWith("image/") ? (
                        <img
                          src={filePreviewUrl}
                          alt="Preview"
                          className="w-9 h-9 object-cover rounded border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                          <FileVideo className="w-4 h-4 text-cyan-400" />
                        </div>
                      )
                    ) : (
                      <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "Archivo local"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                    title="Quitar archivo adjunto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Input Footer (shrink-0) */}
              <form
                onSubmit={handleSend}
                className="p-2.5 border-t border-white/5 bg-[#12141C] flex items-center gap-2 shrink-0"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                    e.target.value = "";
                  }}
                  accept="video/*,image/*,.pdf,.doc,.docx,.zip,.tar,.gz,.txt"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-8 px-2 text-zinc-400 hover:text-cyan-400 hover:bg-white/5 shrink-0"
                  title="Adjuntar video, foto o archivo local"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    selectedFile
                      ? "Añadir un comentario o caption al archivo..."
                      : "Escribí un mensaje..."
                  }
                  disabled={isUploading}
                  className="flex-1 bg-zinc-950/80 border border-white/10 rounded-md px-3 py-1.5 h-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  aria-label="Mensaje a enviar"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploading || (!inputText.trim() && !selectedFile)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md px-3.5 h-8 flex items-center gap-1.5 shrink-0"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{selectedFile ? "Publicar" : "Enviar"}</span>
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <ShieldAlert className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
              <p className="text-xs">Seleccioná un chat de la lista para ver el historial.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};