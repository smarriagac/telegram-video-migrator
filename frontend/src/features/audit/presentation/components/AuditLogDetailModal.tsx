import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { AuditLogItem } from "../../domain/types";
import {
  Clock,
  Globe,
  User,
  Server,
  Radio,
  PlayCircle,
  LogIn,
  AlertTriangle,
  UserPlus,
  Copy,
  Check,
  Code,
  Info,
} from "lucide-react";

interface AuditLogDetailModalProps {
  log: AuditLogItem | null;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  log,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const handleCopyJson = () => {
    const payload = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "LOGIN":
        return (
          <Badge variant="outline" className="gap-1.5 font-mono text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <LogIn className="w-3.5 h-3.5" /> INICIO DE SESIÓN
          </Badge>
        );
      case "LOGIN_FAILED":
        return (
          <Badge variant="destructive" className="gap-1.5 font-mono text-xs">
            <AlertTriangle className="w-3.5 h-3.5" /> LOGIN FALLIDO
          </Badge>
        );
      case "MIGRATION_START":
        return (
          <Badge variant="outline" className="gap-1.5 font-mono text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            <PlayCircle className="w-3.5 h-3.5" /> INICIO DE CLONACIÓN
          </Badge>
        );
      case "MIGRATION_CANCEL":
        return (
          <Badge variant="destructive" className="gap-1.5 font-mono text-xs">
            MIGRACIÓN CANCELADA
          </Badge>
        );
      case "AUTO_SYNC_TOGGLE":
        return (
          <Badge variant="outline" className="gap-1.5 font-mono text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Radio className="w-3.5 h-3.5" /> CONFIGURACIÓN AUTO-SYNC
          </Badge>
        );
      case "USER_CREATE":
      case "USER_UPDATE":
      case "USER_DELETE":
        return (
          <Badge variant="outline" className="gap-1.5 font-mono text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
            <UserPlus className="w-3.5 h-3.5" /> GESTIÓN RBAC ({action})
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-mono text-xs">
            {action}
          </Badge>
        );
    }
  };

  const details = log.details || {};

  return (
    <Dialog open={Boolean(log)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0e1015] border-zinc-800 text-zinc-100 p-6 shadow-xl">
        <DialogHeader className="border-b border-zinc-800 pb-4 space-y-2">
          <div className="flex items-center justify-between">
            {getActionBadge(log.action)}
            <span className="font-mono text-xs text-zinc-500">ID Evento: #{log.id}</span>
          </div>
          <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            Inspección de Registro de Auditoría
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1">
                <User className="w-3 h-3 text-cyan-400" /> Usuario Responsable
              </span>
              <p className="font-medium text-zinc-200 truncate">
                {log.user_email || <span className="text-zinc-500 italic font-mono">Sistema / Bot</span>}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1">
                <Globe className="w-3 h-3 text-emerald-400" /> IP de Origen
              </span>
              <p className="font-mono text-zinc-200">{log.ip_address || "127.0.0.1"}</p>
            </div>

            <div className="space-y-0.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Fecha y Hora
              </span>
              <p className="text-zinc-300 text-xs font-mono">{formatDate(log.created_at)}</p>
            </div>

            <div className="space-y-0.5 col-span-2 sm:col-span-3 pt-2 border-t border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1">
                <Server className="w-3 h-3 text-purple-400" /> Recurso Afectado
              </span>
              <p className="font-mono text-cyan-300 text-xs break-all">{log.resource || "N/A"}</p>
            </div>
          </div>

          {/* Structured Context Details */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              Detalle Interpretado de la Operación
            </h4>

            {log.action === "AUTO_SYNC_TOGGLE" && (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-zinc-400 text-xs block">Canal Origen:</span>
                    <strong className="text-amber-300 text-xs">
                      {details.source_title || "Canal Origen"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs block">Canal Destino:</span>
                    <strong className="text-amber-300 text-xs">
                      {details.target_title || "Canal Destino"}
                    </strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-500/15 flex items-center justify-between">
                  <span className="text-zinc-400">Estado del Auto-Sync:</span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded text-[10px] font-semibold ${
                      details.is_active
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {details.is_active ? "● ACTIVADO (MTProto Push)" : "○ DESACTIVADO"}
                  </span>
                </div>
              </div>
            )}

            {log.action === "MIGRATION_START" && (
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-zinc-400 text-xs block">Origen:</span>
                    <strong className="text-cyan-300 text-xs">
                      {details.source_title || `Canal ${details.source_id}`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs block">Destino:</span>
                    <strong className="text-cyan-300 text-xs">
                      {details.target_title || `Canal ${details.target_id}`}
                    </strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-cyan-500/15 flex items-center justify-between">
                  <span className="text-zinc-400">Modalidad de Clonación:</span>
                  <span className="font-mono text-cyan-300 text-xs">
                    {details.is_full_migration ? "Clonación Completa" : "Selección Parcial de Videos"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Mensajes programados:</span>
                  <strong className="font-mono text-zinc-100">{details.selected_items_count}</strong>
                </div>
              </div>
            )}

            {log.action === "LOGIN" && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Resultado de Autenticación:</span>
                  <span className="text-emerald-400 font-medium font-mono">200 OK · Token JWT Emitido</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Rol asignado a la sesión:</span>
                  <span className="font-mono text-cyan-300 uppercase">{details.role || "ADMIN"}</span>
                </div>
              </div>
            )}

            {log.action === "LOGIN_FAILED" && (
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Motivo del rechazo:</span>
                  <strong className="text-rose-400 font-medium">{details.reason || "Credenciales incorrectas"}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Código de seguridad:</span>
                  <span className="font-mono text-rose-400">401 UNAUTHORIZED</span>
                </div>
              </div>
            )}

            {log.action.startsWith("USER_") && (
              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-1.5 text-xs">
                {details.created_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Usuario creado:</span>
                    <strong className="text-purple-300 font-mono">{details.created_email}</strong>
                  </div>
                )}
                {details.role && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Rol asignado:</span>
                    <span className="font-mono text-cyan-300">{details.role}</span>
                  </div>
                )}
                {details.updated_role && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Nuevo rol actualizado:</span>
                    <span className="font-mono text-cyan-300">{details.updated_role}</span>
                  </div>
                )}
                {details.deleted_user_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">ID Usuario eliminado:</span>
                    <span className="font-mono text-rose-400">#{details.deleted_user_id}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Raw JSON Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-zinc-400" />
                Payload Estructurado (JSON)
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyJson}
                className="h-7 px-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado!" : "Copiar JSON"}
              </Button>
            </div>
            <pre className="p-3 rounded-lg bg-[#090a0e] border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(log.details || {}, null, 2)}
            </pre>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
