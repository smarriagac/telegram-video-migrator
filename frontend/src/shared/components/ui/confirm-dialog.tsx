import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl p-5 space-y-3">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-1">
            <div
              className={
                variant === "destructive"
                  ? "w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0"
                  : "w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0"
              }
            >
              {variant === "destructive" ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-1.5 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isLoading}
            className="h-8 text-xs font-semibold px-4"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
