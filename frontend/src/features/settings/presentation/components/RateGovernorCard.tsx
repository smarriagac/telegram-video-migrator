import React, { useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Zap,
  Search,
  Gauge,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import {
  rateGovernorApi,
  RateGovernorStatus,
  ChannelThrottle,
} from "../../infrastructure/rateGovernorApi";
import { cn } from "@/shared/lib/utils";

export const RateGovernorCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Telemetry state, loading, feedback and action in progress
  const [governorState, setGovernorState] = useState<{
    data: RateGovernorStatus | null;
    isLoading: boolean;
    feedback: { message: string; isError?: boolean } | null;
    actionTarget: string | null;
  }>({
    data: null,
    isLoading: true,
    feedback: null,
    actionTarget: null,
  });

  // Hook 2: Local search query and status filter
  const [filterState, setFilterState] = useState<{
    query: string;
    statusFilter: "ALL" | "HEALTHY" | "THROTTLED" | "FROZEN";
  }>({
    query: "",
    statusFilter: "ALL",
  });

  const loadStatus = async () => {
    try {
      setGovernorState((prev) => ({ ...prev, isLoading: true }));
      const res = await rateGovernorApi.getStatus();
      setGovernorState((prev) => ({ ...prev, data: res, isLoading: false }));
    } catch (err: any) {
      setGovernorState((prev) => ({
        ...prev,
        isLoading: false,
        feedback: { message: err?.message || "Error al cargar telemetría del gobernador", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadStatus();
    const timer = setInterval(() => {
      rateGovernorApi.getStatus().then((res) => {
        setGovernorState((prev) => ({ ...prev, data: res }));
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const showFeedback = (message: string, isError = false) => {
    setGovernorState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setGovernorState((prev) => ({ ...prev, feedback: null }));
    }, 3500);
  };

  const handleResetChannel = async (targetId: string, accountId?: number | string | null) => {
    setGovernorState((prev) => ({ ...prev, actionTarget: targetId }));
    try {
      const res = await rateGovernorApi.resetChannel(targetId, accountId);
      showFeedback(res.message || `Canal ${targetId} restablecido a parámetros base.`);
      await loadStatus();
    } catch (err: any) {
      showFeedback(err?.message || "Error al restablecer canal", true);
    } finally {
      setGovernorState((prev) => ({ ...prev, actionTarget: null }));
    }
  };

  const handleResetAll = async () => {
    setGovernorState((prev) => ({ ...prev, actionTarget: "ALL" }));
    try {
      const res = await rateGovernorApi.resetChannel();
      showFeedback(res.message || "Todos los canales restablecidos a valores base.");
      await loadStatus();
    } catch (err: any) {
      showFeedback(err?.message || "Error al restablecer canales", true);
    } finally {
      setGovernorState((prev) => ({ ...prev, actionTarget: null }));
    }
  };

  const channels: ChannelThrottle[] = governorState.data?.channels || [];
  const filteredChannels = channels.filter((ch) => {
    if (filterState.statusFilter !== "ALL" && ch.status !== filterState.statusFilter) {
      return false;
    }
    if (filterState.query.trim()) {
      const q = filterState.query.toLowerCase();
      return ch.target_id.toLowerCase().includes(q) || String(ch.account_id || "").includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: ChannelThrottle["status"], remainingFreeze: number) => {
    switch (status) {
      case "FROZEN":
        return (
          <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] font-mono gap-1 animate-pulse">
            <Flame className="w-3 h-3" />
            <span>CONGELADO ({remainingFreeze}s)</span>
          </Badge>
        );
      case "THROTTLED":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-mono gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>MODULADO (AIMD)</span>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>SALUDABLE</span>
          </Badge>
        );
    }
  };

  return (
    <div className="bg-card border border-border rounded-md p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground font-mono">
                Gobernador Adaptativo de Concurrencia (AIMD)
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono bg-secondary border-border">
                Token Bucket
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Regulación proactiva de velocidad y prevención de FloodWait coordinada entre todos los workers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStatus}
            disabled={governorState.isLoading}
            className="h-8 text-xs font-mono flex items-center gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", governorState.isLoading && "animate-spin")} />
            <span>Actualizar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAll}
            disabled={governorState.actionTarget === "ALL" || channels.length === 0}
            className="h-8 text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1.5"
            title="Restablecer multiplicadores de todos los canales"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", governorState.actionTarget === "ALL" && "animate-spin")} />
            <span>Restablecer Todos</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Canales Gestionados</span>
            <Gauge className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-lg font-bold font-mono text-foreground">
            {governorState.data?.total_managed_channels ?? 0}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Modulados (AIMD)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-bold font-mono text-amber-400">
            {governorState.data?.active_throttles ?? 0}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Congelados (FloodWait)</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-lg font-bold font-mono text-rose-400">
            {governorState.data?.frozen_channels ?? 0}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Algoritmo Pacing</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xs font-mono font-medium text-foreground truncate">
            AIMD (5 cap / 0.5s refill)
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {governorState.feedback && (
        <div
          className={cn(
            "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
            governorState.feedback.isError
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          )}
        >
          {governorState.feedback.isError ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{governorState.feedback.message}</span>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por ID canal o cuenta..."
            value={filterState.query}
            onChange={(e) => setFilterState((prev) => ({ ...prev, query: e.target.value }))}
            className="w-full text-xs font-mono bg-secondary/40 border border-border rounded-md pl-8 pr-3 py-1.5 h-8 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["ALL", "HEALTHY", "THROTTLED", "FROZEN"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterState((prev) => ({ ...prev, statusFilter: mode }))}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-mono transition-all",
                filterState.statusFilter === mode
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground bg-secondary/40"
              )}
            >
              {mode === "ALL" ? "Todos" : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Throttle Table */}
      <div className="border border-border rounded-lg overflow-x-auto min-h-32">
        {governorState.isLoading && !governorState.data ? (
          <div className="p-8 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Cargando telemetría del gobernador...</span>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="font-semibold text-foreground">Sin congestión detectada en canales.</p>
            <p className="text-[11px]">
              No hay canales operando bajo throttle o congelamiento. Cuando un worker envíe medios, su token bucket aparecerá aquí.
            </p>
          </div>
        ) : (
          <Table className="w-full text-xs">
            <TableHeader className="bg-secondary/40 font-mono text-muted-foreground border-b border-border">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="py-2 px-3">Canal Destino</TableHead>
                <TableHead className="py-2 px-3">Cuenta MTProto</TableHead>
                <TableHead className="py-2 px-3">Estado</TableHead>
                <TableHead className="py-2 px-3">Tokens</TableHead>
                <TableHead className="py-2 px-3">Multiplicador</TableHead>
                <TableHead className="py-2 px-3">Tasa Relleno</TableHead>
                <TableHead className="py-2 px-3">Latencia EMA</TableHead>
                <TableHead className="py-2 px-3">Envíos / Fallos</TableHead>
                <TableHead className="py-2 px-3 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border font-mono text-xs">
              {filteredChannels.map((ch) => (
                <TableRow key={`${ch.account_id}:${ch.target_id}`} className="hover:bg-muted/40">
                  <TableCell className="py-2 px-3 font-bold text-foreground">
                    {ch.target_id}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">
                    #{ch.account_id || "default"}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    {getStatusBadge(ch.status, ch.remaining_freeze_seconds)}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="text-[11px] font-semibold text-foreground">
                      {ch.tokens.toFixed(1)} / {ch.capacity}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span
                      className={cn(
                        "text-[11px]",
                        ch.backoff_multiplier > 1.2 ? "text-amber-400 font-bold" : "text-muted-foreground"
                      )}
                    >
                      {ch.backoff_multiplier.toFixed(2)}x
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">
                    {ch.refill_rate.toFixed(2)} msg/s
                  </TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">
                    {ch.ema_latency_ms > 0 ? `${ch.ema_latency_ms} ms` : "-"}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-muted-foreground">
                    {ch.total_dispatches} /{" "}
                    <span className={cn(ch.total_flood_waits > 0 ? "text-rose-400 font-bold" : "")}>
                      {ch.total_flood_waits}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={governorState.actionTarget === ch.target_id}
                      onClick={() => handleResetChannel(ch.target_id, ch.account_id)}
                      className="h-7 text-[11px] px-2 font-mono gap-1 text-muted-foreground hover:text-foreground"
                      title="Restablecer multiplicador de este canal"
                    >
                      <RotateCcw
                        className={cn("w-3 h-3", governorState.actionTarget === ch.target_id && "animate-spin")}
                      />
                      <span>Reset</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
