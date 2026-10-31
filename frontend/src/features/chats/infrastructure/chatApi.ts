import { Chat, Message } from "../domain/types";

export const chatApi = {
  async fetchDialogs(limit: number = 100): Promise<Chat[]> {
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

  async sendMessage(chatId: number, text: string): Promise<Message> {
    const res = await fetch(`/api/dialogs/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al enviar mensaje`);
    }
    return res.json();
  },

  async uploadMedia(chatId: number, file: File, caption?: string): Promise<Message> {
    const formData = new FormData();
    formData.append("file", file);
    if (caption) {
      formData.append("caption", caption);
    }
    const res = await fetch(`/api/dialogs/${chatId}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al subir archivo al chat`);
    }
    return res.json();
  },

  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    const res = await fetch(`/api/dialogs/${chatId}/messages/${messageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al eliminar mensaje`);
    }
  },

  async editMessage(chatId: number, messageId: number, text: string): Promise<Message> {
    const res = await fetch(`/api/dialogs/${chatId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al editar mensaje`);
    }
    return res.json();
  },
};
