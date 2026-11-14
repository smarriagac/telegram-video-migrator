import React, { useState } from "react";
import { Forward, Send, Loader2, AlertCircle } from "lucide-react";
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
import { Channel } from "@/features/migration/domain/types";
import { SearchableChannelSelect } from "@/features/migration/presentation/components/SearchableChannelSelect";
import { chatApi } from "../../infrastructure/chatApi";

interface ForwardMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChatId: number;
  messageIds: number[];
  channels: Channel[];
  accountId?: number | null;
  onSuccess: () => void;
}

export const ForwardMessagesModal: React.FC<ForwardMessagesModalProps> = ({
  isOpen,
  onClose,
  sourceChatId,
  messageIds,
  channels,
  accountId,
  onSuccess,
}) => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  // Hook 1: Selected destination channel
  const [targetChatId, setTargetChatId] = useState<number | null>(null);

  // Hook 2: Submission and error UI state
  const [uiState, setUiState] = useState<{ isSubmitting: boolean; error: string | null }>({
    isSubmitting: false,
    error: null,
  });

  if (!isOpen) return null;

  const handleForward = async () => {
    if (!targetChatId) {
      setUiState((s) => ({ ...s, error: "Seleccioná un chat de destino para reenviar." }));
      return;
    }

    setUiState({ isSubmitting: true, error: null });
    try {
      await chatApi.forwardMessages(sourceChatId, [targetChatId], messageIds, accountId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setUiState({
        isSubmitting: false,
        error: err.message || "Error al reenviar mensajes",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-background border-border">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Forward className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                Reenviar Mensajes
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-mono">
                  {messageIds.length} {messageIds.length === 1 ? "mensaje" : "mensajes"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Elegí el canal, grupo o chat directo donde querés reenviar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {uiState.error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uiState.error}</span>
          </div>
        )}

        <div className="space-y-3 py-2">
          <label className="text-xs font-semibold text-foreground">
            Chat o Canal de Destino:
          </label>
          <SearchableChannelSelect
            value={targetChatId}
            onChange={(id) => {
              setTargetChatId(id);
              if (uiState.error) setUiState((s) => ({ ...s, error: null }));
            }}
            channels={channels}
            placeholder="Buscar canal o conversación..."
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={uiState.isSubmitting}
            className="text-xs h-8 cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleForward}
            disabled={uiState.isSubmitting || !targetChatId}
            className="text-xs h-8 gap-1.5 font-semibold bg-primary hover:bg-primary/90 cursor-pointer"
          >
            {uiState.isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reenviando...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Reenviar ahora</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
