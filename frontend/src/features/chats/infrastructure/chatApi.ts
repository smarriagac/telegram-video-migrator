import { Chat, Message } from "../domain/types";

export const chatApi = {
  async fetchDialogs(limit: number = 100, accountId?: number): Promise<Chat[]> {
    const url = accountId ? `/api/dialogs?limit=${limit}&account_id=${accountId}` : `/api/dialogs?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener diálogos`);
    }
    return res.json();
  },

  async fetchMessages(chatId: number, limit: number = 50, accountId?: number): Promise<Message[]> {
    const url = accountId ? `/api/dialogs/${chatId}/messages?limit=${limit}&account_id=${accountId}` : `/api/dialogs/${chatId}/messages?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener mensajes del chat ${chatId}`);
    }
    return res.json();
  },

  async fetchAccounts(): Promise<{ id: number; name: string }[]> {
    try {
      const token = localStorage.getItem("telegram_hub_token") || localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/settings/credentials`, { headers });
      if (!res.ok) return [];
      const accounts = await res.json();
      return accounts.map((a: any) => ({ id: a.id, name: a.name }));
    } catch {
      return [];
    }
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

  async markAsRead(chatId: number, maxId?: number, accountId?: number): Promise<void> {
    const url = accountId ? `/api/dialogs/${chatId}/read?account_id=${accountId}` : `/api/dialogs/${chatId}/read`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_id: maxId ?? null }),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al marcar diálogo como leído`);
    }
  },

  async clickMessageButton(
    chatId: number,
    messageId: number,
    payload: {
      button_text?: string;
      row?: number;
      col?: number;
      account_id?: number | null;
    }
  ): Promise<boolean> {
    const res = await fetch(`/api/dialogs/${chatId}/messages/${messageId}/click-button`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al interactuar con el botón del bot`);
    }
    const data = await res.json();
    return !!data.success;
  },
};
