import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { useChatStore } from "../application/useChatStore";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export const ChatsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Maximum 2 useState hooks per view.
  // We use exactly 1 hook for local controlled text input. All other state is in Zustand.
  const [inputText, setInputText] = useState<string>("");

  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const messages = useChatStore((state) => state.messages);
  const searchFilter = useChatStore((state) => state.searchFilter);
  const isLoadingDialogs = useChatStore((state) => state.isLoadingDialogs);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  const loadDialogs = useChatStore((state) => state.loadDialogs);
  const selectChat = useChatStore((state) => state.selectChat);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setSearchFilter = useChatStore((state) => state.setSearchFilter);

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const activeMessages = activeChat ? messages[activeChat.id] || [] : [];

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText("");
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-cyan-400" />
            Chats & Conversaciones
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Diálogos reales de Telegram sincronizados en vivo mediante el gateway MTProto.
          </p>
        </div>

        <Button
          onClick={() => loadDialogs()}
          disabled={isLoadingDialogs}
          variant="outline"
          size="sm"
          className="rounded-md border-white/10 text-xs hover:bg-white/5"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5 mr-1.5", isLoadingDialogs && "animate-spin text-cyan-400")}
          />
          Sincronizar
        </Button>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 md:grid-cols-12 h-[680px] bg-[#14161F] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        {/* Left Column: Chat List (4 cols) */}
        <aside className="md:col-span-5 lg:col-span-4 border-r border-white/5 flex flex-col bg-[#10121A]/50">
          {/* Search Bar */}
          <div className="p-3.5 border-b border-white/5">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar chats o usuarios..."
                className="w-full bg-zinc-950/80 border border-white/10 rounded-md pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                aria-label="Buscar chats"
              />
            </div>
          </div>

          {/* List of Chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
            {isLoadingDialogs && chats.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-center text-xs text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Cargando conversaciones desde MTProto...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No se encontraron conversaciones
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = chat.id === activeChat?.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => selectChat(chat.id)}
                    className={cn(
                      "w-full text-left p-3.5 transition-all flex items-start gap-3 hover:bg-white/[0.03]",
                      isActive && "bg-cyan-500/10 border-l-2 border-cyan-400"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md",
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
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {chat.last_message_date}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] text-zinc-400 truncate max-w-[170px]">
                          {chat.last_message || "Sin mensajes"}
                        </p>
                        {chat.unread_count > 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500 text-black font-bold">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-500 font-mono uppercase">
                        {getChatIcon(chat.type)}
                        <span>{chat.type}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Active Conversation (7-8 cols) */}
        <section className="md:col-span-7 lg:col-span-8 flex flex-col bg-[#14161F]">
          {activeChat ? (
            <>
              {/* Conversation Header */}
              <div className="p-3.5 border-b border-white/5 flex items-center justify-between bg-[#12141C]">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white",
                      activeChat.avatar_color || "bg-cyan-600"
                    )}
                  >
                    {activeChat.title.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white leading-none">
                      {activeChat.title}
                    </h2>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      MTProto Stream Activo
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 rounded-md hover:bg-white/5 text-zinc-400"
                    aria-label="Más opciones"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col">
                <div className="text-center my-2">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-zinc-900 border border-white/5 text-zinc-400">
                    Cifrado y transmitido a través de Telegram MTProto
                  </span>
                </div>

                {isLoadingMessages ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                    <span className="text-xs">Cargando mensajes del chat...</span>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                    <p className="text-xs">No hay mensajes recientes en esta conversación.</p>
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[75%] rounded-lg p-3 text-xs flex flex-col shadow-md",
                        msg.is_outgoing
                          ? "self-end bg-cyan-600/20 border border-cyan-500/30 text-cyan-50"
                          : "self-start bg-[#1C1F2B] border border-white/5 text-zinc-200"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono opacity-60 mb-1">
                        <span className="font-semibold">{msg.sender_name}</span>
                        <span>{msg.date}</span>
                      </div>
                      <p className="leading-relaxed break-words">{msg.text}</p>
                      {msg.is_outgoing && (
                        <div className="self-end mt-1 text-cyan-400 opacity-80">
                          <CheckCheck className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Message Input Footer */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-white/5 bg-[#12141C] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribí un mensaje..."
                  className="flex-1 bg-zinc-950/80 border border-white/10 rounded-md px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  aria-label="Mensaje a enviar"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md px-4 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <ShieldAlert className="w-10 h-10 mb-2 opacity-40 text-cyan-400" />
              <p className="text-xs">Seleccioná un chat de la lista para ver el historial.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
