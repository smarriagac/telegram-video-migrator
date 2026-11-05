import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ChevronDown,
  Clock,
  History,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  StopCircle,
  Terminal,
  Tv,
  UploadCloud,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { SearchableChannelSelect } from "./SearchableChannelSelect";
import { ChannelCloningHistoryModal } from "./ChannelCloningHistoryModal";
import { DirectUploadModal } from "./DirectUploadModal";
import { CaptionRulesModal } from "./CaptionRulesModal";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

interface MigrationControlPanelProps {
  onOpenConfirm: () => void;
  filterQuery?: string;
}

export const MigrationControlPanel: React.FC<MigrationControlPanelProps> = ({
  onOpenConfirm,
  filterQuery = "",
}) => {
  const channels = useMigrationStore((state) => state.channels);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);
  const selectSource = useMigrationStore((state) => state.selectSource);
  const selectTarget = useMigrationStore((state) => state.selectTarget);
  const isLoading = useMigrationStore((state) => state.isLoadingChannels);
  const activeJob = useMigrationStore((state) => state.activeJob);
  const progress = useMigrationStore((state) => state.progress);
  const queueStatus = useMigrationStore((state) => state.queueStatus);
  const cancelMigration = useMigrationStore((state) => state.cancelMigration);
  const resetJob = useMigrationStore((state) => state.resetJob);
  const logs = useMigrationStore((state) => state.logs);
  const history = useMigrationStore((state) => state.channelCloningHistory);
  const syncStatus = useMigrationStore((state) => state.syncStatus);
  const isCheckingSync = useMigrationStore((state) => state.isCheckingSync);
  const checkSyncStatus = useMigrationStore((state) => state.checkSyncStatus);
  const autoSyncStatus = useMigrationStore((state) => state.autoSyncStatus);
  const isLoadingAutoSync = useMigrationStore((state) => state.isLoadingAutoSync);
  const toggleAutoSync = useMigrationStore((state) => state.toggleAutoSync);
  const captionRules = useMigrationStore((state) => state.captionRules);
  const dripDelaySeconds = useMigrationStore((state) => state.dripDelaySeconds);
  const setDripDelaySeconds = useMigrationStore((state) => state.setDripDelaySeconds);

  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 1 useState hook (consolidated UI state)
  const [panelState, setPanelState] = useState<{
    activeModal: "none" | "history" | "upload" | "caption_rules";
    showLogs: boolean;
    isAdvancedOpen: boolean;
  }>({
    activeModal: "none",
    showLogs: false,
    isAdvancedOpen: false,
  });

  const activeRulesCount = [
    captionRules.strip_links,
    captionRules.strip_all_mentions,
    Boolean(captionRules.replace_mentions && Object.keys(captionRules.replace_mentions).length > 0),
    Boolean(captionRules.remove_words && captionRules.remove_words.length > 0),
    Boolean(captionRules.prepend_header),
    Boolean(captionRules.append_signature),
  ].filter(Boolean).length;

  const navigate = useNavigate();

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);
  const targetChannel = channels.find((c) => c.id === selectedTargetId);
  const isCrossAccount = Boolean(
    sourceChannel && targetChannel && sourceChannel.account_id !== targetChannel.account_id
  );

  const isScheduled = activeJob?.status === "SCHEDULED";
  const isRunning = activeJob?.status === "RUNNING" || activeJob?.status === "PAUSED_FLOOD_WAIT";
  const isFinished =
    activeJob?.status === "COMPLETED" ||
    activeJob?.status === "FAILED" ||
    activeJob?.status === "CANCELLED";

  const filteredChannels = channels.filter((c) =>
    c.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.username && c.username.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  const stats = progress?.queue_stats || queueStatus?.stats || {
    total: activeJob?.total_videos || 0,
    pending: Math.max(0, (activeJob?.total_videos || 0) - (activeJob?.processed_videos || 0)),
    in_progress: 0,
    completed: activeJob?.processed_videos || 0,
    failed: 0,
    skipped: 0,
  };

  const percentage =
    progress?.percentage ??
    (activeJob?.total_videos && activeJob.total_videos > 0
      ? Math.round((activeJob.processed_videos / activeJob.total_videos) * 100)
      : 0);

  return (
    <div className="bg-card rounded-md border border-border p-2.5 sm:p-3 shadow-sm flex flex-col justify-between space-y-2.5 sm:space-y-3 h-full min-h-0 overflow-y-auto">
      <div className="space-y-2.5">
        {/* Panel Title */}
        <div className="border-b border-border pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono">
              Clonador MTProto
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Copia directa entre canales sin descargar a disco.
            </p>
          </div>
          {isCrossAccount ? (
            <Badge variant="outline" className="text-[10px] bg-indigo-500/15 text-indigo-300 border-indigo-500/30 font-mono">
              Puente Multi-Cuenta
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono">
              Directo MTProto
            </Badge>
          )}
        </div>

        {/* Guided Sequential Flow (1 -> 2 -> 3) */}
        <div className="space-y-2">
          {/* Step 1: Source Channel */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-secondary/30 border border-border/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center font-mono">
                  1
                </span>
                <span>Canal Origen (De dónde copiar)</span>
              </label>
              {selectedSourceId && (
                <button
                  type="button"
                  onClick={() => setPanelState((prev) => ({ ...prev, activeModal: "history" }))}
                  className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  title="Ver auditoría de clonaciones pasadas"
                >
                  <History className="w-3 h-3" />
                  <span>Historial ({history?.total_clones ?? 0})</span>
                </button>
              )}
            </div>
            <SearchableChannelSelect
              disabled={isRunning || isLoading}
              value={selectedSourceId}
              onChange={selectSource}
              channels={filteredChannels}
              disabledId={selectedTargetId}
              placeholder="Elegir canal origen..."
              accentColor="cyan"
            />
          </div>

          {/* Visual Connector Arrow */}
          <div className="flex justify-center -my-1 relative z-10">
            <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-primary shadow-xs">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Step 2: Target Channel */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-secondary/30 border border-border/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center font-mono">
                  2
                </span>
                <span>Canal Destino (A dónde enviar)</span>
              </label>
              {selectedTargetId && (
                <button
                  type="button"
                  onClick={() => setPanelState((prev) => ({ ...prev, activeModal: "upload" }))}
                  className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  title="Publicar archivo local directamente a este canal"
                >
                  <UploadCloud className="w-3 h-3" />
                  <span>+ Subir de mi PC</span>
                </button>
              )}
            </div>
            <SearchableChannelSelect
              disabled={isRunning || isLoading}
              value={selectedTargetId}
              onChange={selectTarget}
              channels={filteredChannels}
              disabledId={selectedSourceId}
              placeholder="Elegir canal destino..."
              accentColor="cyan"
            />
          </div>

          {/* Step 3: Collapsible Advanced Pipeline Drawer (Progressive Disclosure) */}
          <div className="border border-border/70 rounded-lg overflow-hidden bg-secondary/20">
            <button
              type="button"
              onClick={() =>
                setPanelState((prev) => ({ ...prev, isAdvancedOpen: !prev.isAdvancedOpen }))
              }
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-foreground text-[11px] font-mono uppercase tracking-wider">
                  Ajustes del Pipeline (Opcional)
                </span>
                {(activeRulesCount > 0 || dripDelaySeconds > 0 || autoSyncStatus?.is_active) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Hay reglas activas configuradas" />
                )}
              </div>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                  panelState.isAdvancedOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </button>

            {panelState.isAdvancedOpen && (
              <div className="p-3 pt-0 space-y-2 border-t border-border/50 text-xs animate-in fade-in">
                {/* Delta Sync & Auto-sync */}
                {selectedSourceId && selectedTargetId && selectedTargetId !== selectedSourceId && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-secondary/60 border border-border">
                      <div className="flex items-center gap-1.5 truncate">
                        <RefreshCw
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            isCheckingSync ? "animate-spin text-primary" : "text-muted-foreground"
                          )}
                        />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {isCheckingSync
                            ? "Comprobando..."
                            : syncStatus?.is_in_sync
                            ? "✓ 100% al día"
                            : syncStatus
                            ? `${syncStatus.missing_count} novedades`
                            : "Estado delta"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkSyncStatus()}
                        disabled={isCheckingSync}
                        className="text-[10px] font-mono text-primary hover:underline cursor-pointer"
                      >
                        Auditar
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-secondary/60 border border-border">
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] font-semibold text-foreground block">
                          Auto-Sync en Vivo
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          Clona nuevos posts al instante por push
                        </span>
                      </div>
                      <Switch
                        checked={Boolean(autoSyncStatus?.is_active)}
                        onCheckedChange={(checked) => toggleAutoSync(checked)}
                        disabled={isLoadingAutoSync}
                        aria-label="Auto sync"
                      />
                    </div>
                  </div>
                )}

                {/* Captions & Pacing Drip */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPanelState((prev) => ({ ...prev, activeModal: "caption_rules" }))
                    }
                    className="h-8 justify-between text-xs px-2.5 bg-secondary/60 border-border hover:bg-secondary font-normal"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <Sparkles className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">Captions</span>
                    </div>
                    <Badge
                      variant={activeRulesCount > 0 ? "admin" : "secondary"}
                      className="text-[9px] px-1.5 py-0 font-mono"
                    >
                      {activeRulesCount > 0 ? `${activeRulesCount} act.` : "Off"}
                    </Badge>
                  </Button>

                  <Select
                    value={String(dripDelaySeconds)}
                    onValueChange={(val) => setDripDelaySeconds(Number(val))}
                  >
                    <SelectTrigger className="h-8 bg-secondary/60 border-border text-xs px-2.5">
                      <SelectValue placeholder="Pacing" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="0" className="text-xs">
                        ⚡ Inmediato (2s)
                      </SelectItem>
                      <SelectItem value="60" className="text-xs">
                        💧 Goteo: 1 min
                      </SelectItem>
                      <SelectItem value="300" className="text-xs">
                        💧 Goteo: 5 min
                      </SelectItem>
                      <SelectItem value="900" className="text-xs">
                        💧 Goteo: 15 min
                      </SelectItem>
                      <SelectItem value="1800" className="text-xs">
                        💧 Goteo: 30 min
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic & Transparent CTA Action Button */}
        <div className="pt-2">
          {isScheduled ? (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 font-mono">
                    <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                    Migración Programada
                  </span>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-[10px] bg-cyan-500/10">
                    Smart Scheduler
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Esta migración arrancará automáticamente el:
                  <strong className="block text-foreground text-xs font-mono mt-0.5">
                    {activeJob?.scheduled_at
                      ? new Date(activeJob.scheduled_at).toLocaleString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Fecha programada"}
                  </strong>
                </p>
                <div className="pt-1.5 border-t border-cyan-900/40 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/jobs")}
                    className="flex-1 h-7 text-xs border-cyan-800/60 hover:bg-cyan-950 text-cyan-200"
                  >
                    Ver en Cola
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelMigration()}
                    className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => resetJob()}
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Planificar Otra Migración
              </Button>
            </div>
          ) : isRunning ? (
            <Button
              variant="destructive"
              size="default"
              onClick={() => cancelMigration()}
              className="w-full flex items-center justify-center gap-2 h-9.5 text-xs font-semibold shadow-lg shadow-rose-950/40 cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              <span>Detener Migración</span>
            </Button>
          ) : isFinished ? (
            <Button
              variant="secondary"
              size="default"
              onClick={() => resetJob()}
              className="w-full flex items-center justify-center gap-2 h-9.5 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Nueva Migración</span>
            </Button>
          ) : (
            <Button
              variant="default"
              size="default"
              disabled={
                !selectedSourceId ||
                !selectedTargetId ||
                selectedSourceId === selectedTargetId ||
                isLoading
              }
              onClick={onOpenConfirm}
              className="w-full flex items-center justify-center gap-2 h-10 text-xs font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer transition-all"
            >
              <Play className="w-4 h-4 fill-primary-foreground" />
              <span className="truncate">
                {!selectedSourceId
                  ? "Paso 1: Seleccioná un canal de origen"
                  : !selectedTargetId
                  ? "Paso 2: Seleccioná un canal de destino"
                  : selectedSourceId === selectedTargetId
                  ? "El destino debe ser diferente al origen"
                  : selectedMessageIds.length > 0
                  ? `Clonar ${selectedMessageIds.length} video${selectedMessageIds.length > 1 ? "s" : ""} seleccionado${selectedMessageIds.length > 1 ? "s" : ""} →`
                  : "Clonar canal completo →"}
              </span>
            </Button>
          )}
        </div>

        {/* Progress & Queue Section */}
        {(activeJob || isRunning) && !isScheduled && (
          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Progreso de Cola
              </span>
              <span className="font-mono text-primary font-semibold">{percentage}%</span>
            </div>

            <Progress value={percentage} aria-label="Progreso de clonación" />

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] pt-1 border-t border-border">
              <div className="p-1 rounded bg-card border border-border">
                <span className="text-muted-foreground block">Total</span>
                <span className="text-foreground font-semibold">{stats.total}</span>
              </div>
              <div className="p-1 rounded bg-card border border-border">
                <span className="text-muted-foreground block">Pend.</span>
                <span className="text-foreground font-semibold">{stats.pending}</span>
              </div>
              <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-500 dark:text-emerald-400 block">Éxito</span>
                <span className="text-emerald-600 dark:text-emerald-300 font-semibold">{stats.completed}</span>
              </div>
              <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20">
                <span className="text-rose-500 dark:text-rose-400 block">Fallo</span>
                <span className="text-rose-600 dark:text-rose-300 font-semibold">{stats.failed}</span>
              </div>
            </div>

            {progress?.message && (
              <p className="text-[10px] text-muted-foreground font-mono truncate pt-0.5">
                {progress.message}
              </p>
            )}
          </div>
        )}

        {/* Technical Safeguard Note */}
        <div className="p-2 rounded-lg bg-secondary/60 border border-border text-[11px] text-muted-foreground space-y-0.5">
          {isCrossAccount ? (
            <>
              <div className="flex items-center gap-1.5 text-indigo-400 font-medium font-mono text-xs">
                🔄 Modo Puente Multi-Cuenta (Streaming)
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Clonación entre distintas cuentas de Telegram (<span className="text-foreground font-medium">{sourceChannel?.account_name || "Cuenta A"}</span> → <span className="text-foreground font-medium">{targetChannel?.account_name || "Cuenta B"}</span>). Streaming temporal sin almacenamiento persistente en disco.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <Tv className="w-3.5 h-3.5" /> ⚡ Modo Directo MTProto (Instantáneo · 0.5s)
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Misma cuenta detectada. Copia pura por referencia MTProto (sin descargar ni subir archivos) con delay de {dripDelaySeconds > 0 ? `${dripDelaySeconds}s` : "1.5–2.0s"} por elemento.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 dark:text-emerald-400/90 pt-0.5 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Duplicate Guard activo: media idéntica se saltará automáticamente.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Terminal Log Toggle */}
      <div className="border-t border-border pt-2">
        <button
          onClick={() =>
            setPanelState((prev) => ({ ...prev, showLogs: !prev.showLogs }))
          }
          className="w-full flex items-center justify-between text-xs font-mono text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            Consola en vivo ({logs.length})
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {panelState.showLogs ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {panelState.showLogs && (
          <div className="mt-2 p-2 rounded-lg bg-secondary/40 border border-border font-mono text-[10px] text-muted-foreground max-h-36 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-muted-foreground italic">Esperando eventos...</div>
            ) : (
              logs.slice(0, 20).map((l) => (
                <div key={l.id} className="truncate">
                  <span className="text-muted-foreground">[{l.timestamp}]</span>{" "}
                  <span
                    className={
                      l.level === "error"
                        ? "text-rose-400"
                        : l.level === "warn"
                        ? "text-amber-400"
                        : l.level === "success"
                        ? "text-emerald-400"
                        : "text-foreground"
                    }
                  >
                    {l.text}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Channel Cloning Audit & History Modal */}
      <ChannelCloningHistoryModal
        isOpen={panelState.activeModal === "history"}
        onClose={() => setPanelState((prev) => ({ ...prev, activeModal: "none" }))}
      />

      {/* Direct Local Media Upload Modal */}
      <DirectUploadModal
        isOpen={panelState.activeModal === "upload"}
        onClose={() => setPanelState((prev) => ({ ...prev, activeModal: "none" }))}
        targetChannelId={selectedTargetId}
        targetChannelTitle={targetChannel?.title}
      />

      {/* Caption Rules & Sanitization Pipeline Modal */}
      <CaptionRulesModal
        isOpen={panelState.activeModal === "caption_rules"}
        onClose={() => setPanelState((prev) => ({ ...prev, activeModal: "none" }))}
      />
    </div>
  );
};
