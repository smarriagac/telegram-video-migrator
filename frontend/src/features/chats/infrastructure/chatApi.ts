import { Chat, Message, ResolvedMessageLink, ChatHashtagReport } from "../domain/types";

export const chatApi = {
  async fetchDialogs(limit: number = 100, accountId?: number): Promise<Chat[]> {
    const url = accountId ? `/api/dialogs?limit=${limit}&account_id=${accountId}` : `/api/dialogs?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener diálogos`);
    }
    return res.json();
  },

  async fetchMessages(chatId: number, limit: number = 50, accountId?: number, query?: string): Promise<Message[]> {
    let url = `/api/dialogs/${chatId}/messages?limit=${limit}`;
    if (accountId) {
      url += `&account_id=${accountId}`;
    }
    if (query) {
      url += `&query=${encodeURIComponent(query)}`;
    }
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

  async forwardMessages(
    chatId: number,
    targetChatIds: number[],
    messageIds: number[],
    accountId?: number | null
  ): Promise<{ success: boolean; forwarded_count: number; forwarded_message_ids: number[] }> {
    const res = await fetch(`/api/dialogs/${chatId}/messages/forward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_chat_ids: targetChatIds,
        message_ids: messageIds,
        account_id: accountId ?? null,
      }),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al reenviar mensajes`);
    }
    return res.json();
  },

  async checkInvite(
    inviteUrl: string,
    accountId?: number | null
  ): Promise<{ success: boolean; invite: any }> {
    const res = await fetch("/api/dialogs/check-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_url: inviteUrl,
        account_id: accountId ?? null,
      }),
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al verificar enlace`);
    }
    return res.json();
  },

  async joinInvite(
    inviteUrl: string,
    accountId?: number | null
  ): Promise<{ success: boolean; result: any }> {
    const res = await fetch("/api/dialogs/join-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_url: inviteUrl,
        account_id: accountId ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al unirse" }));
      throw new Error(err.detail || `Error ${res.status} al unirse`);
    }
    return res.json();
  },

  async fetchChatFullInfo(chatId: number, accountId?: number | null): Promise<any> {
    const url = accountId
      ? `/api/dialogs/${chatId}/full-info?account_id=${accountId}`
      : `/api/dialogs/${chatId}/full-info`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener detalles del chat`);
    }
    const data = await res.json();
    return data.chat;
  },

  async updateChatPhoto(chatId: number, file: File, accountId?: number | null): Promise<boolean> {
    const formData = new FormData();
    formData.append("file", file);
    const url = accountId
      ? `/api/dialogs/${chatId}/photo?account_id=${accountId}`
      : `/api/dialogs/${chatId}/photo`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al actualizar foto del chat`);
    }
    const data = await res.json();
    return !!data.success;
  },

  async resolveMessageLink(
    url: string,
    accountId?: number | null
  ): Promise<ResolvedMessageLink> {
    const res = await fetch("/api/dialogs/resolve-message-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        account_id: accountId ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al resolver mensaje" }));
      throw new Error(err.detail || `Error ${res.status} al resolver mensaje`);
    }
    return res.json();
  },

  async openBot(
    botUsername: string,
    startParam?: string | null,
    accountId?: number | null
  ): Promise<{ success: boolean; chat_id: number; chat_title: string; chat_username: string }> {
    const res = await fetch("/api/dialogs/open-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bot_username: botUsername,
        start_param: startParam ?? null,
        account_id: accountId ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al interactuar con el bot" }));
      throw new Error(err.detail || `Error ${res.status} al abrir el bot`);
    }
    return res.json();
  },

  async fetchChatHashtags(
    chatId: number,
    limit: number = 200,
    accountId?: number | null
  ): Promise<ChatHashtagReport> {
    let url = `/api/dialogs/${chatId}/hashtags?limit=${limit}`;
    if (accountId) {
      url += `&account_id=${accountId}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al extraer hashtags" }));
      throw new Error(err.detail || `Error ${res.status} al extraer hashtags del chat`);
    }
    return res.json();
  },
};
