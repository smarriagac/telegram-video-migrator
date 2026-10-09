import { create } from "zustand";
import { Chat, Message } from "../domain/types";

interface ChatState {
  chats: Chat[];
  activeChatId: number | null;
  messages: Record<number, Message[]>;
  isLoading: boolean;
  searchFilter: string;

  // Actions
  selectChat: (chatId: number) => void;
  sendMessage: (text: string) => void;
  setSearchFilter: (filter: string) => void;
}

const INITIAL_CHATS: Chat[] = [
  {
    id: 101,
    title: "Carlos Méndez",
    type: "user",
    unread_count: 2,
    last_message: "Che, ¿pudiste migrar los videos del canal?",
    last_message_date: "13:42",
    avatar_color: "bg-cyan-500",
  },
  {
    id: 102,
    title: "Comunidad Devs Telegram",
    type: "group",
    unread_count: 0,
    last_message: "Nuevo release de Telethon v1.36 listo",
    last_message_date: "12:15",
    avatar_color: "bg-emerald-500",
  },
  {
    id: 103,
    title: "Canal de Contenidos y Videos",
    type: "channel",
    unread_count: 0,
    last_message: "Video publicado: Resumen de arquitectura",
    last_message_date: "Ayer",
    avatar_color: "bg-purple-500",
  },
];

const INITIAL_MESSAGES: Record<number, Message[]> = {
  101: [
    {
      id: 1,
      chat_id: 101,
      sender_id: 101,
      sender_name: "Carlos Méndez",
      text: "Hola! Cómo va el desarrollo del migrador?",
      date: "13:35",
      is_outgoing: false,
    },
    {
      id: 2,
      chat_id: 101,
      sender_id: 999,
      sender_name: "Yo",
      text: "Impecable, ya soporta clonación limpia por referencia sin descargar nada.",
      date: "13:40",
      is_outgoing: true,
    },
    {
      id: 3,
      chat_id: 101,
      sender_id: 101,
      sender_name: "Carlos Méndez",
      text: "Che, ¿pudiste migrar los videos del canal?",
      date: "13:42",
      is_outgoing: false,
    },
  ],
};

export const useChatStore = create<ChatState>((set, get) => ({
  chats: INITIAL_CHATS,
  activeChatId: 101,
  messages: INITIAL_MESSAGES,
  isLoading: false,
  searchFilter: "",

  selectChat: (chatId) => set({ activeChatId: chatId }),

  setSearchFilter: (filter) => set({ searchFilter: filter }),

  sendMessage: (text) => {
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
