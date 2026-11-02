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
import { Progress } from "@/shared/components/ui/progress";
import { ViewHeader } from "@/shared/components/ViewHeader";
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
          className="h-8 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          Actualizar Métricas
        </Button>
      </ViewHeader>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Bandwidth Savings */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
            <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Ancho de Banda Ahorrado
            </CardTitle>
            <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-xl font-bold font-mono text-white tracking-tight">
              {data ? `${data.total_bandwidth_saved_gb.toFixed(1)} GB` : "0 GB"}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Tráfico local evitado vía cloning MTProto
            </p>
            <div className="mt-1.5">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] py-0.2 px-1.5">
                Zero Descarga Local
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Migrated Items */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
            <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Archivos Migrados
            </CardTitle>
            <FileVideo className="h-3.5 w-3.5 text-cyan-400" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-xl font-bold font-mono text-white tracking-tight">
              {data ? data.total_items_migrated.toLocaleString() : "0"}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {data ? `${data.total_jobs} trabajos ejecutados` : "Cargando..."}
            </p>
            <div className="mt-1.5">
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[9px] py-0.2 px-1.5">
                {data ? `${data.efficiency_percent}% Eficiencia Nube` : "99.8% Eficiencia"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Prevented Duplicates */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
            <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Duplicados Filtrados
            </CardTitle>
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-xl font-bold font-mono text-white tracking-tight">
              {data ? data.duplicates_prevented.toLocaleString() : "0"}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Fingerprints SHA256 & Perceptuales
            </p>
            <div className="mt-1.5">
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[9px] py-0.2 px-1.5">
                Deduplicación Automática
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Live Sync Channels */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 pb-1">
            <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Canales en Auto-Sync
            </CardTitle>
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-xl font-bold font-mono text-white tracking-tight">
              {data ? data.active_sync_bindings : "0"}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Rutas activas escuchando eventos push
            </p>
            <div className="mt-1.5">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] py-0.2 px-1.5">
                Live Push Daemon
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Visualizations */}
      <div className="grid gap-2.5 lg:grid-cols-3">
        {/* Daily Volume Bar Chart */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm lg:col-span-2">
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Volumen Diario de Migración
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Cantidad de archivos transferidos y ancho de banda estimado por día.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/60 text-zinc-300 text-[11px] font-mono">
                Últimos Días
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {data?.daily_volume && data.daily_volume.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5 pb-2.5 border-b border-zinc-800">
                  <div className="p-2 bg-zinc-950/40 rounded border border-zinc-800/60">
                    <span className="text-[11px] text-zinc-400">Día con Mayor Tráfico</span>
                    <p className="text-base font-semibold text-white mt-0.5 font-mono">
                      {data.daily_volume.reduce((max, d) => (d.count > max.count ? d : max)).date}
                    </p>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      {data.daily_volume.reduce((max, d) => (d.count > max.count ? d : max)).count} elementos
                    </span>
                  </div>
                  <div className="p-2 bg-zinc-950/40 rounded border border-zinc-800/60">
                    <span className="text-[11px] text-zinc-400">Promedio de Ahorro / Elemento</span>
                    <p className="text-base font-semibold text-white mt-0.5 font-mono">~25.0 MB</p>
                    <span className="text-[11px] text-zinc-400 font-mono">Ref. Telegram Cloud</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {data.daily_volume.map((item) => {
                    const percentage = Math.max(Math.round((item.count / maxDailyCount) * 100), 4);
                    return (
                      <div key={item.date} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-zinc-300">{item.date}</span>
                          <span className="text-zinc-400 font-medium">
                            <span className="text-white font-semibold font-mono">{item.count.toLocaleString()}</span> items ({(item.estimated_mb / 1024).toFixed(1)} GB)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-zinc-950/60 rounded-sm overflow-hidden p-0.5 border border-zinc-800/60">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-sm transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                No hay registros de migración recientes disponibles.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Media Type Breakdown */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-cyan-400" />
              Distribución de Medios
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Desglose de contenidos procesados en cola.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2.5">
            {/* Photos */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                  <Image className="h-3.5 w-3.5 text-amber-400" />
                  Imágenes & Álbumes
                </span>
                <span className="font-medium text-zinc-400 text-[11px] font-mono">
                  {data?.media_type_distribution?.photo?.toLocaleString() || 0} ({getMediaPercentage(data?.media_type_distribution?.photo || 0)}%)
                </span>
              </div>
              <Progress
                value={getMediaPercentage(data?.media_type_distribution?.photo || 0)}
                className="h-1.5 bg-zinc-800"
              />
            </div>

            {/* Videos */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                  <FileVideo className="h-3.5 w-3.5 text-cyan-400" />
                  Videos & Animaciones
                </span>
                <span className="font-medium text-zinc-400 text-[11px] font-mono">
                  {data?.media_type_distribution?.video?.toLocaleString() || 0} ({getMediaPercentage(data?.media_type_distribution?.video || 0)}%)
                </span>
              </div>
              <Progress
                value={getMediaPercentage(data?.media_type_distribution?.video || 0)}
                className="h-1.5 bg-zinc-800"
              />
            </div>

            {/* Documents */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                  <File className="h-3.5 w-3.5 text-purple-400" />
                  Documentos & Archivos
                </span>
                <span className="font-medium text-zinc-400 text-[11px] font-mono">
                  {data?.media_type_distribution?.document?.toLocaleString() || 0} ({getMediaPercentage(data?.media_type_distribution?.document || 0)}%)
                </span>
              </div>
              <Progress
                value={getMediaPercentage(data?.media_type_distribution?.document || 0)}
                className="h-1.5 bg-zinc-800"
              />
            </div>

            {/* Text Messages */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                  Mensajes de Texto
                </span>
                <span className="font-medium text-zinc-400 text-[11px] font-mono">
                  {data?.media_type_distribution?.text?.toLocaleString() || 0} ({getMediaPercentage(data?.media_type_distribution?.text || 0)}%)
                </span>
              </div>
              <Progress
                value={getMediaPercentage(data?.media_type_distribution?.text || 0)}
                className="h-1.5 bg-zinc-800"
              />
            </div>

            {/* Job Status Snapshot */}
            <div className="pt-2.5 border-t border-zinc-800">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 font-mono">
                Estado de Trabajos
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-sm bg-zinc-950/40 border border-zinc-800/60 text-[11px]">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Completados
                  </span>
                  <span className="font-semibold text-white font-mono">
                    {data?.jobs_by_status?.COMPLETED || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-sm bg-zinc-950/40 border border-zinc-800/60 text-[11px]">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <PauseCircle className="h-3 w-3" /> Pausados
                  </span>
                  <span className="font-semibold text-white font-mono">
                    {data?.jobs_by_status?.PAUSED || 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
