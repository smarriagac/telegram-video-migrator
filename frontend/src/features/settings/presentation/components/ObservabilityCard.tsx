import React, { useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Server,
  Shuffle,
  Zap,
  Clock,
  Layers,
  Terminal,
  Download,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  observabilityApi,
  SystemMetrics,
  AnomalyItem,
} from "../../infrastructure/observabilityApi";
import { cn } from "@/shared/lib/utils";

export const ObservabilityCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Core telemetry, metrics data, anomalies list, scanning state and feedback
  const [telemetryState, setTelemetryState] = useState<{
    metrics: SystemMetrics | null;
    isLoading: boolean;
    isScanning: boolean;
    anomalies: AnomalyItem[];
    feedback: { message: string; isError?: boolean } | null;
  }>({
    metrics: null,
    isLoading: true,
    isScanning: false,
    anomalies: [],
    feedback: null,
  });

  // Hook 2: UI configuration snippet view and clipboard feedback
  const [uiState, setUiState] = useState<{
    copiedEndpoint: boolean;
    copiedSnippet: boolean;
    copiedGrafanaJson: boolean;
    showSnippet: boolean;
  }>({
    copiedEndpoint: false,
    copiedSnippet: false,
    copiedGrafanaJson: false,
    showSnippet: false,
  });

  const loadMetrics = async () => {
    try {
      setTelemetryState((prev) => ({ ...prev, isLoading: true }));
      const data = await observabilityApi.getMetrics();
      setTelemetryState((prev) => ({ ...prev, metrics: data, isLoading: false }));
    } catch (err: any) {
      setTelemetryState((prev) => ({
        ...prev,
        isLoading: false,
        feedback: { message: err?.message || "Error al conectar con métricas del sistema", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(() => {
      observabilityApi.getMetrics().then((data) => {
        setTelemetryState((prev) => ({ ...prev, metrics: data }));
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const showFeedback = (message: string, isError = false) => {
    setTelemetryState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setTelemetryState((prev) => ({ ...prev, feedback: null }));
    }, 3500);
  };

  const handleScanAnomalies = async () => {
    setTelemetryState((prev) => ({ ...prev, isScanning: true }));
    try {
      const result = await observabilityApi.evaluateAnomalies(true);
      setTelemetryState((prev) => ({
        ...prev,
        isScanning: false,
        anomalies: result.anomalies,
      }));
      if (result.count === 0) {
        showFeedback("Escaneo completado: Sistema 100% saludable, sin anomalías.");
      } else {
        showFeedback(
          `Escaneo completado: Se detectaron ${result.count} anomalía(s). Notificaciones emitidas.`,
          result.has_critical
        );
      }
    } catch (err: any) {
      setTelemetryState((prev) => ({ ...prev, isScanning: false }));
      showFeedback(err?.message || "Error al evaluar anomalías", true);
    }
  };

  const copyEndpointUrl = () => {
    const fullUrl = `${window.location.origin}/metrics`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl);
    }
    setUiState((prev) => ({ ...prev, copiedEndpoint: true }));
    setTimeout(() => {
      setUiState((prev) => ({ ...prev, copiedEndpoint: false }));
    }, 2500);
  };

  const prometheusSnippet = `scrape_configs:
  - job_name: 'telegram-video-migrator'
    scrape_interval: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['${window.location.hostname}:7901']`;

  const copyConfigSnippet = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(prometheusSnippet);
    }
    setUiState((prev) => ({ ...prev, copiedSnippet: true }));
    setTimeout(() => {
      setUiState((prev) => ({ ...prev, copiedSnippet: false }));
    }, 2500);
  };

  const copyGrafanaJson = async () => {
    try {
      const dashboard = await observabilityApi.getGrafanaDashboard();
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(dashboard, null, 2));
      }
      setUiState((prev) => ({ ...prev, copiedGrafanaJson: true }));
      setTimeout(() => {
        setUiState((prev) => ({ ...prev, copiedGrafanaJson: false }));
      }, 2500);
      showFeedback("JSON de Grafana copiado al portapapeles.");
    } catch (err: any) {
      showFeedback(err?.message || "Error al obtener JSON de Grafana", true);
    }
  };

  const metrics = telemetryState.metrics;
  const memoryMb = metrics ? Math.round(metrics.memory_rss_bytes / (1024 * 1024)) : 0;
  const uptimeMinutes = metrics ? Math.round(metrics.uptime_seconds / 60) : 0;

  return (
    <div className="space-y-4">
      {/* Header card with Prometheus details */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                <Activity className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Observabilidad & Exportador Prometheus / OpenMetrics
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono">
                    OpenMetrics v0.0.4
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Telemetría en tiempo real de sesiones MTProto, jobs, ahorro por deduplicación y detección proactiva de anomalías.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMetrics}
                disabled={telemetryState.isLoading}
                className="h-8 text-xs border-border gap-1"
                title="Actualizar métricas"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", telemetryState.isLoading && "animate-spin")} />
                Actualizar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleScanAnomalies}
                disabled={telemetryState.isScanning}
                className="h-8 text-xs gap-1.5 bg-orange-600 hover:bg-orange-500 text-white font-medium shadow-sm"
              >
                <ShieldAlert className={cn("w-3.5 h-3.5", telemetryState.isScanning && "animate-pulse")} />
                {telemetryState.isScanning ? "Escaneando..." : "Escanear Anomalías"}
              </Button>
            </div>
          </div>

          {/* Feedback banner */}
          {telemetryState.feedback && (
            <div
              className={cn(
                "p-2.5 rounded-md text-xs flex items-center gap-2 transition-all",
                telemetryState.feedback.isError
                  ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              )}
            >
              {telemetryState.feedback.isError ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{telemetryState.feedback.message}</span>
            </div>
          )}

          {/* Real-time KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
            {/* Pool MTProto */}
            <div className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Server className="w-3 h-3 text-primary" /> Pool MTProto
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-foreground">
                  {metrics?.mtproto_pool.online_accounts ?? 0}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  /{metrics?.mtproto_pool.total_accounts ?? 0} online
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {metrics?.mtproto_pool.cooldown_accounts ?? 0} en cooldown
              </span>
            </div>

            {/* Total Jobs */}
            <div className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> Trabajos
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-foreground">
                  {metrics?.jobs.total ?? 0}
                </span>
                <span className="text-[10px] text-emerald-400">
                  {metrics?.jobs.by_status.COMPLETED ?? 0} exitosos
                </span>
              </div>
              <span className="text-[9px] text-rose-400 mt-0.5">
                {metrics?.jobs.by_status.FAILED ?? 0} fallidos
              </span>
            </div>

            {/* Hot Failovers */}
            <div className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Shuffle className="w-3 h-3 text-amber-400" /> Hot Failovers
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-amber-400">
                  {metrics?.jobs.total_failovers ?? 0}
                </span>
                <span className="text-[10px] text-muted-foreground">rotaciones</span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">Zero-pause MTProto</span>
            </div>

            {/* Dedup Savings */}
            <div className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Dedup Ahorro
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-emerald-400">
                  {metrics?.deduplication.saved_mb.toFixed(1) ?? "0.0"} MB
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {metrics?.deduplication.deduplicated_items ?? 0} omitidos
              </span>
            </div>

            {/* Rate Limit */}
            <div className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Activity className="w-3 h-3 text-indigo-400" /> Rate Governor
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-bold text-foreground truncate max-w-[80px]">
                  {metrics?.rate_governor.mode ?? "UNLIMITED"}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {metrics && metrics.rate_governor.limit_bytes_per_sec > 0
                  ? `${Math.round(metrics.rate_governor.limit_bytes_per_sec / (1024 * 1024))} MB/s max`
                  : "Ilimitado"}
              </span>
            </div>

            {/* Uptime & RSS */}
            <div className="p-3 rounded-lg bg-secondary/40 border border-border flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" /> Uptime & RAM
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-foreground">
                  {uptimeMinutes}m
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {memoryMb} MB
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">RSS Memory</span>
            </div>
          </div>

          {/* Anomaly Evaluation Results */}
          {telemetryState.anomalies.length > 0 && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Anomalías Detectadas ({telemetryState.anomalies.length})</span>
              </div>
              <div className="space-y-1.5">
                {telemetryState.anomalies.map((anom, idx) => (
                  <div key={idx} className="p-2 rounded bg-background/50 border border-border text-xs flex items-start gap-2">
                    <Badge variant={anom.severity === "CRITICAL" ? "destructive" : "outline"} className="text-[9px] uppercase">
                      {anom.severity}
                    </Badge>
                    <div>
                      <span className="font-semibold text-foreground">{anom.title}: </span>
                      <span className="text-muted-foreground">{anom.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prometheus Scrape URL & Config Snippet Box */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">Endpoint de Raspado Prometheus</span>
                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-background border border-border text-primary">
                  /metrics
                </code>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyEndpointUrl}
                  className="h-7 text-xs gap-1"
                >
                  {uiState.copiedEndpoint ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {uiState.copiedEndpoint ? "URL Copiada" : "Copiar URL"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUiState((prev) => ({ ...prev, showSnippet: !prev.showSnippet }))}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  {uiState.showSnippet ? "Ocultar prometheus.yml" : "Ver prometheus.yml"}
                </Button>
              </div>
            </div>

            {uiState.showSnippet && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Configuración de trabajo de raspado para prometheus.yml:
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyConfigSnippet}
                    className="h-6 text-[10px] gap-1 text-primary hover:bg-primary/10"
                  >
                    {uiState.copiedSnippet ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    {uiState.copiedSnippet ? "Copiado" : "Copiar YAML"}
                  </Button>
                </div>
                <pre className="p-2.5 rounded bg-background border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto">
                  {prometheusSnippet}
                </pre>
              </div>
            )}
          </div>

          {/* Grafana Pre-configured Dashboard Box */}
          <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-foreground">Dashboard Grafana Preconfigurado</span>
                  <p className="text-[11px] text-muted-foreground">
                    10 paneles listos para importar (Pool MTProto, Failovers, Ahorro Dedup, Jobs, Throughput).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyGrafanaJson}
                  className="h-7 text-xs gap-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                >
                  {uiState.copiedGrafanaJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {uiState.copiedGrafanaJson ? "JSON Copiado" : "Copiar JSON"}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="h-7 text-xs gap-1 bg-orange-600 hover:bg-orange-500 text-white"
                >
                  <a href={observabilityApi.getGrafanaDashboardDownloadUrl()} download="grafana-telegram-migrator.json">
                    <Download className="w-3 h-3" />
                    Descargar .json
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
