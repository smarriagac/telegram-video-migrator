import React, { useState, useEffect } from "react";
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
import { useSyncStore } from "../../application/useSyncStore";
import { useAuthStore } from "@/features/auth/application/useAuthStore";
import {
  AlertTriangle,
  Users,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

export const SwitchSyncAccountModal: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  // Hook 1: Selected account identifier
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  // Hook 2: Compound submission status & feedback
  const [status, setStatus] = useState<{
    isSubmitting: boolean;
    error: string | null;
  }>({
    isSubmitting: false,
    error: null,
  });

  const {
    switchTargetBinding,
    isSwitchModalOpen,
    closeSwitchModal,
    switchAccount,
  } = useSyncStore();

  const accounts = useAuthStore((state) => state.accounts);
  const loadAccounts = useAuthStore((state) => state.loadAccounts);

  useEffect(() => {
    if (isSwitchModalOpen) {
      if (accounts.length === 0) {
        loadAccounts();
      }
      // Pre-select alternate account if available
      const currentAccId = switchTargetBinding?.source_account_id;
      const alternate = accounts.find((a) => a.id !== currentAccId && a.is_active);
      setSelectedAccountId(alternate ? alternate.id : accounts[0]?.id ?? null);
      setStatus({ isSubmitting: false, error: null });
    }
  }, [isSwitchModalOpen, accounts, switchTargetBinding, loadAccounts]);

  const handleConfirmSwitch = async () => {
    if (!switchTargetBinding || selectedAccountId === null) return;
    setStatus({ isSubmitting: true, error: null });
    try {
      await switchAccount(
        switchTargetBinding.source_channel_id,
        switchTargetBinding.target_channel_id,
        selectedAccountId
      );
    } catch (err: any) {
      setStatus({
        isSubmitting: false,
        error:
          err.message ||
          "La cuenta seleccionada no pudo conectarse ni validar acceso al canal.",
      });
    }
  };

  const currentAccountId = switchTargetBinding?.source_account_id;

  return (
    <Dialog open={isSwitchModalOpen} onOpenChange={(open) => !open && closeSwitchModal()}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border text-foreground rounded-lg shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Relevar Cuenta de Extracción (Failover MTProto)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cambiá la cuenta de Telegram encargada de extraer mensajes de este canal de origen.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Channel Context Card */}
          <div className="p-3 rounded-md bg-secondary/40 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Canal Origen:</span>
              <span className="font-semibold text-foreground truncate max-w-[280px]">
                {switchTargetBinding?.source_channel_title || "Canal Telegram"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">ID MTProto:</span>
              <span className="font-mono text-muted-foreground">
                {switchTargetBinding?.source_channel_id}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
              <span className="text-muted-foreground font-medium">Estado de acceso:</span>
              <Badge
                variant="destructive"
                className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] gap-1 px-1.5 py-0.5 font-mono"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>SIN ACCESO (Expulsado)</span>
              </Badge>
            </div>
            {switchTargetBinding?.last_error && (
              <p className="text-[11px] text-amber-500/90 dark:text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded p-1.5 leading-relaxed">
                {switchTargetBinding.last_error}
              </p>
            )}
          </div>

          {/* Account Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Cuentas de Telegram Conectadas
              </label>
              <span className="text-[10px] text-muted-foreground">
                Seleccioná la cuenta sustituta
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="p-4 rounded-md border border-dashed border-border text-center text-xs text-muted-foreground">
                No hay cuentas de Telegram adicionales configuradas en el sistema.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {accounts.map((acc) => {
                  const isCurrent = acc.id === currentAccountId;
                  const isSelected = acc.id === selectedAccountId;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => !isCurrent && setSelectedAccountId(acc.id)}
                      className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                        isCurrent
                          ? "opacity-50 cursor-not-allowed bg-muted/40 border-border"
                          : isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40 bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="flex flex-col truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground truncate">
                              {acc.name}
                            </span>
                            {acc.phone && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ({acc.phone})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Cuenta #{acc.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-destructive/30 text-destructive bg-destructive/10"
                          >
                            Expulsada
                          </Badge>
                        )}
                        {!isCurrent && isSelected && (
                          <Badge
                            variant="default"
                            className="text-[9px] bg-primary text-primary-foreground font-mono"
                          >
                            Seleccionada
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error Banner */}
          {status.error && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/25 text-destructive text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Fallo de verificación MTProto</span>
                <span className="text-[11px] leading-relaxed block">{status.error}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={closeSwitchModal}
            disabled={status.isSubmitting}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmSwitch}
            disabled={
              status.isSubmitting ||
              selectedAccountId === null ||
              selectedAccountId === currentAccountId
            }
            className="text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {status.isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Verificando y Relevando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Confirmar Relevo y Sincronizar</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
