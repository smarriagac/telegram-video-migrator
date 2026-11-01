import { create } from "zustand";
import { Chat, Message } from "../domain/types";
import { chatApi } from "../infrastructure/chatApi";

interface ChatState {
  chats: Chat[];
  activeChatId: number | null;
  messages: Record<number, Message[]>;
  isLoadingDialogs: boolean;
  isLoadingMoreDialogs: boolean;
  hasMoreDialogs: boolean;
  dialogsLimit: number;
  categoryFilter: "all" | "channel" | "group" | "user";
  isLoadingMessages: boolean;
  isUploading: boolean;
  selectedFile: File | null;
  filePreviewUrl: string | null;
  editingMessage: { id: number; text: string } | null;
  searchFilter: string;
  error: string | null;
  accounts: { id: number; name: string }[];
  selectedAccountId: number | null;
  isScrolledUp: boolean;

  // Actions
  loadAccounts: () => Promise<void>;
  setSelectedAccountId: (accountId: number | null) => Promise<void>;
  loadDialogs: (resetLimit?: boolean) => Promise<void>;
  loadMoreDialogs: () => Promise<void>;
  setCategoryFilter: (category: "all" | "channel" | "group" | "user") => void;
  selectChat: (chatId: number) => Promise<void>;
  markAsRead: (chatId: number, maxId?: number) => Promise<void>;
  setIsScrolledUp: (scrolledUp: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  uploadMedia: (file: File, caption?: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  editMessage: (messageId: number, text: string) => Promise<void>;
  setSelectedFile: (file: File | null) => void;
  setEditingMessage: (editing: { id: number; text: string } | null) => void;
  setSearchFilter: (filter: string) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  isLoadingDialogs: false,
  isLoadingMoreDialogs: false,
  hasMoreDialogs: true,
  dialogsLimit: 100,
  categoryFilter: "all",
  isLoadingMessages: false,
  isUploading: false,
  selectedFile: null,
  filePreviewUrl: null,
  editingMessage: null,
  searchFilter: "",
  error: null,
  accounts: [],
  selectedAccountId: null,
  isScrolledUp: false,

  setIsScrolledUp: (scrolledUp: boolean) => set({ isScrolledUp: scrolledUp }),

  loadAccounts: async () => {
    try {
      const accs = await chatApi.fetchAccounts();
      set({ accounts: accs });
      if (accs.length > 0 && get().selectedAccountId === null) {
        set({ selectedAccountId: accs[0].id });
      }
    } catch {
      // fallback
    }
  },

  setSelectedAccountId: async (accountId: number | null) => {
    set({ selectedAccountId: accountId, activeChatId: null, messages: {} });
    await get().loadDialogs(true);
  },

  loadDialogs: async (resetLimit: boolean = false) => {
    const limit = resetLimit ? 100 : get().dialogsLimit;
    const accountId = get().selectedAccountId;
    set({ isLoadingDialogs: true, error: null, dialogsLimit: limit });
    try {
      const dialogs = await chatApi.fetchDialogs(limit, accountId || undefined);
      set({
        chats: dialogs,
        hasMoreDialogs: dialogs.length >= limit,
      });
      // If no chat is active and dialogs exist, select the first one
      const currentActive = get().activeChatId;
      if (!currentActive && dialogs.length > 0) {
        await get().selectChat(dialogs[0].id);
      }
    } catch (err) {
      console.error("Error cargando diálogos:", err);
      set({ error: "No se pudieron sincronizar los chats de Telegram." });
    } finally {
      set({ isLoadingDialogs: false });
    }
  },

  loadMoreDialogs: async () => {
    if (get().isLoadingMoreDialogs || !get().hasMoreDialogs) return;
    const nextLimit = get().dialogsLimit + 50;
    const accountId = get().selectedAccountId;
    set({ isLoadingMoreDialogs: true, error: null });
    try {
      const dialogs = await chatApi.fetchDialogs(nextLimit, accountId || undefined);
      set({
        chats: dialogs,
        dialogsLimit: nextLimit,
        hasMoreDialogs: dialogs.length >= nextLimit,
      });
    } catch (err) {
      console.error("Error cargando más diálogos:", err);
      set({ error: "No se pudieron cargar más conversaciones." });
    } finally {
      set({ isLoadingMoreDialogs: false });
    }
  },

  setCategoryFilter: (category: "all" | "channel" | "group" | "user") => {
    set({ categoryFilter: category });
  },

  selectChat: async (chatId: number) => {
    const prevUrl = get().filePreviewUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    set({
      activeChatId: chatId,
      selectedFile: null,
      filePreviewUrl: null,
      editingMessage: null,
    });
    const { messages } = get();

    // If messages for this chat are not loaded yet, fetch them
    if (!messages[chatId]) {
      set({ isLoadingMessages: true });
      try {
        const accountId = get().selectedAccountId;
        const chatMsgs = await chatApi.fetchMessages(chatId, 50, accountId || undefined);
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: chatMsgs,
          },
        }));
      } catch (err) {
        console.error(`Error cargando mensajes para el chat ${chatId}:`, err);
      } finally {
        set({ isLoadingMessages: false });
      }
    }
  },

  markAsRead: async (chatId: number, maxId?: number) => {
    try {
      const accountId = get().selectedAccountId;
      await chatApi.markAsRead(chatId, maxId, accountId || undefined);
      set((state) => {
        const chatMsgs = state.messages[chatId] || [];
        const highestMsgId =
          maxId ?? (chatMsgs.length > 0 ? Math.max(...chatMsgs.map((m) => m.id)) : 0);
        return {
          chats: state.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  unread_count: 0,
                  read_inbox_max_id: Math.max(c.read_inbox_max_id || 0, highestMsgId),
                }
              : c
          ),
          messages: {
            ...state.messages,
            [chatId]: chatMsgs.map((m) =>
              !m.is_outgoing && (!maxId || m.id <= maxId) ? { ...m, is_read: true } : m
            ),
          },
        };
      });
    } catch (err) {
      console.error(`Error al marcar chat ${chatId} como leído:`, err);
    }
  },

  setSearchFilter: (filter: string) => set({ searchFilter: filter }),

  sendMessage: async (text: string) => {
    const { activeChatId, messages } = get();
    if (!activeChatId || !text.trim()) return;

    const tempId = Date.now();
    const optimisticMessage: Message = {
      id: tempId,
      chat_id: activeChatId,
      sender_id: 999,
      sender_name: "Yo",
      text: text.trim(),
      date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      is_outgoing: true,
      media_type: "text",
      is_read: false,
    };

    const currentList = messages[activeChatId] || [];
    set({
      messages: {
        ...messages,
        [activeChatId]: [...currentList, optimisticMessage],
      },
      chats: get().chats.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              last_message: text.trim(),
              last_message_date: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : c
      ),
    });

    try {
      const sent = await chatApi.sendMessage(activeChatId, text.trim());
      set((state) => ({
        messages: {
          ...state.messages,
          [activeChatId]: (state.messages[activeChatId] || []).map((m) =>
            m.id === tempId ? { ...sent, is_read: sent.is_read ?? false } : m
          ),
        },
      }));
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      set({ error: "No se pudo enviar el mensaje a Telegram." });
    }
  },

  uploadMedia: async (file: File, caption?: string) => {
    const { activeChatId, messages } = get();
    if (!activeChatId) return;

    set({ isUploading: true, error: null });
    try {
      const sent = await chatApi.uploadMedia(activeChatId, file, caption);
      const currentList = messages[activeChatId] || [];
      const prevUrl = get().filePreviewUrl;
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      set((state) => ({
        messages: {
          ...state.messages,
          [activeChatId]: [...(state.messages[activeChatId] || currentList), sent],
        },
        selectedFile: null,
        filePreviewUrl: null,
      }));
    } catch (err) {
      console.error("Error subiendo archivo:", err);
      set({ error: "Error al subir el archivo multimedia al chat." });
    } finally {
      set({ isUploading: false });
    }
  },

  deleteMessage: async (messageId: number) => {
    const { activeChatId, messages } = get();
    if (!activeChatId) return;

    const currentList = messages[activeChatId] || [];
    // Optimistically remove
    set((state) => ({
      messages: {
        ...state.messages,
        [activeChatId]: (state.messages[activeChatId] || currentList).filter(
          (m) => m.id !== messageId
        ),
      },
    }));

    try {
      await chatApi.deleteMessage(activeChatId, messageId);
    } catch (err) {
      console.error(`Error al eliminar mensaje ${messageId}:`, err);
      set((state) => ({
        messages: {
          ...state.messages,
          [activeChatId]: currentList,
        },
        error: "No se pudo eliminar el mensaje.",
      }));
    }
  },

  editMessage: async (messageId: number, text: string) => {
    const { activeChatId, messages } = get();
    if (!activeChatId || !text.trim()) return;

    const currentList = messages[activeChatId] || [];
    set((state) => ({
      messages: {
        ...state.messages,
        [activeChatId]: (state.messages[activeChatId] || currentList).map((m) =>
          m.id === messageId ? { ...m, text: text.trim() } : m
        ),
      },
      editingMessage: null,
    }));

    try {
      const updated = await chatApi.editMessage(activeChatId, messageId, text.trim());
      set((state) => ({
        messages: {
          ...state.messages,
          [activeChatId]: (state.messages[activeChatId] || []).map((m) =>
            m.id === messageId ? updated : m
          ),
        },
      }));
    } catch (err) {
      console.error(`Error editando mensaje ${messageId}:`, err);
      set({ error: "No se pudo editar el mensaje." });
    }
  },

  setSelectedFile: (file: File | null) => {
    const prevUrl = get().filePreviewUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    if (!file) {
      set({ selectedFile: null, filePreviewUrl: null });
      return;
    }
    const url =
      file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : null;
    set({ selectedFile: file, filePreviewUrl: url });
  },

  setEditingMessage: (editing: { id: number; text: string } | null) => {
    set({ editingMessage: editing });
  },

  clearError: () => set({ error: null }),
}));
