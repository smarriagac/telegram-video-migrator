import React, { useEffect } from "react";
import {
  Activity,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Radio,
  FileVideo,
  Image,
  FileText,
  File,
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  Layers,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { Skeleton, StatGridSkeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useAnalyticsStore } from "../application/useAnalyticsStore";

export const AnalyticsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (0 used, all in Zustand)
  const { data, isLoading, error, fetchOverview } = useAnalyticsStore();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const totalMediaInQueue = data
    ? Object.values(data.media_type_distribution).reduce((acc, curr) => acc + curr, 0)
    : 0;

  const getMediaPercentage = (count: number) => {
    if (!totalMediaInQueue) return 0;
    return Math.round((count / totalMediaInQueue) * 100);
  };

  const maxDailyCount = data?.daily_volume?.length
    ? Math.max(...data.daily_volume.map((d) => d.count), 1)
    : 1;

  return (
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* View Header */}
      <ViewHeader
        icon={<Activity className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Analíticas & Rendimiento MTProto"
        subtitle="Métricas operacionales de ahorro de ancho de banda, bypass de descargas locales y salud del pipeline."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchOverview()}
          disabled={isLoading}
          className="h-8 border-border bg-secondary/80 hover:bg-secondary text-foreground text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
          Actualizar Métricas
        </Button>
      </ViewHeader>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Cards */}
      {isLoading && !data ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Bandwidth Savings */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
              <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Ancho de Banda Ahorrado
              </CardTitle>
              <HardDrive className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            </CardHeader>
            <CardContent className="p-2.5 pt-0">
              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                {data ? `${data.total_bandwidth_saved_gb.toFixed(1)} GB` : "0 GB"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tráfico local evitado vía cloning MTProto
              </p>
              <div className="mt-1.5">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] py-0.2 px-1.5">
                  Zero Descarga Local
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Total Migrated Items */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
              <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Archivos Migrados
              </CardTitle>
              <FileVideo className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-2.5 pt-0">
              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                {data ? data.total_items_migrated.toLocaleString() : "0"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data ? `${data.total_jobs} trabajos ejecutados` : "Cargando..."}
              </p>
              <div className="mt-1.5">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[9px] py-0.2 px-1.5">
                  {data ? `${data.efficiency_percent}% Eficiencia Nube` : "99.8% Eficiencia"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Prevented Duplicates */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
              <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Duplicados Filtrados
              </CardTitle>
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            </CardHeader>
            <CardContent className="p-2.5 pt-0">
              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                {data ? data.duplicates_prevented.toLocaleString() : "0"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Fingerprints SHA256 & Perceptuales
              </p>
              <div className="mt-1.5">
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] py-0.2 px-1.5">
                  Deduplicación Automática
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Live Sync Channels */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
              <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Canales en Auto-Sync
              </CardTitle>
              <Radio className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-2.5 pt-0">
              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                {data ? data.active_sync_bindings : "0"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Rutas activas escuchando eventos push
              </p>
              <div className="mt-1.5">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[9px] py-0.2 px-1.5">
                  Live Push Daemon
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Charts & Visualizations */}
      {isLoading && !data ? (
        <div className="grid gap-2.5 lg:grid-cols-3">
          <Card className="border-border bg-card shadow-sm lg:col-span-2 p-4 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44 rounded" />
              <Skeleton className="h-3 w-72 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 pb-2.5 border-b border-border">
              <div className="p-2 bg-secondary/50 rounded border border-border space-y-1.5">
                <Skeleton className="h-2.5 w-28 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <div className="p-2 bg-secondary/50 rounded border border-border space-y-1.5">
                <Skeleton className="h-2.5 w-36 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
            </div>
            <div className="space-y-3 pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-20 rounded shrink-0" />
                  <Skeleton className="h-2.5 flex-1 rounded-full" />
                  <Skeleton className="h-3 w-28 rounded shrink-0" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="border-border bg-card shadow-sm p-4 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <div className="space-y-3.5 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-3 w-10 rounded" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
      <div className="grid gap-2.5 lg:grid-cols-3">
        {/* Daily Volume Bar Chart */}
        <Card className="border-border bg-card shadow-sm lg:col-span-2">
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Volumen Diario de Migración
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Cantidad de archivos transferidos y ancho de banda estimado por día.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-border bg-secondary text-foreground text-[11px] font-mono">
                Últimos Días
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {data?.daily_volume && data.daily_volume.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5 pb-2.5 border-b border-border">
                  <div className="p-2 bg-secondary/50 rounded border border-border">
                    <span className="text-[11px] text-muted-foreground">Día con Mayor Tráfico</span>
                    <p className="text-base font-semibold text-foreground mt-0.5 font-mono">
                      {data.daily_volume.reduce((max, d) => (d.count > max.count ? d : max)).date}
                    </p>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                      {data.daily_volume.reduce((max, d) => (d.count > max.count ? d : max)).count} elementos
                    </span>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded border border-border">
                    <span className="text-[11px] text-muted-foreground">Promedio de Ahorro / Elemento</span>
                    <p className="text-base font-semibold text-foreground mt-0.5 font-mono">~25.0 MB</p>
                    <span className="text-[11px] text-muted-foreground font-mono">Ref. Telegram Cloud</span>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  {data.daily_volume.map((item) => {
                    const percentage = Math.round((item.count / maxDailyCount) * 100);
                    return (
                      <div key={item.date} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                        <div className="flex items-center justify-between sm:w-24 shrink-0">
                          <span className="font-mono text-muted-foreground text-[11px]">{item.date}</span>
                          <span className="sm:hidden font-mono text-[11px] text-muted-foreground">
                            <span className="text-foreground font-semibold">{item.count.toLocaleString()}</span>{" "}
                            {item.count === 1 ? "item" : "items"} ({(item.estimated_mb / 1024).toFixed(1)} GB)
                          </span>
                        </div>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden border border-border/40">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percentage, 1)}%` }}
                          />
                        </div>
                        <div className="hidden sm:block w-40 text-right shrink-0 font-mono text-[11px] text-muted-foreground">
                          <span className="text-foreground font-semibold">{item.count.toLocaleString()}</span>{" "}
                          {item.count === 1 ? "item" : "items"} ({(item.estimated_mb / 1024).toFixed(1)} GB)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                No hay registros de migración recientes disponibles.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Media Type Breakdown */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Distribución de Medios
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Desglose de contenidos procesados en cola.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            {/* Media Distribution Horizontal Symmetrical Bars */}
            <div className="space-y-2.5 pt-1">
              {[
                {
                  id: "photo",
                  label: "Imágenes & Álbumes",
                  icon: Image,
                  iconColor: "text-amber-500 dark:text-amber-400",
                  barColor: "bg-amber-500 dark:bg-amber-400",
                  count: data?.media_type_distribution?.photo || 0,
                  pct: getMediaPercentage(data?.media_type_distribution?.photo || 0),
                },
                {
                  id: "video",
                  label: "Videos & Animaciones",
                  icon: FileVideo,
                  iconColor: "text-primary",
                  barColor: "bg-primary",
                  count: data?.media_type_distribution?.video || 0,
                  pct: getMediaPercentage(data?.media_type_distribution?.video || 0),
                },
                {
                  id: "document",
                  label: "Documentos & Archivos",
                  icon: File,
                  iconColor: "text-purple-500 dark:text-purple-400",
                  barColor: "bg-purple-500 dark:bg-purple-400",
                  count: data?.media_type_distribution?.document || 0,
                  pct: getMediaPercentage(data?.media_type_distribution?.document || 0),
                },
                {
                  id: "text",
                  label: "Mensajes de Texto",
                  icon: FileText,
                  iconColor: "text-emerald-500 dark:text-emerald-400",
                  barColor: "bg-emerald-500 dark:bg-emerald-400",
                  count: data?.media_type_distribution?.text || 0,
                  pct: getMediaPercentage(data?.media_type_distribution?.text || 0),
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-center gap-2.5 text-xs">
                    <div className="flex items-center gap-1.5 w-36 sm:w-40 shrink-0 text-[11px] text-foreground font-medium">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", item.iconColor)} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden border border-border/40">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", item.barColor)}
                        style={{ width: `${Math.max(item.pct, item.count > 0 ? 1 : 0)}%` }}
                      />
                    </div>
                    <div className="w-24 text-right shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                      <span className="text-foreground font-semibold">{item.count.toLocaleString()}</span>{" "}
                      <span className="text-[10px] text-muted-foreground">({item.pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Job Status Snapshot */}
            <div className="pt-2.5 border-t border-border">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 font-mono">
                Estado de Trabajos
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-sm bg-secondary/50 border border-border text-[11px]">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Completados
                  </span>
                  <span className="font-semibold text-foreground font-mono">
                    {data?.jobs_by_status?.COMPLETED || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-sm bg-secondary/50 border border-border text-[11px]">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <PauseCircle className="h-3 w-3" /> Pausados
                  </span>
                  <span className="font-semibold text-foreground font-mono">
                    {data?.jobs_by_status?.PAUSED || 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
};
