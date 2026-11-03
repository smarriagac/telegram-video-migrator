import React, { useState } from "react";
import {
  CalendarCheck,
  ArrowRight,
  Clock,
  Layers,
  Copy,
  Check,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";

export interface ScheduledSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewJobs: () => void;
  jobId: string;
  sourceTitle: string;
  targetTitle: string;
  scheduledAt: string;
  itemCount: number | "all";
}

export const ScheduledSuccessModal: React.FC<ScheduledSuccessModalProps> = ({
  isOpen,
  onClose,
  onViewJobs,
  jobId,
  sourceTitle,
  targetTitle,
  scheduledAt,
  itemCount,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(scheduledAt);
      return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(d);
    } catch {
      return scheduledAt;
    }
  }, [scheduledAt]);

  const handleCopyJobId = () => {
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl p-5 space-y-4">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-bold text-foreground">
                  ¡Migración Programada con Éxito!
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] px-1.5 py-0 font-mono"
                >
                  SCHEDULED
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                La tarea fue registrada en la cola y se ejecutará de forma automática.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Date and Execution Highlight Card */}
        <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Fecha y Hora de Ejecución:</span>
          </div>
          <div className="text-sm font-bold text-foreground capitalize pl-6">
            {formattedDate}
          </div>
        </div>

        {/* Channels & Scope Details */}
        <div className="p-3 rounded-lg bg-secondary/60 border border-border space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-mono text-[11px]">ORIGEN:</span>
            <span className="text-primary font-semibold truncate max-w-[220px]">
              {sourceTitle}
            </span>
          </div>
          <div className="flex justify-center text-muted-foreground py-0.5">
            <ArrowRight className="w-3.5 h-3.5 rotate-90 md:rotate-0" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-mono text-[11px]">DESTINO:</span>
            <span className="text-emerald-500 dark:text-emerald-400 font-semibold truncate max-w-[220px]">
              {targetTitle}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-border">
            <span className="text-muted-foreground font-mono text-[11px]">ALCANCE:</span>
            <span className="text-foreground font-medium font-mono text-[11px]">
              {itemCount === "all"
                ? "Todos los mensajes del canal"
                : `${itemCount} elementos seleccionados`}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-muted-foreground font-mono text-[11px]">ID DE TAREA:</span>
            <button
              type="button"
              onClick={handleCopyJobId}
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground bg-card px-2 py-0.5 rounded border border-border"
              title="Copiar ID de la tarea"
            >
              <span className="truncate max-w-[150px]">{jobId}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Technical Guarantee Notice */}
        <div className="flex items-start space-x-2 text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-border/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Smart Scheduler activo: podés cerrar la ventana o continuar trabajando en otros canales. El microservicio despertará automáticamente la tarea en el momento programado.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-1.5 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onViewJobs}
            className="h-8 text-xs font-semibold px-4 bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            Ver en Cola de Trabajos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
