import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowDown,
  History,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
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

  // Strictly <= 2 useState hooks per architectural rules
  const [activeModal, setActiveModal] = useState<"none" | "history" | "upload" | "caption_rules">("none");
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const activeRulesCount = [
    captionRules.strip_links,
    captionRules.strip_all_mentions,
    Boolean(captionRules.replace_mentions && Object.keys(captionRules.replace_mentions).length > 0),
    Boolean(captionRules.remove_words && captionRules.remove_words.length > 0),
    Boolean(captionRules.prepend_header),
    Boolean(captionRules.append_signature),
  ].filter(Boolean).length;

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);
  const targetChannel = channels.find((c) => c.id === selectedTargetId);
  const isCrossAccount = Boolean(
    sourceChannel && targetChannel && sourceChannel.account_id !== targetChannel.account_id
  );

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
              Migrar Canal
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configurá origen y destino para clonar el contenido.
            </p>
          </div>
          {isCrossAccount ? (
            <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Puente Multi-Cuenta
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Directo MTProto
            </span>
          )}
        </div>

        {/* Form: De -> Para */}
        <div className="space-y-2">
          {/* Campo "de" */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
              <span className="font-mono text-primary font-bold uppercase text-[11px]">De:</span>
              <span className="text-[10px] text-muted-foreground font-mono">Canal Origen</span>
            </label>
            <SearchableChannelSelect
              disabled={isRunning || isLoading}
              value={selectedSourceId}
              onChange={selectSource}
              channels={filteredChannels}
              disabledId={selectedTargetId}
              placeholder="Elegir canal origen..."
              accentColor="cyan"
            />

            {/* Audit History Trigger Pill */}
            {selectedSourceId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveModal("history")}
                className="w-full mt-1 flex items-center justify-between px-2.5 h-7.5 bg-secondary/60 border-border hover:border-primary/40 text-left font-normal transition-all group"
                title="Ver historial de clonaciones y contenido copiado"
              >
                <div className="flex items-center gap-1.5 text-[11px]">
                  <History className="w-3.5 h-3.5 text-primary group-hover:rotate-[-20deg] transition-transform" />
                  <span className="text-foreground/90 font-medium">
                    Clonado {history?.total_clones ?? 0} {(history?.total_clones ?? 0) === 1 ? "vez" : "veces"}
                  </span>
                  {history?.has_full_clone ? (
                    <Badge variant="admin" size="sm">
                      ✓ Completo
                    </Badge>
                  ) : (history?.total_clones ?? 0) > 0 ? (
                    <Badge variant="secondary" size="sm" className="bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/25">
                      Parcial
                    </Badge>
                  ) : null}
                </div>
                <span className="text-[10px] font-mono text-primary group-hover:underline">
                  Auditar →
                </span>
              </Button>
            )}
          </div>

          {/* Connector arrow */}
          <div className="flex justify-center -my-0.5">
            <div className="w-5.5 h-5.5 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground shadow-sm">
              <ArrowDown className="w-3 h-3 text-primary" />
            </div>
          </div>

          {/* Campo "para" */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
              <span className="font-mono text-primary font-bold uppercase text-[11px]">Para:</span>
              <span className="text-[10px] text-muted-foreground font-mono">Canal Destino</span>
            </label>
            <SearchableChannelSelect
              disabled={isRunning || isLoading}
              value={selectedTargetId}
              onChange={selectTarget}
              channels={filteredChannels}
              disabledId={selectedSourceId}
              placeholder="Elegir canal destino..."
              accentColor="cyan"
            />

            {/* Direct Local Upload Button */}
            {selectedTargetId && (
              <div className="space-y-1 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveModal("upload")}
                  className="w-full flex items-center justify-between px-2.5 h-7.5 bg-secondary/60 border-border hover:border-primary/40 text-left font-normal transition-all group"
                  title="Subir archivo local directamente a este canal"
                >
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <UploadCloud className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-foreground/90 font-medium">Subir desde mi PC</span>
                  </div>
                  <span className="text-[10px] font-mono text-primary group-hover:underline">
                    + Publicar directo
                  </span>
                </Button>

                {selectedSourceId && selectedTargetId !== selectedSourceId && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-secondary/60 border border-border text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isCheckingSync ? "animate-spin text-primary" : syncStatus?.is_in_sync ? "text-emerald-500" : "text-amber-500"}`} />
                      {isCheckingSync ? (
                        <span className="text-muted-foreground truncate">Comprobando delta...</span>
                      ) : syncStatus?.is_in_sync ? (
                        <Badge variant="admin" size="sm" className="font-medium">✓ 100% sincronizado</Badge>
                      ) : syncStatus ? (
                        <Badge variant="secondary" size="sm" className="font-medium font-mono text-amber-500 dark:text-amber-300 bg-amber-500/15 border-amber-500/25">
                          {syncStatus.missing_count} novedades
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground truncate">Sin verificar</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => checkSyncStatus()}
                      disabled={isCheckingSync}
                      className="h-5.5 px-1.5 text-[10px] font-mono text-primary hover:text-primary hover:bg-primary/10 shrink-0 ml-1.5"
                    >
                      Auditar
                    </Button>
                  </div>
                )}

                {/* Auto-Sync en Vivo Toggle */}
                {selectedSourceId && selectedTargetId !== selectedSourceId && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border text-xs transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          autoSyncStatus?.is_active
                            ? "bg-emerald-400"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-foreground font-medium text-xs truncate flex items-center gap-1.5">
                          Auto-Sync en Vivo
                          {autoSyncStatus?.is_active && (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/30 font-mono">
                              MTProto Push
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {autoSyncStatus?.is_active
                            ? "Sincroniza nuevos posts al instante"
                            : "Detecta y clona contenido en tiempo real"}
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(autoSyncStatus?.is_active)}
                      onCheckedChange={(checked) => toggleAutoSync(checked)}
                      disabled={isLoadingAutoSync}
                      aria-label="Activar o desactivar auto-sincronización en vivo"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Pipeline Modules: Caption Rules, Drip Feed & Duplicate Guard */}
          <div className="pt-1.5 border-t border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3 h-3 text-primary" /> Pipeline & Módulos
              </span>
              <NavLink
                to="/pipeline"
                className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                title="Abrir vista completa del pipeline de procesamiento"
              >
                Panel completo →
              </NavLink>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveModal("caption_rules")}
                className="flex items-center justify-between px-2.5 h-7.5 bg-secondary/60 border-border hover:bg-muted text-xs text-foreground/90 font-normal w-full"
                title="Configurar limpieza de links, reemplazo de menciones y firmas"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">Captions</span>
                </div>
                {activeRulesCount > 0 ? (
                  <Badge variant="admin" size="sm" className="font-mono font-medium">
                    {activeRulesCount} act.
                  </Badge>
                ) : (
                  <Badge variant="viewer" size="sm" className="font-mono text-muted-foreground">
                    Off
                  </Badge>
                )}
              </Button>

              <Select
                value={String(dripDelaySeconds)}
                onValueChange={(val) => setDripDelaySeconds(Number(val))}
              >
                <SelectTrigger className="h-7.5 bg-secondary/60 border-border hover:bg-muted text-xs text-foreground px-2.5 focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Pacing" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                  <SelectItem value="0" className="text-xs">⚡ Inmediato (2s)</SelectItem>
                  <SelectItem value="60" className="text-xs">💧 Goteo: 1 min</SelectItem>
                  <SelectItem value="300" className="text-xs">💧 Goteo: 5 min</SelectItem>
                  <SelectItem value="900" className="text-xs">💧 Goteo: 15 min</SelectItem>
                  <SelectItem value="1800" className="text-xs">💧 Goteo: 30 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          {isRunning ? (
            <Button
              variant="destructive"
              size="default"
              onClick={() => cancelMigration()}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold shadow-lg shadow-rose-950/40"
            >
              <StopCircle className="w-4 h-4" />
              Detener Migración
            </Button>
          ) : isFinished ? (
            <Button
              variant="secondary"
              size="default"
              onClick={() => resetJob()}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold"
            >
              <RotateCcw className="w-4 h-4" />
              Nueva Migración
            </Button>
          ) : (
            <Button
              variant="primary"
              size="default"
              disabled={
                !selectedSourceId ||
                !selectedTargetId ||
                selectedSourceId === selectedTargetId ||
                isLoading
              }
              onClick={onOpenConfirm}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs"
            >
              <Play className="w-4 h-4 fill-current" />
              {selectedMessageIds.length > 0
                ? `Clonar (${selectedMessageIds.length}) Seleccionados`
                : "Clonar Todo el Canal"}
            </Button>
          )}
        </div>

        {/* Progress & Queue Section (shown when active job or running) */}
        {(activeJob || isRunning) && (
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
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between text-xs font-mono text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            Consola en vivo ({logs.length})
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {showLogs ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {showLogs && (
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
        isOpen={activeModal === "history"}
        onClose={() => setActiveModal("none")}
      />

      {/* Direct Local Media Upload Modal */}
      <DirectUploadModal
        isOpen={activeModal === "upload"}
        onClose={() => setActiveModal("none")}
        targetChannelId={selectedTargetId}
        targetChannelTitle={targetChannel?.title}
      />

      {/* Caption Rules & Sanitization Pipeline Modal */}
      <CaptionRulesModal
        isOpen={activeModal === "caption_rules"}
        onClose={() => setActiveModal("none")}
      />
    </div>
  );
};
