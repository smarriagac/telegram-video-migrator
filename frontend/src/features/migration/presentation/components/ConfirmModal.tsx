import React from "react";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const channels = useMigrationStore((state) => state.channels);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const isStarting = useMigrationStore((state) => state.isStartingJob);

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);
  const targetChannel = channels.find((c) => c.id === selectedTargetId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Confirmar Migración</DialogTitle>
              <DialogDescription>
                Verificá los canales seleccionados antes de disparar el proceso.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Source -> Target Channel Preview */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-mono">ORIGEN:</span>
            <span className="text-cyan-400 font-semibold">{sourceChannel?.title || selectedSourceId}</span>
          </div>
          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4 rotate-90 md:rotate-0" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-mono">DESTINO:</span>
            <span className="text-emerald-400 font-semibold">{targetChannel?.title || selectedTargetId}</span>
          </div>
        </div>

        {/* Technical Safeguards */}
        <div className="space-y-2 text-xs text-zinc-400 py-1">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Los videos se clonan directamente por referencia interna sin descargar archivos a disco.</span>
          </div>
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se preservan descripciones originales, etiquetas y hashtags sin etiqueta de reenvío.</span>
          </div>
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se aplica un delay seguro de 1.5–2.0s por video para proteger la cuenta contra spam.</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isStarting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isStarting}
          >
            {isStarting ? "Iniciando..." : "Iniciar Migración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
