import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { migrationApi } from "../../infrastructure/migrationApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { DateTimePicker } from "@/shared/components/ui/date-time-picker";
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
  const dripDelaySeconds = useMigrationStore((state) => state.dripDelaySeconds);

  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 1 useState hook for pre-flight state
  const [preFlight, setPreFlight] = useState<{
    isLoading: boolean;
    report: any | null;
    error: string | null;
  }>({
    isLoading: false,
    report: null,
    error: null,
  });

  useEffect(() => {
    if (!isOpen || !selectedSourceId || !selectedTargetId) {
      setPreFlight({ isLoading: false, report: null, error: null });
      return;
    }

    let isMounted = true;
    setPreFlight({ isLoading: true, report: null, error: null });

    migrationApi
      .checkPreFlight({
        source_channel_id: selectedSourceId,
        target_channel_id: selectedTargetId,
        selected_message_ids: selectedMessageIds.length > 0 ? selectedMessageIds : undefined,
        drip_delay_seconds: dripDelaySeconds,
      })
      .then((res) => {
        if (isMounted) {
          setPreFlight({ isLoading: false, report: res, error: null });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setPreFlight({ isLoading: false, report: null, error: err.message });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedSourceId, selectedTargetId, selectedMessageIds, dripDelaySeconds]);

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);
  const targetChannel = channels.find((c) => c.id === selectedTargetId);

  const report = preFlight.report;
  const isBlocked = report && !report.can_proceed;

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
                Verificá la simulación de pre-flight y la planificación antes de confirmar.
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
            <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
              {targetChannel?.title || selectedTargetId}
            </span>
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

        {/* Pre-Flight Simulation Panel */}
        <div className="p-3 rounded-lg bg-card border border-border space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5 text-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Pre-Flight Check (Simulación)
            </span>
            {preFlight.isLoading ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-primary" /> Verificando...
              </span>
            ) : isBlocked ? (
              <span className="text-rose-500 font-semibold text-[11px] flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Bloqueado
              </span>
            ) : report ? (
              <span className="text-emerald-500 font-semibold text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Listo para Iniciar
              </span>
            ) : null}
          </div>

          {report && (
            <>
              {/* Quick metrics grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-1.5 rounded bg-secondary/50 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Nuevos</span>
                  <span className="text-foreground font-semibold">
                    {report.new_items_to_migrate || report.total_requested_items || 0}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-secondary/50 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Duplicados</span>
                  <span className="text-amber-500 font-semibold">{report.already_cloned_items}</span>
                </div>
                <div className="p-1.5 rounded bg-secondary/50 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Est. Tiempo</span>
                  <span className="text-primary font-semibold">
                    {report.estimated_duration_seconds > 60
                      ? `${Math.round(report.estimated_duration_seconds / 60)} min`
                      : `${report.estimated_duration_seconds}s`}
                  </span>
                </div>
              </div>

              {/* Errors Block */}
              {report.errors.length > 0 && (
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 space-y-1">
                  {report.errors.map((err: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] leading-tight">
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings Block */}
              {report.warnings.length > 0 && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 space-y-1">
                  {report.warnings.map((warn: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] leading-tight">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Smart Scheduler Section */}
        <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Smart Scheduler (Programar Publicación)</span>
            </div>
            {scheduledAt && (
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                Programado
              </span>
            )}
          </div>
          <DateTimePicker
            value={scheduledAt ? new Date(scheduledAt) : undefined}
            onChange={(date) => setScheduledAt(date ? date.toISOString() : null)}
            placeholder="Ejecutar inmediatamente (o elegir fecha y hora futura)"
          />
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
            disabled={isStarting || Boolean(isBlocked)}
            className={cn(
              "h-8 text-xs",
              scheduledAt ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""
            )}
          >
            {isStarting
              ? "Procesando..."
              : isBlocked
              ? "Bloqueado por Pre-Flight"
              : scheduledAt
              ? "Programar Migración"
              : "Iniciar Migración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
