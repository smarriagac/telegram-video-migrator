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
  Lock,
  Maximize2,
  ChevronDown,
  ChevronLeft,
  UserPlus,
  Key,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useChatStore } from "../application/useChatStore";
import { Button } from "@/shared/components/ui/button";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { channelApi, ManagedChannel } from "@/features/channels/infrastructure/channelApi";

interface ChatMediaThumbnailProps {
  chatId: number;
  messageId: number;
  mediaType: "video" | "photo" | "document" | "text" | undefined;
  accountId?: number | null;
  text?: string;
}

const ChatMediaThumbnail: React.FC<ChatMediaThumbnailProps> = ({
  chatId,
  messageId,
  mediaType,
  accountId,
  text,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isPlayingInline, setIsPlayingInline] = useState(false);

  const thumbUrl = `/api/dialogs/${chatId}/messages/${messageId}/thumbnail${
    accountId ? `?account_id=${accountId}` : ""
  }`;

  const videoUrl = `/api/dialogs/${chatId}/messages/${messageId}/video${
    accountId ? `?account_id=${accountId}` : ""
  }`;

  // If playing inline, render HTML5 video player inside the chat bubble
  if (mediaType === "video" && isPlayingInline) {
    return (
      <div className="relative mb-2 rounded-lg overflow-hidden bg-black border border-white/10 max-w-sm shadow-xl group/video">
        <video
          src={videoUrl}
          poster={thumbUrl}
          controls
          autoPlay
          playsInline
          className="w-full max-h-80 object-contain bg-black rounded-lg"
        />
        {/* Top-right overlay actions: expand to modal or close inline */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/video:opacity-100 transition-opacity bg-black/70 backdrop-blur-md rounded-md p-0.5 border border-white/10 z-10">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            title="Ampliar video (Pantalla completa / modal)"
            className="p-1 hover:text-cyan-400 text-zinc-300 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlayingInline(false)}
            title="Detener reproducción inline"
            className="p-1 hover:text-red-400 text-zinc-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal if user clicks expand while playing inline */}
        {showModal &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
              onClick={() => setShowModal(false)}
            >
              <div
                className="bg-card border border-border rounded-md max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 p-5 text-card-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground font-mono">
                      Mensaje #{messageId}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/20 font-semibold">
                      Video
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Video Player in Modal */}
                <div className="relative w-full min-h-[320px] max-h-[65vh] rounded-md overflow-hidden bg-black border border-border flex items-center justify-center">
                  <video
                    src={videoUrl}
                    poster={thumbUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
                  />
                </div>

                {text && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Texto / Descripción:
                    </span>
                    <p className="text-xs text-foreground bg-secondary/60 p-3 rounded-lg border border-border whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {text}
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowModal(false)}
                    className="h-8 text-xs px-4 border-border bg-secondary text-secondary-foreground hover:bg-muted"
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
  }

  return (
    <div className="relative mb-2 rounded-lg overflow-hidden bg-black/60 border border-white/10 max-w-sm group/preview shadow-inner">
      {!loaded && !hasError && (
        <div className="w-full h-36 bg-secondary/60 animate-pulse flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 text-primary/60 animate-spin" />
        </div>
      )}

      {hasError ? (
        <div className="w-full h-36 bg-secondary/80 border border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4 text-center">
          {mediaType === "video" ? (
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-1">
              <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
            </div>
          ) : (
            <ImageIcon className="w-8 h-8 text-emerald-500/50 mb-1" />
          )}
          <span className="text-[11px] font-medium text-foreground">
            {mediaType === "video" ? "Video de Telegram" : "Foto de Telegram"}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            Miniatura no provista por el remitente
          </span>
        </div>
      ) : (
        <img
          src={thumbUrl}
          alt={mediaType === "video" ? "Vista previa de video" : "Foto"}
          className={cn(
            "w-full max-h-64 min-h-[140px] object-cover rounded-md transition-all duration-300 group-hover/preview:scale-[1.02] cursor-pointer",
            !loaded ? "opacity-0" : "opacity-100"
          )}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          onClick={() => {
            if (mediaType === "video") {
              setIsPlayingInline(true);
            } else {
              setShowModal(true);
            }
          }}
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

      {/* Top right Expand Button overlay */}
      {loaded && !hasError && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(true);
          }}
          title="Ver en pantalla completa / modal"
          className="absolute top-2 right-2 p-1 rounded bg-black/70 backdrop-blur-md text-zinc-300 hover:text-cyan-400 border border-white/10 opacity-0 group-hover/preview:opacity-100 transition-opacity"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Centered Telegram-style Circular Play Button for Videos when loaded */}
      {mediaType === "video" && loaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlayingInline(true);
            }}
            title="Reproducir video inline"
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl flex items-center justify-center cursor-pointer pointer-events-auto group-hover/preview:scale-110 transition-transform active:scale-95"
          >
            <Play className="w-5 h-5 fill-primary-foreground ml-0.5" />
          </button>
        </div>
      )}

      {/* Lightbox Modal (Full image uncropped preview or Video Player) */}
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-card border border-border rounded-md max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 p-5 text-card-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground font-mono">
                    Mensaje #{messageId}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/20 font-semibold">
                    {mediaType}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Full Media Contain: Video Player or Image */}
              <div className="relative w-full min-h-[300px] max-h-[65vh] rounded-md overflow-hidden bg-black/95 border border-border flex items-center justify-center">
                {mediaType === "video" ? (
                  <video
                    src={videoUrl}
                    poster={thumbUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={thumbUrl}
                    alt="Vista previa completa"
                    className="max-h-[65vh] w-auto max-w-full object-contain"
                  />
                )}
              </div>

              {text && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Texto / Descripción:
                  </span>
                  <p className="text-xs text-foreground bg-secondary/60 p-3 rounded-lg border border-border whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {text}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  className="h-8 text-xs px-4 border-border bg-secondary text-secondary-foreground hover:bg-muted"
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

interface VipModalState {
  isOpen: boolean;
  channelId: number;
  durationDays: number;
  directInvite: boolean;
  autoSendDm: boolean;
  feedback: { message: string; type: "success" | "error" } | null;
}

interface ExtraViewState {
  editText: string;
  vipModal: VipModalState | null;
  channels: ManagedChannel[];
  isSubmitting: boolean;
}

export const ChatsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 2 useState hooks per view.
  // 1: Local controlled input for typing messages / captions
  const [inputText, setInputText] = useState<string>("");
  // 2: Consolidated view state (inline edit, VIP modal, managed channels, submitting)
  const [viewState, setViewState] = useState<ExtraViewState>({
    editText: "",
    vipModal: null,
    channels: [],
    isSubmitting: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);

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
  const accounts = useChatStore((state) => state.accounts);
  const selectedAccountId = useChatStore((state) => state.selectedAccountId);
  const isScrolledUp = useChatStore((state) => state.isScrolledUp);

  const loadAccounts = useChatStore((state) => state.loadAccounts);
  const setSelectedAccountId = useChatStore((state) => state.setSelectedAccountId);
  const loadDialogs = useChatStore((state) => state.loadDialogs);
  const loadMoreDialogs = useChatStore((state) => state.loadMoreDialogs);
  const setCategoryFilter = useChatStore((state) => state.setCategoryFilter);
  const selectChat = useChatStore((state) => state.selectChat);
  const markAsRead = useChatStore((state) => state.markAsRead);
  const setIsScrolledUp = useChatStore((state) => state.setIsScrolledUp);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const uploadMedia = useChatStore((state) => state.uploadMedia);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const setSelectedFile = useChatStore((state) => state.setSelectedFile);
  const setEditingMessage = useChatStore((state) => state.setEditingMessage);
  const setSearchFilter = useChatStore((state) => state.setSearchFilter);
  const clearError = useChatStore((state) => state.clearError);
  const refreshActiveMessages = useChatStore((state) => state.refreshActiveMessages);

  useEffect(() => {
    loadAccounts();
    loadDialogs();
  }, [loadAccounts, loadDialogs]);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const activeMessages = activeChat ? messages[activeChat.id] || [] : [];

  const firstUnreadIndex =
    (activeChat?.unread_count || 0) > 0
      ? activeMessages.findIndex(
          (m) =>
            !m.is_outgoing &&
            (activeChat?.read_inbox_max_id ? m.id > activeChat.read_inbox_max_id : !m.is_read)
        )
      : -1;

  // Single-fire scroll on chat change or initial messages load
  useEffect(() => {
    if (activeMessages.length === 0) return;

    const timer = setTimeout(() => {
      if (firstUnreadIndex !== -1 && unreadDividerRef.current) {
        unreadDividerRef.current.scrollIntoView({ behavior: "auto", block: "center" });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeChatId, activeMessages.length > 0]);

  // Filter dialogs by search query AND category
  const filteredChats = chats.filter((c) => {
    const title = c.title || "";
    const matchesSearch = title.toLowerCase().includes(searchFilter.toLowerCase());
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
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleStartEdit = (msg: { id: number; text: string }) => {
    setEditingMessage({ id: msg.id, text: msg.text });
    setViewState((s) => ({ ...s, editText: msg.text }));
  };

  const handleSaveEdit = async (msgId: number) => {
    if (!viewState.editText.trim()) return;
    await editMessage(msgId, viewState.editText);
    setViewState((s) => ({ ...s, editText: "" }));
  };

  const openVipModal = async () => {
    let channels = viewState.channels;
    if (channels.length === 0) {
      const fetched = await channelApi.listManagedChannels();
      channels = fetched.filter((c) => c.can_post);
    }
    setViewState((s) => ({
      ...s,
      channels,
      vipModal: {
        isOpen: true,
        channelId: channels[0]?.id || 0,
        durationDays: 30,
        directInvite: false,
        autoSendDm: true,
        feedback: null,
      },
    }));
  };

  const handleConfirmVipModal = async () => {
    if (!viewState.vipModal || !activeChat) return;
    const { channelId, durationDays, directInvite, autoSendDm } = viewState.vipModal;
    if (!channelId) {
      setViewState((s) => ({
        ...s,
        vipModal: s.vipModal
          ? {
              ...s.vipModal,
              feedback: { message: "Seleccioná un canal o grupo destino.", type: "error" },
            }
          : null,
      }));
      return;
    }

    setViewState((s) => ({ ...s, isSubmitting: true }));
    try {
      const targetIdentifier = activeChat.username ? `@${activeChat.username}` : String(activeChat.id);
      const res = await channelApi.addMemberToChannel({
        channelId,
        userIdOrUsername: targetIdentifier,
        durationDays,
        directInvite,
        autoSendDm,
        accountId: selectedAccountId || activeChat.account_id || null,
      });

      if (autoSendDm) {
        await refreshActiveMessages();
      }

      setViewState((s) => ({
        ...s,
        isSubmitting: false,
        vipModal: s.vipModal
          ? {
              ...s.vipModal,
              feedback: {
                message: res.message || "¡Acceso concedido exitosamente!",
                type: "success",
              },
            }
          : null,
      }));

      setTimeout(() => {
        setViewState((s) => ({ ...s, vipModal: null }));
      }, 2500);
    } catch (err: any) {
      setViewState((s) => ({
        ...s,
        isSubmitting: false,
        vipModal: s.vipModal
          ? {
              ...s.vipModal,
              feedback: {
                message: err.message || "Error al asignar acceso al canal.",
                type: "error",
              },
            }
          : null,
      }));
    }
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
    <div className="w-full h-full flex flex-col space-y-3 min-h-0 overflow-hidden">
      {/* Header (shrink-0) */}
      <ViewHeader
        icon={<MessageSquare className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Chats & Conversaciones"
        subtitle="Diálogos reales de Telegram con scroll fluido, filtros por categoría y carga continua."
      >

        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 gap-1 shrink-0">
              {accounts.map((acc) => {
                const isActive = selectedAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium transition-all",
                      isActive
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                    )}
                  >
                    {acc.name}
                  </button>
                );
              })}
            </div>
          )}

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
      </ViewHeader>

      {/* Main Chat Interface: Bound height with flex/grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 bg-card border border-border rounded-md overflow-hidden shadow-sm">
        {/* Left Column: Chat List (4 cols on lg, 3 cols on xl) */}
        <aside
          className={cn(
            "md:col-span-5 lg:col-span-4 xl:col-span-3 border-r border-border flex flex-col bg-card h-full min-h-0 overflow-hidden",
            activeChatId ? "hidden md:flex" : "flex"
          )}
        >
          {/* Search Bar (shrink-0) */}
          <div className="p-2.5 border-b border-border shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar chats o canales..."
                className="w-full bg-secondary/60 border border-border rounded-md pl-8 pr-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                aria-label="Buscar chats"
              />
            </div>
          </div>

          {/* Category Filter Pills (shrink-0) */}
          <div className="flex items-center gap-1 p-2 px-2.5 border-b border-border shrink-0 bg-secondary/30 overflow-x-auto text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors shrink-0",
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-secondary/60"
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
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-secondary/60"
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
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-secondary/60"
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
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-secondary/60"
              )}
            >
              <UserIcon className="w-3 h-3" />
              Directos ({userCount})
            </button>
          </div>

          {/* List of Chats (flex-1 min-h-0 overflow-y-auto for flawless scrolling) */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40">
            {isLoadingDialogs && chats.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Cargando conversaciones desde MTProto...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
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
                        "w-full text-left p-2.5 px-3 transition-all flex items-start gap-2.5 hover:bg-muted/50",
                        isActive && "bg-primary/10 border-l-2 border-primary"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md",
                          chat.avatar_color || "bg-primary"
                        )}
                      >
                        {(chat.title || "C").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {chat.title || "Sin título"}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-mono shrink-0 ml-1">
                            {chat.last_message_date}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                            {chat.last_message || "Sin mensajes"}
                          </p>
                          {chat.unread_count > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold shrink-0 ml-1">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono uppercase">
                            {getChatIcon(chat.type)}
                            <span>{chat.type}</span>
                          </div>
                          {chat.can_post === false && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-medium bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                              Solo Lectura
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Load More Button inside scroll container */}
                {hasMoreDialogs && (
                  <div className="p-2.5 text-center bg-secondary/30 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMoreDialogs}
                      disabled={isLoadingMoreDialogs}
                      className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 h-7"
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
          <div className="p-2 px-3 border-t border-border text-[10px] text-muted-foreground font-mono flex items-center justify-between shrink-0 bg-secondary/30">
            <span>{filteredChats.length} conversaciones</span>
            <button
              type="button"
              onClick={() => loadDialogs(true)}
              className="hover:text-primary flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", isLoadingDialogs && "animate-spin text-primary")} />
              Recargar
            </button>
          </div>
        </aside>

        {/* Right Column: Active Conversation (7-8 cols on lg, 9 cols on xl) */}
        <section
          className={cn(
            "md:col-span-7 lg:col-span-8 xl:col-span-9 flex flex-col bg-background h-full min-h-0 overflow-hidden",
            activeChatId ? "flex" : "hidden md:flex"
          )}
        >
          {activeChat ? (
            <>
              {/* Conversation Header (shrink-0) */}
              <div className="p-2.5 px-3 border-b border-border flex items-center justify-between bg-card shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectChat(0)}
                    className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                    title="Volver a la lista de chats"
                    aria-label="Volver a la lista de chats"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] text-white shrink-0",
                      activeChat.avatar_color || "bg-primary"
                    )}
                  >
                    {(activeChat.title || "C").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold text-white leading-none truncate max-w-[200px] sm:max-w-xs">
                      {activeChat.title || "Conversación"}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        MTProto Conectado
                      </span>
                      {activeChat.can_post === false ? (
                        <span className="text-[9px] text-amber-400 font-mono flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                          <Lock className="w-2.5 h-2.5" />
                          Solo Lectura
                        </span>
                      ) : (
                        <span className="text-[9px] text-cyan-400 font-mono flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                          <Check className="w-2.5 h-2.5" />
                          Envío Habilitado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Action button to add user to managed channel / generate VIP pass */}
                  {activeChat.type === "user" && (
                    <Button
                      onClick={openVipModal}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10 flex items-center gap-1.5 px-2.5 rounded-md shrink-0 shadow-sm font-medium"
                      title="Agregar usuario a un canal/grupo administrado o enviar Pase VIP"
                    >
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="hidden sm:inline">Pase VIP / Canal</span>
                    </Button>
                  )}
                  {activeChat.unread_count > 0 && (
                    <Button
                      onClick={() => markAsRead(activeChat.id)}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1 px-2 sm:px-2.5 border border-cyan-500/30 rounded-md shrink-0"
                      title="Marcar todos los mensajes como leídos en Telegram"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Marcar leído </span>
                      <span>({activeChat.unread_count})</span>
                    </Button>
                  )}
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
              <div
                ref={messagesContainerRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                  const isUp = distanceToBottom > 100;
                  if (isUp !== isScrolledUp) {
                    setIsScrolledUp(isUp);
                  }

                  if (distanceToBottom <= 20 && activeChat && activeChat.unread_count > 0) {
                    markAsRead(activeChat.id);
                  }
                }}
                className="relative flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 flex flex-col"
              >
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
                  activeMessages.map((msg, index) => {
                    const isEditingThis = editingMessage?.id === msg.id;
                    const isUnreadDividerHere = index === firstUnreadIndex;
                    const isOutgoingRead =
                      msg.is_read ||
                      (activeChat?.read_outbox_max_id
                        ? msg.id <= activeChat.read_outbox_max_id
                        : false);

                    return (
                      <React.Fragment key={msg.id}>
                        {isUnreadDividerHere && (
                          <div
                            ref={unreadDividerRef}
                            className="flex items-center justify-center my-3 gap-3 shrink-0"
                          >
                            <div className="flex-1 border-t border-cyan-500/30" />
                            <span className="px-3 py-0.5 text-[10px] font-mono font-medium text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 rounded-full shadow-md flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                              Mensajes no leídos
                            </span>
                            <div className="flex-1 border-t border-cyan-500/30" />
                          </div>
                        )}

                        <div
                          className={cn(
                            "group relative max-w-[80%] rounded-lg p-2.5 text-xs flex flex-col shadow-sm transition-colors",
                            msg.is_outgoing
                              ? "self-end bg-primary/15 border border-primary/30 text-foreground"
                              : "self-start bg-card border border-border text-foreground"
                          )}
                        >
                          {/* Sender & Timestamp */}
                          <div className="flex items-center justify-between gap-2.5 text-[9px] font-mono opacity-60 mb-1 pr-14 text-muted-foreground">
                            <span className="font-semibold text-foreground/80">{msg.sender_name}</span>
                            <span>{msg.date}</span>
                          </div>

                          {/* Hover Action Buttons (Edit / Delete) */}
                          {!isEditingThis && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 absolute top-2 right-2">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(msg)}
                                title="Editar mensaje"
                                className="p-1 rounded bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-primary transition-colors border border-border/40"
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
                                className="p-1 rounded bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-rose-500 transition-colors border border-border/40"
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
                              accountId={selectedAccountId}
                              text={msg.text}
                            />
                          )}
                          {msg.media_type === "document" && (
                            <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 rounded bg-secondary/70 border border-border text-amber-500 dark:text-amber-300 text-[10px] font-mono w-fit">
                              <FileText className="w-3.5 h-3.5 text-amber-500" />
                              <span>Documento / Archivo</span>
                            </div>
                          )}

                          {/* Message content or inline editing */}
                          {isEditingThis ? (
                            <div className="space-y-1.5 mt-0.5">
                              <input
                                type="text"
                                value={viewState.editText}
                                onChange={(e) =>
                                  setViewState((s) => ({ ...s, editText: e.target.value }))
                                }
                                className="w-full bg-secondary/70 border border-primary/50 rounded px-2 py-1 text-xs text-foreground focus:outline-none"
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
                                  className="p-1 px-2 rounded text-[10px] text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 flex items-center gap-1 border border-border"
                                >
                                  <X className="w-3 h-3" />
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(msg.id)}
                                  className="p-1 px-2 rounded text-[10px] text-primary-foreground bg-primary hover:bg-primary/90 font-semibold flex items-center gap-1"
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
                            <div className="self-end mt-0.5 flex items-center gap-0.5">
                              {isOutgoingRead ? (
                                <span title="Leído por el destinatario" className="text-primary flex items-center">
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span title="Entregado al servidor (no leído aún)" className="text-muted-foreground flex items-center">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />

                {/* Floating Scroll-to-Bottom Button */}
                {isScrolledUp && (
                  <button
                    type="button"
                    onClick={() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                      if (activeChat && activeChat.unread_count > 0) {
                        markAsRead(activeChat.id);
                      }
                      setIsScrolledUp(false);
                    }}
                    className="sticky bottom-2 self-end mr-2 z-20 p-2 rounded-full bg-card border border-primary/40 text-primary shadow-2xl hover:bg-muted transition-all flex items-center gap-1.5 backdrop-blur-md group"
                    title="Ir a los mensajes más recientes"
                  >
                    <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                    {activeChat.unread_count > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-primary text-primary-foreground">
                        {activeChat.unread_count}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* File Attachment Banner (shrink-0) */}
              {selectedFile && (
                <div className="p-2 px-3 bg-secondary/50 border-t border-border flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {filePreviewUrl ? (
                      selectedFile.type.startsWith("image/") ? (
                        <img
                          src={filePreviewUrl}
                          alt="Preview"
                          className="w-9 h-9 object-cover rounded border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                          <FileVideo className="w-4 h-4 text-primary" />
                        </div>
                      )
                    ) : (
                      <div className="w-9 h-9 rounded bg-secondary border border-border flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "Archivo local"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Quitar archivo adjunto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Input Footer or Read-Only Notice (shrink-0) */}
              {activeChat.can_post === false ? (
                <div className="p-3 border-t border-border bg-secondary/40 flex items-center justify-center gap-2 text-muted-foreground text-xs shrink-0 font-medium">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Este canal o grupo es de solo lectura. No tenés permisos para publicar mensajes aquí.</span>
                </div>
              ) : (
                <form
                  onSubmit={handleSend}
                  className="p-2.5 border-t border-border bg-card flex items-center gap-2 shrink-0"
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
                    className="h-8 px-2 text-muted-foreground hover:text-primary hover:bg-muted shrink-0"
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
                    className="flex-1 bg-secondary/60 border border-border rounded-md px-3 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    aria-label="Mensaje a enviar"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUploading || (!inputText.trim() && !selectedFile)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md px-3.5 h-8 flex items-center gap-1.5 shrink-0 shadow-sm"
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
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <ShieldAlert className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
              <p className="text-xs">Seleccioná un chat de la lista para ver el historial.</p>
            </div>
          )}
        </section>
      </div>

      {/* Shadcn UI Dialog: Agregar a Canal o Grupo / Pase VIP */}
      <Dialog
        open={!!viewState.vipModal?.isOpen}
        onOpenChange={(open) => {
          if (!open) setViewState((s) => ({ ...s, vipModal: null }));
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              <Key className="w-4 h-4 text-primary" />
              Agregar a Canal o Grupo / Pase VIP
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Asigná acceso a <strong>{activeChat?.title}</strong> en una de tus comunidades administradas.
            </DialogDescription>
          </DialogHeader>

          {/* User Preview Mini-Card */}
          {activeChat && (
            <div className="p-2.5 rounded border border-border bg-secondary/40 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                  {(activeChat.title || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-xs leading-none">
                    {activeChat.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {activeChat.username ? `@${activeChat.username}` : `ID: ${activeChat.id}`}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-background">
                Chat Activo
              </Badge>
            </div>
          )}

          <div className="space-y-3 py-1 text-xs">
            {/* Channel/Group selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Canal o Grupo Destino (Comunidades Propias)
              </label>
              <Select
                value={String(viewState.vipModal?.channelId || "")}
                onValueChange={(val) =>
                  setViewState((s) => ({
                    ...s,
                    vipModal: s.vipModal ? { ...s.vipModal, channelId: Number(val) } : null,
                  }))
                }
              >
                <SelectTrigger className="w-full h-8 text-xs bg-background">
                  <SelectValue placeholder="Seleccionar canal o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {viewState.channels.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.type === "supergroup" || c.type === "group" ? "[Grupo] " : "[Canal] "}
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">Duración del Acceso</label>
              <Select
                value={String(viewState.vipModal?.durationDays || 30)}
                onValueChange={(val) =>
                  setViewState((s) => ({
                    ...s,
                    vipModal: s.vipModal ? { ...s.vipModal, durationDays: Number(val) } : null,
                  }))
                }
              >
                <SelectTrigger className="w-full h-8 text-xs bg-background">
                  <SelectValue placeholder="Seleccionar duración" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Día (Acceso 24h)</SelectItem>
                  <SelectItem value="3">3 Días (Fin de semana)</SelectItem>
                  <SelectItem value="7">7 Días (Acceso de Prueba)</SelectItem>
                  <SelectItem value="15">15 Días</SelectItem>
                  <SelectItem value="30">30 Días (Mensual)</SelectItem>
                  <SelectItem value="60">60 Días (Bimestral)</SelectItem>
                  <SelectItem value="90">90 Días (Trimestral)</SelectItem>
                  <SelectItem value="180">180 Días (Semestral)</SelectItem>
                  <SelectItem value="365">365 Días (Anual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entry Mode Toggle */}
            <div className="space-y-1.5 pt-1">
              <label className="font-semibold text-foreground block">Método de Asignación</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setViewState((s) => ({
                      ...s,
                      vipModal: s.vipModal ? { ...s.vipModal, directInvite: false } : null,
                    }))
                  }
                  className={cn(
                    "p-2 rounded border text-left transition-colors flex flex-col gap-0.5",
                    !viewState.vipModal?.directInvite
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card/60 text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    <Key className="w-3 h-3 text-primary" /> Pase VIP (Recomendado)
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Enlace efímero con aprobación y temporizador
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewState((s) => ({
                      ...s,
                      vipModal: s.vipModal ? { ...s.vipModal, directInvite: true } : null,
                    }))
                  }
                  className={cn(
                    "p-2 rounded border text-left transition-colors flex flex-col gap-0.5",
                    viewState.vipModal?.directInvite
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card/60 text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    <UserPlus className="w-3 h-3 text-cyan-400" /> Ingreso Directo
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Agrega al usuario inmediatamente vía MTProto
                  </span>
                </button>
              </div>
            </div>

            {/* Feedback message */}
            {viewState.vipModal?.feedback && (
              <div
                className={cn(
                  "p-2.5 rounded text-xs border flex items-center gap-2",
                  viewState.vipModal.feedback.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                )}
              >
                {viewState.vipModal.feedback.type === "success" ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                )}
                <span>{viewState.vipModal.feedback.message}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewState((s) => ({ ...s, vipModal: null }))}
              disabled={viewState.isSubmitting}
              className="h-8 text-xs"
            >
              Cerrar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmVipModal}
              disabled={viewState.isSubmitting || !viewState.vipModal?.channelId}
              className="h-8 text-xs gap-1.5 font-semibold"
            >
              {viewState.isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {!viewState.vipModal?.directInvite ? "Generar y Enviar Enlace" : "Agregar Directamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};