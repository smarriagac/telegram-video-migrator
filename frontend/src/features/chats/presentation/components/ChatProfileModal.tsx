import React, { useEffect, useRef, useState } from "react";
import {
  Users,
  Radio,
  Camera,
  Copy,
  Check,
  Link,
  Loader2,
  AlertCircle,
  Hash,
  AtSign,
  Info,
  Bot,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ChatAvatar } from "@/shared/components/ui/chat-avatar";
import { Chat, ChatFullInfo } from "../../domain/types";
import { chatApi } from "../../infrastructure/chatApi";

interface ChatProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  accountId?: number | null;
  onAvatarUpdated?: () => void;
}

export const ChatProfileModal: React.FC<ChatProfileModalProps> = ({
  isOpen,
  onClose,
  chat,
  accountId,
  onAvatarUpdated,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  // Hook 1: Detailed profile info
  const [info, setInfo] = useState<ChatFullInfo | null>(null);

  // Hook 2: UI status (loading, uploading, copied notification, error)
  const [uiState, setUiState] = useState<{
    isLoading: boolean;
    isUploadingPhoto: boolean;
    error: string | null;
    copiedField: string | null;
  }>({
    isLoading: false,
    isUploadingPhoto: false,
    error: null,
    copiedField: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && chat) {
      setUiState((s) => ({ ...s, isLoading: true, error: null }));
      chatApi
        .fetchChatFullInfo(chat.id, accountId || chat.account_id)
        .then((data) => {
          setInfo(data);
          setUiState((s) => ({ ...s, isLoading: false }));
        })
        .catch((err) => {
          setInfo({
            id: chat.id,
            title: chat.title,
            username: chat.username,
            type: chat.type,
            participants_count: chat.participants_count,
            online_count: chat.online_count,
            is_creator: chat.is_creator,
            is_admin: chat.is_admin,
          });
          setUiState((s) => ({
            ...s,
            isLoading: false,
            error: err.message || "Error al cargar información extendida",
          }));
        });
    }
  }, [isOpen, chat, accountId]);

  if (!isOpen || !chat) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setUiState((s) => ({ ...s, copiedField: field }));
    setTimeout(() => {
      setUiState((s) => ({ ...s, copiedField: null }));
    }, 2000);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUiState((s) => ({ ...s, isUploadingPhoto: true, error: null }));
    try {
      await chatApi.updateChatPhoto(chat.id, file, accountId || chat.account_id);
      setUiState((s) => ({ ...s, isUploadingPhoto: false }));
      onAvatarUpdated?.();
    } catch (err: any) {
      setUiState((s) => ({
        ...s,
        isUploadingPhoto: false,
        error: err.message || "Error al actualizar foto de perfil",
      }));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const canEditPhoto =
    Boolean(chat.is_creator || chat.is_admin || info?.can_change_info);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-background border-border p-0 overflow-hidden">
        {/* Cover / Header section */}
        <DialogHeader className="relative bg-gradient-to-b from-primary/20 via-background to-background p-6 flex flex-col items-center text-center border-b border-border/40">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handlePhotoSelect}
          />

          <div className="relative group/avatar mb-3">
            <ChatAvatar
              id={chat.id}
              title={chat.title}
              avatarColor={chat.avatar_color}
              accountId={accountId || chat.account_id}
              className="w-20 h-20 rounded-2xl shadow-xl ring-2 ring-border"
            />
            {canEditPhoto && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uiState.isUploadingPhoto}
                className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-medium transition-all backdrop-blur-[2px] cursor-pointer"
                title="Cambiar foto del canal/chat"
              >
                {uiState.isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span>Cambiar</span>
                  </>
                )}
              </button>
            )}
          </div>

          <DialogTitle className="text-base font-bold text-foreground flex items-center justify-center gap-1.5 flex-wrap">
            <span>{chat.title}</span>
            {chat.is_creator && (
              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                PROPIETARIO
              </Badge>
            )}
            {chat.is_admin && !chat.is_creator && (
              <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                ADMIN
              </Badge>
            )}
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-mono">
            {chat.username ? `@${chat.username}` : `ID: ${chat.id}`}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {uiState.error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{uiState.error}</span>
            </div>
          )}

          {/* Description / Bio */}
          {info?.about && (
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Descripción</span>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {info.about}
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-2.5 text-xs">
            {/* Type & Participants */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                {chat.type === "channel" ? (
                  <Radio className="w-3.5 h-3.5 text-primary" />
                ) : chat.type === "group" ? (
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-pink-400" />
                )}
                <span>Tipo:</span>
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {chat.type}
              </Badge>
            </div>

            {(info?.participants_count || chat.participants_count) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Miembros / Suscriptores:</span>
                <span className="font-semibold text-foreground font-mono">
                  {(info?.participants_count || chat.participants_count)?.toLocaleString()}
                </span>
              </div>
            )}

            {/* Username Copy */}
            {chat.username && (
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5" />
                  <span>Enlace público:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-foreground">
                    @{chat.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`https://t.me/${chat.username}`, "username")}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copiar enlace público"
                  >
                    {uiState.copiedField === "username" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Private Invite Link Copy */}
            {info?.invite_link && (
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5 truncate mr-2">
                  <Link className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Enlace de invitación:</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[11px] text-primary max-w-[130px] truncate">
                    {info.invite_link}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(info.invite_link!, "invite")}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copiar enlace de invitación"
                  >
                    {uiState.copiedField === "invite" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Chat ID Copy */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>Telegram Chat ID:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {chat.id}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(chat.id), "id")}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copiar Chat ID"
                >
                  {uiState.copiedField === "id" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border bg-card/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-7 ml-auto cursor-pointer"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
