import React, { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  Film,
  HardDrive,
  Cpu,
  Sparkles,
  Zap,
  Trash2,
  Server,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { doctorApi, DoctorReport } from "../../infrastructure/doctorApi";

export const SystemDoctorCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Report payload returned from backend diagnostic probe sweep
  const [report, setReport] = useState<DoctorReport | null>(null);

  // Hook 2: Consolidated local UI interactions, loading flags, and remediation action feedback
  const [uiState, setUiState] = useState<{
    isLoading: boolean;
    isRemediating: boolean;
    actionFeedback: { message: string; isError?: boolean } | null;
  }>({
    isLoading: true,
    isRemediating: false,
    actionFeedback: null,
  });

  const fetchDiagnostics = async () => {
    setUiState((prev) => ({ ...prev, isLoading: true }));
    try {
      const data = await doctorApi.getDoctorReport();
      setReport(data);
      setUiState((prev) => ({ ...prev, isLoading: false }));
    } catch (err: any) {
      setUiState((prev) => ({
        ...prev,
        isLoading: false,
        actionFeedback: {
          message: err?.message || "No se pudo obtener el diagnóstico del sistema.",
          isError: true,
        },
      }));
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleRemediation = async (action: string) => {
    setUiState((prev) => ({ ...prev, isRemediating: true, actionFeedback: null }));
    try {
      const res = await doctorApi.remediate(action);
      setUiState((prev) => ({
        ...prev,
        isRemediating: false,
        actionFeedback: { message: res.message, isError: !res.remediated },
      }));
      // Refresh probes after auto-remediation
      fetchDiagnostics();
    } catch (err: any) {
      setUiState((prev) => ({
        ...prev,
        isRemediating: false,
        actionFeedback: {
          message: err?.message || `Fallo al ejecutar la remediación ${action}`,
          isError: true,
        },
      }));
    }
  };

  const overallStatus = report?.overall_status || "HEALTHY";
  const checks = report?.checks;

  return (
    <div className="space-y-6">
      {/* Top Banner: Status Header & Execution Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              "w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border",
              overallStatus === "HEALTHY"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : overallStatus === "DEGRADED"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                : "bg-rose-500/10 border-rose-500/20 text-rose-500"
            )}
          >
            {overallStatus === "HEALTHY" ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : overallStatus === "DEGRADED" ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <XCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Doctor del Sistema y Sondas de Salud
              </h2>
              <Badge
                variant={
                  overallStatus === "HEALTHY"
                    ? "default"
                    : overallStatus === "DEGRADED"
                    ? "outline"
                    : "destructive"
                }
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider",
                  overallStatus === "HEALTHY" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                )}
              >
                {overallStatus === "HEALTHY" ? "Saludable" : overallStatus === "DEGRADED" ? "Degradado" : "Crítico"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitoreo continuo de latencia de PostgreSQL, sockets MTProto, binarios FFmpeg y espacio en disco.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDiagnostics}
            disabled={uiState.isLoading || uiState.isRemediating}
            className="text-xs flex items-center gap-1.5 h-8"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", uiState.isLoading && "animate-spin")} />
            {uiState.isLoading ? "Sondeando..." : "Ejecutar Diagnóstico"}
          </Button>
        </div>
      </div>

      {/* Action / Remediation Feedback Alert */}
      {uiState.actionFeedback && (
        <div
          className={cn(
            "p-3 rounded-lg text-xs flex items-center justify-between gap-2 transition-all",
            uiState.actionFeedback.isError
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          )}
        >
          <div className="flex items-center gap-2">
            {uiState.actionFeedback.isError ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{uiState.actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setUiState((prev) => ({ ...prev, actionFeedback: null }))}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Diagnostics Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tile 1: PostgreSQL Latency & Pool */}
        <div className="p-4 rounded-xl border border-border bg-card/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Database className="w-4 h-4 text-cyan-500" />
                <span>Base de Datos PostgreSQL</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-bold",
                  checks?.database.status === "HEALTHY"
                    ? "text-emerald-500 border-emerald-500/30"
                    : "text-amber-500 border-amber-500/30"
                )}
              >
                {checks?.database.status || "DESCONOCIDO"}
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
              <div className="flex justify-between items-center">
                <span>Latencia Round-Trip:</span>
                <span className="font-mono font-medium text-foreground">
                  {checks?.database.latency_ms ?? "--"} ms
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Modo de Driver:</span>
                <span className="truncate max-w-[140px] text-right text-foreground font-medium" title={checks?.database.driver}>
                  {checks?.database.driver || "Cargando..."}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRemediation("test_db_latency")}
            disabled={uiState.isRemediating}
            className="w-full text-xs h-7 flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3 h-3 text-amber-500" />
            Probar Latencia
          </Button>
        </div>

        {/* Tile 2: Telegram MTProto Sessions */}
        <div className="p-4 rounded-xl border border-border bg-card/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Server className="w-4 h-4 text-blue-500" />
                <span>Sesiones MTProto (Telegram)</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-bold",
                  checks?.telegram_mtproto.status === "HEALTHY"
                    ? "text-emerald-500 border-emerald-500/30"
                    : "text-rose-500 border-rose-500/30"
                )}
              >
                {checks?.telegram_mtproto.status || "DESCONOCIDO"}
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
              <div className="flex justify-between items-center">
                <span>Cuentas Registradas:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.telegram_mtproto.accounts_registered ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Cuentas Activas:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.telegram_mtproto.accounts_active ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Clientes en Pool:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.telegram_mtproto.clients_in_pool ?? 0}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRemediation("refresh_pool")}
            disabled={uiState.isRemediating}
            className="w-full text-xs h-7 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3 text-blue-500" />
            Reinicializar Pool
          </Button>
        </div>

        {/* Tile 3: FFmpeg Transcoding Engine */}
        <div className="p-4 rounded-xl border border-border bg-card/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Film className="w-4 h-4 text-purple-500" />
                <span>Motor Multimedia (FFmpeg)</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-bold",
                  checks?.media_engine.status === "HEALTHY"
                    ? "text-emerald-500 border-emerald-500/30"
                    : "text-amber-500 border-amber-500/30"
                )}
              >
                {checks?.media_engine.status || "DESCONOCIDO"}
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
              <div className="flex justify-between items-center">
                <span>FFmpeg Disponible:</span>
                <span className={cn("font-medium", checks?.media_engine.ffmpeg_available ? "text-emerald-500" : "text-rose-500")}>
                  {checks?.media_engine.ffmpeg_available ? "Sí (Instalado)" : "No"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>FFprobe Disponible:</span>
                <span className={cn("font-medium", checks?.media_engine.ffprobe_available ? "text-emerald-500" : "text-rose-500")}>
                  {checks?.media_engine.ffprobe_available ? "Sí (Instalado)" : "No"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Versión:</span>
                <span className="font-mono text-[11px] text-foreground truncate max-w-[140px]" title={checks?.media_engine.ffmpeg_version}>
                  {checks?.media_engine.ffmpeg_version || "Desconocida"}
                </span>
              </div>
            </div>
          </div>
          <div className="p-1 text-center text-[11px] text-muted-foreground bg-secondary/30 rounded border border-border/50">
            Aceleración H.264 / AAC Activa
          </div>
        </div>

        {/* Tile 4: Scratch Storage & Space */}
        <div className="p-4 rounded-xl border border-border bg-card/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                <span>Espacio Scratch (/tmp)</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-bold",
                  checks?.storage.status === "HEALTHY"
                    ? "text-emerald-500 border-emerald-500/30"
                    : "text-rose-500 border-rose-500/30"
                )}
              >
                {checks?.storage.status || "DESCONOCIDO"}
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
              <div className="flex justify-between items-center">
                <span>Espacio Libre:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.storage.free_gb ?? 0} GB / {checks?.storage.total_gb ?? 0} GB
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Archivos Temporales:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.storage.scratch_files_count ?? 0} ({checks?.storage.scratch_files_mb ?? 0} MB)
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    (checks?.storage.used_percent || 0) > 90
                      ? "bg-rose-500"
                      : (checks?.storage.used_percent || 0) > 75
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(checks?.storage.used_percent || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRemediation("clean_temp_storage")}
            disabled={uiState.isRemediating}
            className="w-full text-xs h-7 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3 h-3 text-rose-500" />
            Limpiar Temporales
          </Button>
        </div>

        {/* Tile 5: Background Daemons */}
        <div className="p-4 rounded-xl border border-border bg-card/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Cpu className="w-4 h-4 text-amber-500" />
                <span>Servicios de Fondo</span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-500 border-emerald-500/30">
                ACTIVOS
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
              <div className="flex justify-between items-center">
                <span>Gobernador de Tasa:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.background_services.rate_governor.total_managed_channels ?? 0} canales ({checks?.background_services.rate_governor.frozen_channels ?? 0} congelados)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Broadcaster SSE:</span>
                <span className="font-mono text-foreground font-medium">
                  {checks?.background_services.event_broadcaster.active_subscribers ?? 0} suscriptores
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRemediation("reset_rate_governor")}
            disabled={uiState.isRemediating}
            className="w-full text-xs h-7 flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3 h-3 text-amber-500" />
            Restablecer Gobernador
          </Button>
        </div>

        {/* Tile 6: Overall Diagnosis & Recommendations */}
        <div className="p-4 rounded-xl border border-border bg-card/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Diagnóstico Clínico</span>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground mt-2 max-h-28 overflow-y-auto pr-1">
              {report?.recommendations && report.recommendations.length > 0 ? (
                report.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span className="text-foreground/90">{rec}</span>
                  </div>
                ))
              ) : (
                <p className="italic">Sin recomendaciones pendientes.</p>
              )}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground text-right font-mono">
            Último sondeo: {report?.timestamp ? new Date(report.timestamp).toLocaleTimeString() : "--:--:--"}
          </div>
        </div>
      </div>
    </div>
  );
};
