import React, { useEffect, useState } from "react";
import { Users, Radio, ExternalLink, Loader2, AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
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
import { chatApi } from "../../infrastructure/chatApi";

interface JoinInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUrl: string;
  accountId?: number | null;
  onJoined: (chatId?: number) => void;
}

interface InvitePreviewData {
  title: string;
  type: string;
  participants_count?: number | null;
  about?: string | null;
  already_joined?: boolean;
  chat_id?: number | null;
  hash?: string;
  username?: string;
}

export const JoinInviteModal: React.FC<JoinInviteModalProps> = ({
  isOpen,
  onClose,
  inviteUrl,
  accountId,
  onJoined,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  // Hook 1: Invite details data
  const [data, setData] = useState<InvitePreviewData | null>(null);

  // Hook 2: UI status (loading, joining, error)
  const [uiState, setUiState] = useState<{
    isLoading: boolean;
    isJoining: boolean;
    error: string | null;
  }>({
    isLoading: false,
    isJoining: false,
    error: null,
  });

  useEffect(() => {
    if (isOpen && inviteUrl) {
      setUiState({ isLoading: true, isJoining: false, error: null });
      setData(null);

      chatApi
        .checkInvite(inviteUrl, accountId)
        .then((res) => {
          if (res.success && res.invite) {
            setData(res.invite);
          } else {
            setData({
              title: "Enlace de Invitación",
              type: "channel",
              hash: inviteUrl,
            });
          }
          setUiState((s) => ({ ...s, isLoading: false }));
        })
        .catch((err) => {
          setUiState({
            isLoading: false,
            isJoining: false,
            error: err.message || "No se pudo verificar el enlace.",
          });
        });
    }
  }, [isOpen, inviteUrl, accountId]);

  if (!isOpen) return null;

  const handleJoin = async () => {
    if (data?.already_joined && data.chat_id) {
      onJoined(data.chat_id);
      onClose();
      return;
    }

    setUiState((s) => ({ ...s, isJoining: true, error: null }));
    try {
      const res = await chatApi.joinInvite(inviteUrl, accountId);
      const joinedChatId = res.result?.chat_id || data?.chat_id;
      onJoined(joinedChatId);
      onClose();
    } catch (err: any) {
      setUiState((s) => ({
        ...s,
        isJoining: false,
        error: err.message || "Error al unirse al canal/grupo",
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm bg-background border-border p-4 sm:p-6">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            {data?.type === "channel" ? <Radio className="w-6 h-6" /> : <Users className="w-6 h-6" />}
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            {uiState.isLoading ? "Verificando enlace..." : data?.title || "Invitación de Telegram"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground break-all font-mono">
            {inviteUrl}
          </DialogDescription>
        </DialogHeader>

        {uiState.isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Consultando en Telegram MTProto...</span>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {uiState.error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{uiState.error}</span>
              </div>
            )}

            {data && (
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tipo de comunidad:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {data.type || "Comunidad"}
                  </Badge>
                </div>

                {data.participants_count !== undefined && data.participants_count !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Miembros / Suscriptores:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {data.participants_count.toLocaleString()}
                    </span>
                  </div>
                )}

                {data.about && (
                  <div className="pt-1.5 border-t border-border/60">
                    <p className="text-[11px] text-muted-foreground line-clamp-3 italic">
                      "{data.about}"
                    </p>
                  </div>
                )}

                {data.already_joined && (
                  <div className="pt-1 text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ya sos miembro de este chat</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={uiState.isJoining}
            className="text-xs h-8 cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleJoin}
            disabled={uiState.isLoading || uiState.isJoining}
            className="text-xs h-8 gap-1.5 font-semibold bg-primary hover:bg-primary/90 cursor-pointer"
          >
            {uiState.isJoining ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uniéndose...</span>
              </>
            ) : data?.already_joined ? (
              <>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Chat</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Unirse al Grupo</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
