import { Chat, Message } from "../domain/types";

export const chatApi = {
  async fetchDialogs(limit: number = 50): Promise<Chat[]> {
    const res = await fetch(`/api/dialogs?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener diálogos`);
    }
    return res.json();
  },

  async fetchMessages(chatId: number, limit: number = 50): Promise<Message[]> {
    const res = await fetch(`/api/dialogs/${chatId}/messages?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener mensajes del chat ${chatId}`);
    }
    return res.json();
  },
};
