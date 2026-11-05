import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  StopCircle,
  Terminal,
  UploadCloud,
} from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { useMigrationStream } from "../application/useMigrationStream";
import { SearchableChannelSelect } from "./components/SearchableChannelSelect";
import { MessageSelector } from "./components/MessageSelector";
import { InlineCaptionRules } from "./components/InlineCaptionRules";
import { InlineCloningHistory } from "./components/InlineCloningHistory";
import { InlineDirectUpload } from "./components/InlineDirectUpload";
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
  workbenchTab: "none" | "rules" | "history" | "upload";
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

  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 1 useState hook (consolidated wizard state)
  const [wizardState, setWizardState] = useState<WizardViewState>({
    currentStep: "channels",
    workbenchTab: "none",
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

  const isExecutionMode = Boolean(activeJob || isRunning);

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
      {/* Industrial Step Track */}
      {!isExecutionMode && (
        <div className="border-b border-border/70 pb-3 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3 text-xs">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setWizardState((s) => ({ ...s, currentStep: "channels" }))}
              className={cn(
                "flex items-center gap-2 font-mono transition-colors cursor-pointer",
                wizardState.currentStep === "channels"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  wizardState.currentStep === "channels"
                    ? "bg-primary scale-125"
                    : canGoToContent
                    ? "bg-primary/50"
                    : "bg-muted-foreground/40"
                )}
              />
              <span>Canales</span>
            </button>

            <span className="text-muted-foreground/30 font-mono">───</span>

            {/* Step 2 */}
            <button
              type="button"
              disabled={!canGoToContent}
              onClick={() => canGoToContent && setWizardState((s) => ({ ...s, currentStep: "content" }))}
              className={cn(
                "flex items-center gap-2 font-mono transition-colors",
                wizardState.currentStep === "content"
                  ? "text-primary font-semibold cursor-pointer"
                  : canGoToContent
                  ? "text-muted-foreground hover:text-foreground cursor-pointer"
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  wizardState.currentStep === "content"
                    ? "bg-primary scale-125"
                    : wizardState.currentStep === "review"
                    ? "bg-primary/50"
                    : "bg-muted-foreground/40"
                )}
              />
              <span>Selección de Videos</span>
              {selectedMessageIds.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20">
                  {selectedMessageIds.length}
                </span>
              )}
            </button>

            <span className="text-muted-foreground/30 font-mono">───</span>

            {/* Step 3 */}
            <button
              type="button"
              disabled={!canGoToContent}
              onClick={() => canGoToContent && setWizardState((s) => ({ ...s, currentStep: "review" }))}
              className={cn(
                "flex items-center gap-2 font-mono transition-colors",
                wizardState.currentStep === "review"
                  ? "text-primary font-semibold cursor-pointer"
                  : canGoToContent
                  ? "text-muted-foreground hover:text-foreground cursor-pointer"
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  wizardState.currentStep === "review"
                    ? "bg-primary scale-125"
                    : "bg-muted-foreground/40"
                )}
              />
              <span>Confirmación y Despacho</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isCrossAccount ? (
              <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-mono">
                Puente Multi-Cuenta
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono">
                Directo MTProto
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between shrink-0 animate-in fade-in font-mono"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Main Stage */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {/* ================= STEP 4: ACTIVE EXECUTION & MONITOR ================= */}
        {isExecutionMode ? (
          <div className="max-w-4xl mx-auto w-full h-full min-h-0 overflow-y-auto space-y-4 py-2">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                    <Layers className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                      {isFinished ? "Clonación Finalizada" : isScheduled ? "Migración Programada" : "Clonación en Ejecución"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
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
                      className="h-8 text-xs font-semibold gap-1.5 shadow-sm cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>Detener</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetJob()}
                      className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Nueva Migración</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Progress Bar & Percentage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Progreso de la cola:</span>
                    <span className="text-primary font-bold text-sm">{percentage}%</span>
                  </div>
                  <Progress value={percentage} aria-label="Progreso" className="h-2" />
                  {progress?.message && (
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{progress.message}</p>
                  )}
                </div>

                {/* Queue Metrics */}
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-muted-foreground text-[10px] block uppercase">Total</span>
                    <span className="text-foreground font-bold text-sm">{stats.total}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-muted-foreground text-[10px] block uppercase">Pendientes</span>
                    <span className="text-foreground font-bold text-sm">{stats.pending}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="text-emerald-500/80 text-[10px] block uppercase">Éxito</span>
                    <span className="font-bold text-sm">{stats.completed}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <span className="text-rose-500/80 text-[10px] block uppercase">Fallo</span>
                    <span className="font-bold text-sm">{stats.failed}</span>
                  </div>
                </div>

                {/* Live Console Logs */}
                <div className="border border-border rounded-lg bg-black/60 p-3 space-y-1 font-mono text-[11px] max-h-44 overflow-y-auto">
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
          </div>
        ) : wizardState.currentStep === "channels" ? (
          /* ================= STEP 1: DUAL-TERMINAL CONSOLE & INLINE WORKBENCH ================= */
          <div className="flex-1 min-h-0 w-full flex flex-col justify-between max-w-5xl mx-auto py-2 overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Dual Console Surface */}
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                {/* Top Bar with Console Header */}
                <div className="px-5 py-3 border-b border-border/80 bg-secondary/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                      Consola de Enrutamiento de Canales
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Extracción por referencia MTProto
                  </span>
                </div>

                {/* Dual Workstation Grid: Origen | Destino */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  {/* Left Wing: Canal Origen */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                        Canal Origen
                      </span>
                      {selectedSourceId && (
                        <button
                          type="button"
                          onClick={() =>
                            setWizardState((s) => ({
                              ...s,
                              workbenchTab: s.workbenchTab === "history" ? "none" : "history",
                            }))
                          }
                          className={cn(
                            "text-[11px] font-mono px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer",
                            wizardState.workbenchTab === "history"
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "text-primary hover:underline hover:bg-primary/10"
                          )}
                        >
                          <History className="w-3 h-3" />
                          <span>Auditar Historial ({history?.total_clones ?? 0})</span>
                        </button>
                      )}
                    </div>

                    <SearchableChannelSelect
                      disabled={isRunning || isLoading}
                      value={selectedSourceId}
                      onChange={selectSource}
                      channels={channels}
                      disabledId={selectedTargetId}
                      placeholder="Seleccionar canal de extracción..."
                      accentColor="cyan"
                    />

                    {sourceChannel ? (
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/70 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChatAvatar
                            id={sourceChannel.id}
                            title={sourceChannel.title}
                            accountId={sourceChannel.account_id}
                            className="w-8 h-8 rounded-md shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block">{sourceChannel.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate block">
                              {sourceChannel.username ? `@${sourceChannel.username}` : `ID: ${sourceChannel.id}`}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {sourceChannel.type === "channel" ? "Canal" : "Grupo"}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Elegí el canal desde el cual querés transferir publicaciones y videos sin descargarlos a tu disco.
                      </p>
                    )}
                  </div>

                  {/* Right Wing: Canal Destino */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
                        Canal Destino
                      </span>
                      {selectedTargetId && (
                        <button
                          type="button"
                          onClick={() =>
                            setWizardState((s) => ({
                              ...s,
                              workbenchTab: s.workbenchTab === "upload" ? "none" : "upload",
                            }))
                          }
                          className={cn(
                            "text-[11px] font-mono px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer",
                            wizardState.workbenchTab === "upload"
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "text-primary hover:underline hover:bg-primary/10"
                          )}
                        >
                          <UploadCloud className="w-3 h-3" />
                          <span>Publicar desde PC</span>
                        </button>
                      )}
                    </div>

                    <SearchableChannelSelect
                      disabled={isRunning || isLoading}
                      value={selectedTargetId}
                      onChange={selectTarget}
                      channels={channels}
                      disabledId={selectedSourceId}
                      placeholder="Seleccionar canal receptor..."
                      accentColor="cyan"
                    />

                    {targetChannel ? (
                      <div className="p-3 rounded-lg bg-secondary/40 border border-border/70 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChatAvatar
                            id={targetChannel.id}
                            title={targetChannel.title}
                            accountId={targetChannel.account_id}
                            className="w-8 h-8 rounded-md shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block">{targetChannel.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate block">
                              {targetChannel.username ? `@${targetChannel.username}` : `ID: ${targetChannel.id}`}
                            </span>
                          </div>
                        </div>
                        {targetChannel.can_post ? (
                          <Badge variant="admin" className="text-[10px] font-mono shrink-0">
                            Permiso OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] font-mono shrink-0">
                            Solo Lectura
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Elegí el canal propio o comunidad donde se publicará el contenido clonado.
                      </p>
                    )}
                  </div>
                </div>

                {/* Lower Shelf: Horizontal Pipeline Control Bar */}
                <div className="p-4 bg-secondary/20 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant={wizardState.workbenchTab === "rules" ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setWizardState((s) => ({
                          ...s,
                          workbenchTab: s.workbenchTab === "rules" ? "none" : "rules",
                        }))
                      }
                      className="h-8 text-xs px-3 font-mono gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Reglas de Texto</span>
                      <Badge variant={activeRulesCount > 0 ? "admin" : "secondary"} className="text-[9px] px-1 py-0 ml-1">
                        {activeRulesCount > 0 ? `${activeRulesCount} activas` : "Inactivas"}
                      </Badge>
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground font-mono">Pacing:</span>
                      <Select
                        value={String(dripDelaySeconds)}
                        onValueChange={(val) => setDripDelaySeconds(Number(val))}
                      >
                        <SelectTrigger className="h-8 w-36 bg-card border-border text-xs px-2.5 font-mono">
                          <SelectValue placeholder="Pacing" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-xs font-mono">
                          <SelectItem value="0">Inmediato (2s)</SelectItem>
                          <SelectItem value="60">Goteo 1 min</SelectItem>
                          <SelectItem value="300">Goteo 5 min</SelectItem>
                          <SelectItem value="900">Goteo 15 min</SelectItem>
                          <SelectItem value="1800">Goteo 30 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedSourceId && selectedTargetId && selectedTargetId !== selectedSourceId && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">Auto-Sync en Vivo:</span>
                      <Switch
                        checked={Boolean(autoSyncStatus?.is_active)}
                        onCheckedChange={(checked) => toggleAutoSync(checked)}
                        disabled={isLoadingAutoSync}
                        aria-label="Auto sync"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Inline Workbench Area (Occupies the 60% free canvas space) */}
              <div className="w-full">
                {wizardState.workbenchTab === "rules" && (
                  <InlineCaptionRules onClose={() => setWizardState((s) => ({ ...s, workbenchTab: "none" }))} />
                )}

                {wizardState.workbenchTab === "history" && (
                  <InlineCloningHistory onClose={() => setWizardState((s) => ({ ...s, workbenchTab: "none" }))} />
                )}

                {wizardState.workbenchTab === "upload" && (
                  <InlineDirectUpload
                    targetChannelId={selectedTargetId}
                    targetChannelTitle={targetChannel?.title}
                    onClose={() => setWizardState((s) => ({ ...s, workbenchTab: "none" }))}
                  />
                )}

                {wizardState.workbenchTab === "none" && (
                  <div className="p-4 rounded-xl border border-dashed border-border/80 bg-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground select-none">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground text-xs block font-mono">
                          Mesa de Trabajo Lista
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          Podés desplegar las <strong className="text-foreground">Reglas de Texto</strong>, auditar el <strong className="text-foreground">Historial</strong> o hacer clic en <strong className="text-primary font-semibold">Continuar a Selección de Videos →</strong>.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-secondary/60 border border-border text-muted-foreground">
                        Paso 1 de 3
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 Action Bar */}
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                size="default"
                disabled={!canGoToContent}
                onClick={() => setWizardState((s) => ({ ...s, currentStep: "content" }))}
                className="h-10 px-6 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer transition-all gap-1.5"
              >
                <span>Continuar a Selección de Videos</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
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
          /* ================= STEP 3: UNIFIED TECHNICAL DISPATCH SHEET ================= */
          <div className="max-w-3xl mx-auto w-full h-full min-h-0 overflow-y-auto py-2 space-y-4">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              {/* Sheet Header */}
              <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                    Ficha Técnica de Despacho
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Confirmación de parámetros de transferencia MTProto
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30 bg-primary/10">
                  Verificado
                </Badge>
              </div>

              {/* Transfer Route Table */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border/70">
                  {/* Origen */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                      Origen
                    </span>
                    <div className="flex items-center gap-3">
                      {sourceChannel && (
                        <ChatAvatar
                          id={sourceChannel.id}
                          title={sourceChannel.title}
                          accountId={sourceChannel.account_id}
                          className="w-9 h-9 rounded-md shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground block truncate">{sourceChannel?.title}</span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          {sourceChannel?.username ? `@${sourceChannel.username}` : `ID: ${sourceChannel?.id}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Destino */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                      Destino
                    </span>
                    <div className="flex items-center gap-3">
                      {targetChannel && (
                        <ChatAvatar
                          id={targetChannel.id}
                          title={targetChannel.title}
                          accountId={targetChannel.account_id}
                          className="w-9 h-9 rounded-md shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground block truncate">{targetChannel?.title}</span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          {targetChannel?.username ? `@${targetChannel.username}` : `ID: ${targetChannel?.id}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Parameters Table */}
                <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block uppercase">Alcance</span>
                    <span className="font-semibold text-foreground text-xs mt-0.5 block truncate">
                      {selectedMessageIds.length > 0 ? `${selectedMessageIds.length} seleccionados` : "Canal completo"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block uppercase">Filtro Idempotente</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-0.5 block">
                      Duplicate Guard Activo
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block uppercase">Pacing de Envío</span>
                    <span className="font-semibold text-foreground text-xs mt-0.5 block">
                      {dripDelaySeconds > 0 ? `Intervalo ${dripDelaySeconds}s` : "Inmediato (2s)"}
                    </span>
                  </div>
                </div>

                {/* Scheduler Box */}
                <div className="pt-2 border-t border-border/70 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Programación Diferida
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {wizardState.isScheduleEnabled
                        ? "El trabajo se ejecutará en la fecha y hora seleccionada."
                        : "El trabajo comenzará de forma inmediata al hacer clic en Iniciar."}
                    </span>
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
                  <div className="pt-2">
                    <DateTimePicker
                      value={scheduledAt}
                      onChange={(date) => setScheduledAt(date ? date.toISOString() : null)}
                      placeholder="Definir fecha y hora de ejecución..."
                    />
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="px-5 py-3.5 bg-secondary/30 border-t border-border flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardState((s) => ({ ...s, currentStep: "content" }))}
                  className="h-9 px-4 text-xs font-mono gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Modificar Selección</span>
                </Button>

                <Button
                  type="button"
                  size="default"
                  onClick={handleLaunchMigration}
                  className="h-9 px-6 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {wizardState.isScheduleEnabled
                      ? "Programar Despacho MTProto"
                      : "Iniciar Proceso de Clonación"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

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
