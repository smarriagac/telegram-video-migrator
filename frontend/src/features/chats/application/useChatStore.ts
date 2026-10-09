import { create } from "zustand";
import { Chat, Message } from "../domain/types";
import { chatApi } from "../infrastructure/chatApi";

interface ChatState {
  chats: Chat[];
  activeChatId: number | null;
  messages: Record<number, Message[]>;
  isLoadingDialogs: boolean;
  isLoadingMessages: boolean;
  searchFilter: string;
  error: string | null;

  // Actions
  loadDialogs: () => Promise<void>;
  selectChat: (chatId: number) => Promise<void>;
  sendMessage: (text: string) => void;
  setSearchFilter: (filter: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  isLoadingDialogs: false,
  isLoadingMessages: false,
  searchFilter: "",
  error: null,

  loadDialogs: async () => {
    set({ isLoadingDialogs: true, error: null });
    try {
      const dialogs = await chatApi.fetchDialogs();
      set({ chats: dialogs });
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

  selectChat: async (chatId: number) => {
    set({ activeChatId: chatId });
    const { messages } = get();

    // If messages for this chat are not loaded yet, fetch them
    if (!messages[chatId]) {
      set({ isLoadingMessages: true });
      try {
        const chatMsgs = await chatApi.fetchMessages(chatId);
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

  setSearchFilter: (filter: string) => set({ searchFilter: filter }),

  sendMessage: (text: string) => {
    const { activeChatId, messages } = get();
    if (!activeChatId || !text.trim()) return;

    const currentList = messages[activeChatId] || [];
    const newMessage: Message = {
      id: Date.now(),
      chat_id: activeChatId,
      sender_id: 999,
      sender_name: "Yo",
      text: text.trim(),
      date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      is_outgoing: true,
    };

    set({
      messages: {
        ...messages,
        [activeChatId]: [...currentList, newMessage],
      },
    });
  },
}));
