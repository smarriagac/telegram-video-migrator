import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  Clock,
  Film,
  History,
  Layers,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  StopCircle,
  Terminal,
  Tv,
  UploadCloud,
} from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { useMigrationStream } from "../application/useMigrationStream";
import { SearchableChannelSelect } from "./components/SearchableChannelSelect";
import { MessageSelector } from "./components/MessageSelector";
import { ChannelCloningHistoryModal } from "./components/ChannelCloningHistoryModal";
import { DirectUploadModal } from "./components/DirectUploadModal";
import { CaptionRulesModal } from "./components/CaptionRulesModal";
import { ScheduledSuccessModal } from "./components/ScheduledSuccessModal";
import { DateTimePicker } from "@/shared/components/ui/date-time-picker";
import { ChatAvatar } from "@/shared/components/ui/chat-avatar";
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

type WizardStep = "channels" | "content" | "review";

interface WizardViewState {
  currentStep: WizardStep;
  activeModal: "none" | "history" | "upload" | "caption_rules";
  isAdvancedOpen: boolean;
  isScheduleEnabled: boolean;
  scheduledSuccess: {
    jobId: string;
    sourceTitle: string;
    targetTitle: string;
    scheduledAt: string;
    itemCount: number | "all";
  } | null;
}

export const MigrationView: React.FC = () => {
  const navigate = useNavigate();

  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 2 useState hooks
  // Hook 1: Master Wizard Stepper and Dialog State
  const [wizardState, setWizardState] = useState<WizardViewState>({
    currentStep: "channels",
    activeModal: "none",
    isAdvancedOpen: false,
    isScheduleEnabled: false,
    scheduledSuccess: null,
  });

  // Domain Store
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
  const scheduledAt = useMigrationStore((state) => state.scheduledAt);
  const setScheduledAt = useMigrationStore((state) => state.setScheduledAt);
  const fetchChannels = useMigrationStore((state) => state.fetchChannels);
  const startMigration = useMigrationStore((state) => state.startMigration);
  const error = useMigrationStore((state) => state.error);

  // Hook connecting SSE streaming lifecycle
  useMigrationStream(activeJob?.job_id ?? null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const sourceChannel = useMemo(
    () => channels.find((c) => c.id === selectedSourceId),
    [channels, selectedSourceId]
  );
  const targetChannel = useMemo(
    () => channels.find((c) => c.id === selectedTargetId),
    [channels, selectedTargetId]
  );

  const isCrossAccount = Boolean(
    sourceChannel && targetChannel && sourceChannel.account_id !== targetChannel.account_id
  );

  const isScheduled = activeJob?.status === "SCHEDULED";
  const isRunning = activeJob?.status === "RUNNING" || activeJob?.status === "PAUSED_FLOOD_WAIT";
  const isFinished =
    activeJob?.status === "COMPLETED" ||
    activeJob?.status === "FAILED" ||
    activeJob?.status === "CANCELLED";

  // When job is running or scheduled, force step to live execution monitor
  const isExecutionMode = Boolean(activeJob || isRunning);

  const filteredChannels = channels;

  const activeRulesCount = [
    captionRules.strip_links,
    captionRules.strip_all_mentions,
    Boolean(captionRules.replace_mentions && Object.keys(captionRules.replace_mentions).length > 0),
    Boolean(captionRules.remove_words && captionRules.remove_words.length > 0),
    Boolean(captionRules.prepend_header),
    Boolean(captionRules.append_signature),
  ].filter(Boolean).length;

  const canGoToContent = Boolean(selectedSourceId && selectedTargetId && selectedSourceId !== selectedTargetId);

  const handleLaunchMigration = async () => {
    const plannedSchedule = wizardState.isScheduleEnabled ? scheduledAt : null;
    const count = selectedMessageIds.length > 0 ? selectedMessageIds.length : "all";

    const jobId = await startMigration();

    if (jobId && plannedSchedule) {
      setWizardState((prev) => ({
        ...prev,
        scheduledSuccess: {
          jobId,
          sourceTitle: sourceChannel?.title || String(selectedSourceId),
          targetTitle: targetChannel?.title || String(selectedTargetId),
          scheduledAt: plannedSchedule,
          itemCount: count,
        },
      }));
    }
  };

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
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-hidden">
      {/* Wizard Status Bar (1. Canales -> 2. Contenido -> 3. Resumen & Lanzamiento) */}
      {!isExecutionMode && (
        <div className="bg-card border border-border rounded-xl p-1.5 sm:p-2 shadow-xs shrink-0 select-none">
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {/* Step 1: Canales */}
            <button
              type="button"
              onClick={() => setWizardState((s) => ({ ...s, currentStep: "channels" }))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer",
                wizardState.currentStep === "channels"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : canGoToContent
                  ? "hover:bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0",
                  wizardState.currentStep === "channels"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : canGoToContent
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {canGoToContent && wizardState.currentStep !== "channels" ? "✓" : "1"}
              </span>
              <div className="min-w-0 truncate">
                <span className="block truncate text-xs font-semibold">1. Canales</span>
                <span
                  className={cn(
                    "text-[10px] truncate hidden sm:block",
                    wizardState.currentStep === "channels"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground font-mono"
                  )}
                >
                  {selectedSourceId && selectedTargetId ? "Origen y Destino listos" : "Origen y Destino"}
                </span>
              </div>
            </button>

            {/* Step 2: Contenido */}
            <button
              type="button"
              disabled={!canGoToContent}
              onClick={() => canGoToContent && setWizardState((s) => ({ ...s, currentStep: "content" }))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left",
                wizardState.currentStep === "content"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : canGoToContent
                  ? "hover:bg-muted text-foreground cursor-pointer"
                  : "text-muted-foreground/60 cursor-not-allowed opacity-60"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0",
                  wizardState.currentStep === "content"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : wizardState.currentStep === "review"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {wizardState.currentStep === "review" ? "✓" : "2"}
              </span>
              <div className="min-w-0 truncate">
                <span className="block truncate text-xs font-semibold">2. Contenido</span>
                <span
                  className={cn(
                    "text-[10px] truncate hidden sm:block",
                    wizardState.currentStep === "content"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground font-mono"
                  )}
                >
                  {selectedMessageIds.length > 0
                    ? `${selectedMessageIds.length} seleccionados`
                    : "Galería completa"}
                </span>
              </div>
            </button>

            {/* Step 3: Resumen */}
            <button
              type="button"
              disabled={!canGoToContent}
              onClick={() => canGoToContent && setWizardState((s) => ({ ...s, currentStep: "review" }))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left",
                wizardState.currentStep === "review"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : canGoToContent
                  ? "hover:bg-muted text-foreground cursor-pointer"
                  : "text-muted-foreground/60 cursor-not-allowed opacity-60"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0",
                  wizardState.currentStep === "review"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                3
              </span>
              <div className="min-w-0 truncate">
                <span className="block truncate text-xs font-semibold">3. Resumen</span>
                <span
                  className={cn(
                    "text-[10px] truncate hidden sm:block",
                    wizardState.currentStep === "review"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground font-mono"
                  )}
                >
                  Revisar y Lanzar
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between shrink-0 animate-in fade-in"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Main Wizard Stage */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {/* ================= STEP 4: ACTIVE EXECUTION & MONITOR ================= */}
        {isExecutionMode ? (
          <div className="max-w-3xl mx-auto w-full h-full min-h-0 overflow-y-auto space-y-4 py-2 sm:py-4">
            <div className="p-4 sm:p-5 rounded-xl bg-card border border-border shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                    <Layers className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground font-mono">
                      {isFinished ? "Clonación Finalizada" : isScheduled ? "Migración Programada" : "Clonación MTProto en Curso"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {sourceChannel?.title || "Origen"} → {targetChannel?.title || "Destino"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => cancelMigration()}
                      className="h-8 text-xs font-semibold gap-1.5 shadow-sm"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Detener</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetJob()}
                      className="h-8 text-xs font-semibold gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Nueva Migración</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Progreso de la cola:</span>
                  <span className="text-primary font-bold text-sm">{percentage}%</span>
                </div>
                <Progress value={percentage} aria-label="Progreso" className="h-2.5" />
                {progress?.message && (
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{progress.message}</p>
                )}
              </div>

              {/* Queue Metrics */}
              <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs pt-1">
                <div className="p-2 rounded-lg bg-secondary/60 border border-border">
                  <span className="text-muted-foreground text-[10px] block uppercase">Total</span>
                  <span className="text-foreground font-bold text-sm">{stats.total}</span>
                </div>
                <div className="p-2 rounded-lg bg-secondary/60 border border-border">
                  <span className="text-muted-foreground text-[10px] block uppercase">Pendientes</span>
                  <span className="text-foreground font-bold text-sm">{stats.pending}</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="text-emerald-500/80 text-[10px] block uppercase">Éxito</span>
                  <span className="font-bold text-sm">{stats.completed}</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <span className="text-rose-500/80 text-[10px] block uppercase">Fallo</span>
                  <span className="font-bold text-sm">{stats.failed}</span>
                </div>
              </div>

              {/* Live Console Logs */}
              <div className="border border-border rounded-lg bg-black/60 p-3 space-y-1 font-mono text-[11px] max-h-48 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-muted-foreground pb-1 border-b border-white/10 text-[10px]">
                  <Terminal className="w-3 h-3" />
                  <span>Consola de eventos en vivo</span>
                </div>
                {logs.length === 0 ? (
                  <p className="text-zinc-500 italic py-2 text-center">Esperando eventos de streaming MTProto...</p>
                ) : (
                  logs.slice(0, 30).map((l) => (
                    <div key={l.id} className="truncate">
                      <span className="text-zinc-500">[{l.timestamp}]</span>{" "}
                      <span
                        className={
                          l.level === "error"
                            ? "text-rose-400"
                            : l.level === "warn"
                            ? "text-amber-400"
                            : l.level === "success"
                            ? "text-emerald-400"
                            : "text-zinc-200"
                        }
                      >
                        {l.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : wizardState.currentStep === "channels" ? (
          /* ================= STEP 1: CHANNELS CONFIGURATION ================= */
          <div className="max-w-2xl mx-auto w-full h-full min-h-0 overflow-y-auto py-2 sm:py-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground font-mono">
                    Paso 1: Configurar Canales Origen y Destino
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Elegí de qué canal clonar el contenido y en cuál publicarlo de forma directa.
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

              {/* Step 1.1: Source Channel */}
              <div className="space-y-1.5 p-3 rounded-lg bg-secondary/30 border border-border/70">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center font-mono">
                      1
                    </span>
                    <span>Canal Origen (De dónde copiar)</span>
                  </label>
                  {selectedSourceId && (
                    <button
                      type="button"
                      onClick={() => setWizardState((s) => ({ ...s, activeModal: "history" }))}
                      className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
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
                <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-primary shadow-xs">
                  <ArrowDown className="w-4 h-4" />
                </div>
              </div>

              {/* Step 1.2: Target Channel */}
              <div className="space-y-1.5 p-3 rounded-lg bg-secondary/30 border border-border/70">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center font-mono">
                      2
                    </span>
                    <span>Canal Destino (A dónde enviar)</span>
                  </label>
                  {selectedTargetId && (
                    <button
                      type="button"
                      onClick={() => setWizardState((s) => ({ ...s, activeModal: "upload" }))}
                      className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
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

              {/* Step 1.3: Collapsible Advanced Pipeline Drawer */}
              <div className="border border-border/70 rounded-lg overflow-hidden bg-secondary/20">
                <button
                  type="button"
                  onClick={() => setWizardState((s) => ({ ...s, isAdvancedOpen: !s.isAdvancedOpen }))}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground text-[11px] font-mono uppercase tracking-wider">
                      Ajustes Avanzados del Pipeline (Opcional)
                    </span>
                    {(activeRulesCount > 0 || dripDelaySeconds > 0 || autoSyncStatus?.is_active) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Hay reglas activas" />
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                      wizardState.isAdvancedOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>

                {wizardState.isAdvancedOpen && (
                  <div className="p-3 pt-0 space-y-2.5 border-t border-border/50 text-xs animate-in fade-in">
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
                                ? `${syncStatus.missing_count} novedades pendientes`
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
                        onClick={() => setWizardState((s) => ({ ...s, activeModal: "caption_rules" }))}
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
                          <SelectItem value="0" className="text-xs">⚡ Inmediato (2s)</SelectItem>
                          <SelectItem value="60" className="text-xs">💧 Goteo: 1 min</SelectItem>
                          <SelectItem value="300" className="text-xs">💧 Goteo: 5 min</SelectItem>
                          <SelectItem value="900" className="text-xs">💧 Goteo: 15 min</SelectItem>
                          <SelectItem value="1800" className="text-xs">💧 Goteo: 30 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Continue to Step 2 Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  size="default"
                  disabled={!canGoToContent}
                  onClick={() => setWizardState((s) => ({ ...s, currentStep: "content" }))}
                  className="w-full h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>
                    {!selectedSourceId
                      ? "Paso 1: Seleccioná un canal de origen"
                      : !selectedTargetId
                      ? "Paso 2: Seleccioná un canal de destino"
                      : selectedSourceId === selectedTargetId
                      ? "El canal destino debe ser diferente al origen"
                      : "Continuar a Selección de Contenido →"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        ) : wizardState.currentStep === "content" ? (
          /* ================= STEP 2: FULL-WIDTH MEDIA GALLERY ================= */
          <div className="w-full h-full min-h-0 flex flex-col">
            <MessageSelector
              onBack={() => setWizardState((s) => ({ ...s, currentStep: "channels" }))}
              onNext={() => setWizardState((s) => ({ ...s, currentStep: "review" }))}
            />
          </div>
        ) : (
          /* ================= STEP 3: EXECUTIVE REVIEW & LAUNCH CARD ================= */
          <div className="max-w-3xl mx-auto w-full h-full min-h-0 overflow-y-auto py-2 sm:py-4 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground font-mono flex items-center gap-2">
                    <span>Paso 3: Revisar y Lanzar Clonación</span>
                    <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30 bg-primary/10">
                      Ficha Ejecutiva
                    </Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verificá los canales y la selección de videos antes de disparar el proceso por MTProto.
                  </p>
                </div>
              </div>

              {/* Source & Target Channel Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Source Channel Box */}
                <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-semibold">
                    <Radio className="w-3 h-3 text-primary" />
                    <span>Canal Origen (Extracción)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {sourceChannel && (
                      <ChatAvatar
                        id={sourceChannel.id}
                        title={sourceChannel.title}
                        accountId={sourceChannel.account_id}
                        className="w-9 h-9 rounded-md shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-foreground text-xs truncate">
                        {sourceChannel?.title || "Origen"}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {sourceChannel?.username ? `@${sourceChannel.username}` : `ID: ${sourceChannel?.id}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Target Channel Box */}
                <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-semibold">
                    <Tv className="w-3 h-3 text-emerald-400" />
                    <span>Canal Destino (Publicación)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {targetChannel && (
                      <ChatAvatar
                        id={targetChannel.id}
                        title={targetChannel.title}
                        accountId={targetChannel.account_id}
                        className="w-9 h-9 rounded-md shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-foreground text-xs truncate">
                        {targetChannel?.title || "Destino"}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {targetChannel?.username ? `@${targetChannel.username}` : `ID: ${targetChannel?.id}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scope & Media Selection Card */}
              <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-semibold">
                    <Film className="w-3 h-3 text-primary" />
                    <span>Alcance del Contenido</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/10">
                    {selectedMessageIds.length > 0
                      ? `${selectedMessageIds.length} elementos seleccionados`
                      : "Canal Completo (Todos los videos)"}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {selectedMessageIds.length > 0 ? (
                    <>
                      Se clonarán exactamente <strong>{selectedMessageIds.length} elementos multimedia</strong> seleccionados en la galería. Los elementos ya clonados previamente no se duplicarán gracias al filtro de idempotencia.
                    </>
                  ) : (
                    <>
                      Se clonarán <strong>todos los videos y archivos</strong> disponibles en el canal origen. Los elementos ya clonados en ejecuciones anteriores se omitirán automáticamente.
                    </>
                  )}
                </p>
              </div>

              {/* Active Pipeline Settings Summary */}
              <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-semibold">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>Pipeline y Reglas Activas</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-muted-foreground text-[10px] block">Sanitización:</span>
                    <span className="text-foreground font-medium text-[11px]">
                      {activeRulesCount > 0 ? `${activeRulesCount} reglas activas` : "Sin reglas"}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-muted-foreground text-[10px] block">Ritmo de Envío:</span>
                    <span className="text-foreground font-medium text-[11px]">
                      {dripDelaySeconds > 0 ? `Goteo ${dripDelaySeconds}s` : "Inmediato (2s)"}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-card border border-border">
                    <span className="text-muted-foreground text-[10px] block">Duplicate Guard:</span>
                    <span className="text-emerald-400 font-medium text-[11px]">✓ Activo (Idempotente)</span>
                  </div>
                </div>
              </div>

              {/* Optional Scheduling Section */}
              <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        Programar Ejecución en el Futuro
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {wizardState.isScheduleEnabled
                          ? "El Smart Scheduler arrancará el trabajo a la fecha y hora configurada."
                          : "Iniciar el trabajo inmediatamente al confirmar."}
                      </span>
                    </div>
                  </div>

                  <Switch
                    checked={wizardState.isScheduleEnabled}
                    onCheckedChange={(checked) => {
                      setWizardState((s) => ({ ...s, isScheduleEnabled: checked }));
                      if (checked && !scheduledAt) {
                        setScheduledAt(new Date(Date.now() + 15 * 60000).toISOString());
                      }
                    }}
                    aria-label="Programar migración"
                  />
                </div>

                {wizardState.isScheduleEnabled && (
                  <div className="pt-2 border-t border-border/50 animate-in fade-in">
                    <DateTimePicker
                      value={scheduledAt}
                      onChange={(date) => setScheduledAt(date ? date.toISOString() : null)}
                      placeholder="Seleccionar fecha y horario..."
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons: Back or Launch */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardState((s) => ({ ...s, currentStep: "content" }))}
                  className="w-full sm:w-auto h-9 px-4 gap-1.5 border-border hover:bg-muted cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Modificar Selección de Contenido</span>
                </Button>

                <Button
                  type="button"
                  size="default"
                  onClick={handleLaunchMigration}
                  className="w-full sm:w-auto h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Play className="w-4 h-4 fill-primary-foreground" />
                  <span>
                    {wizardState.isScheduleEnabled
                      ? "Programar Migración en la Nube ⏰"
                      : "¡Iniciar Clonación MTProto Ahora! 🚀"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Channel Cloning Audit & History Modal */}
      <ChannelCloningHistoryModal
        isOpen={wizardState.activeModal === "history"}
        onClose={() => setWizardState((prev) => ({ ...prev, activeModal: "none" }))}
      />

      {/* Direct Local Media Upload Modal */}
      <DirectUploadModal
        isOpen={wizardState.activeModal === "upload"}
        onClose={() => setWizardState((prev) => ({ ...prev, activeModal: "none" }))}
        targetChannelId={selectedTargetId}
        targetChannelTitle={targetChannel?.title}
      />

      {/* Caption Rules & Sanitization Pipeline Modal */}
      <CaptionRulesModal
        isOpen={wizardState.activeModal === "caption_rules"}
        onClose={() => setWizardState((prev) => ({ ...prev, activeModal: "none" }))}
      />

      {/* Scheduled Success Modal */}
      {wizardState.scheduledSuccess && (
        <ScheduledSuccessModal
          isOpen={true}
          onClose={() => setWizardState((prev) => ({ ...prev, scheduledSuccess: null }))}
          onViewJobs={() => {
            setWizardState((prev) => ({ ...prev, scheduledSuccess: null }));
            navigate("/jobs");
          }}
          jobId={wizardState.scheduledSuccess.jobId}
          sourceTitle={wizardState.scheduledSuccess.sourceTitle}
          targetTitle={wizardState.scheduledSuccess.targetTitle}
          scheduledAt={wizardState.scheduledSuccess.scheduledAt}
          itemCount={wizardState.scheduledSuccess.itemCount}
        />
      )}
    </div>
  );
};
