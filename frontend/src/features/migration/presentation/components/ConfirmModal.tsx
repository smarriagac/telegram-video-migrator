import React from "react";
import { AlertTriangle, ArrowRight, ShieldCheck, Clock } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const channels = useMigrationStore((state) => state.channels);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);
  const isStarting = useMigrationStore((state) => state.isStartingJob);
  const scheduledAt = useMigrationStore((state) => state.scheduledAt);
  const setScheduledAt = useMigrationStore((state) => state.setScheduledAt);

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);
  const targetChannel = channels.find((c) => c.id === selectedTargetId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md space-y-3">
        <DialogHeader>
          <div className="flex items-center space-x-2.5 mb-0.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm">Confirmar Migración</DialogTitle>
              <DialogDescription className="text-xs">
                Verificá los canales y la planificación antes de confirmar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Source -> Target Channel Preview */}
        <div className="p-3 rounded-lg bg-secondary/60 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono text-[11px]">ORIGEN:</span>
            <span className="text-primary font-semibold">{sourceChannel?.title || selectedSourceId}</span>
          </div>
          <div className="flex justify-center text-muted-foreground">
            <ArrowRight className="w-3.5 h-3.5 rotate-90 md:rotate-0" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono text-[11px]">DESTINO:</span>
            <span className="text-emerald-500 dark:text-emerald-400 font-semibold">{targetChannel?.title || selectedTargetId}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
            <span className="text-muted-foreground font-mono text-[11px]">ALCANCE:</span>
            <span className="text-primary font-mono text-[11px]">
              {selectedMessageIds.length > 0
                ? `${selectedMessageIds.length} elementos seleccionados`
                : "Todos los mensajes del canal"}
            </span>
          </div>
        </div>

        {/* Smart Scheduler Section */}
        <div className="p-2.5 rounded-lg bg-secondary/40 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-medium text-foreground">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Smart Scheduler (Programar Tarea)</span>
            </div>
            {scheduledAt && (
              <button
                type="button"
                onClick={() => setScheduledAt(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Limpiar (Ejecutar Ya)
              </button>
            )}
          </div>
          <input
            type="datetime-local"
            value={scheduledAt ? scheduledAt.slice(0, 16) : ""}
            onChange={(e) => {
              if (e.target.value) {
                setScheduledAt(new Date(e.target.value).toISOString());
              } else {
                setScheduledAt(null);
              }
            }}
            className="w-full bg-secondary/80 border border-border rounded-md px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-cyan-400"
          />
          <p className="text-[10px] text-muted-foreground">
            {scheduledAt
              ? `Se programará para iniciar automáticamente el ${new Date(scheduledAt).toLocaleString()}.`
              : "Dejalo vacío para iniciar la migración inmediatamente."}
          </p>
        </div>

        {/* Technical Safeguards */}
        <div className="space-y-1.5 text-[11px] text-muted-foreground py-0.5">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>Los mensajes y archivos se clonan directamente por referencia interna o fallback resiliente.</span>
          </div>
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se preservan descripciones originales, etiquetas y formato sin etiqueta de reenvío.</span>
          </div>
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se aplica un delay seguro de 1.5–2.0s por elemento para proteger la cuenta contra spam.</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isStarting}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onConfirm}
            disabled={isStarting}
            className={cn(
              "h-8 text-xs",
              scheduledAt ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""
            )}
          >
            {isStarting
              ? "Procesando..."
              : scheduledAt
              ? "Programar Migración"
              : "Iniciar Migración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
