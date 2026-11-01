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
    <div className="bg-[#0e1015] rounded-xl border border-zinc-800 p-4 shadow-sm flex flex-col justify-between space-y-4 h-full min-h-0 overflow-y-auto">
      <div className="space-y-4">
        {/* Panel Title */}
        <div className="border-b border-zinc-800 pb-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100 font-mono">
              Migrar Canal
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
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
        <div className="space-y-3">
          {/* Campo "de" */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span className="font-mono text-cyan-400 font-bold uppercase text-[11px]">De:</span>
              <span className="text-[10px] text-zinc-500 font-mono">Canal Origen</span>
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
              <button
                type="button"
                onClick={() => setActiveModal("history")}
                className="w-full mt-1.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-white/5 hover:border-cyan-500/30 text-left transition-all group"
                title="Ver historial de clonaciones y contenido copiado"
              >
                <div className="flex items-center gap-1.5 text-[11px]">
                  <History className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-[-20deg] transition-transform" />
                  <span className="text-zinc-300 font-medium">
                    Clonado {history?.total_clones ?? 0} {(history?.total_clones ?? 0) === 1 ? "vez" : "veces"}
                  </span>
                  {history?.has_full_clone ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      ✓ Completo
                    </span>
                  ) : (history?.total_clones ?? 0) > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      Parcial
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-mono text-cyan-400 group-hover:underline">
                  Auditar →
                </span>
              </button>
            )}
          </div>

          {/* Connector arrow */}
          <div className="flex justify-center -my-1">
            <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 shadow-sm">
              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>

          {/* Campo "para" */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span className="font-mono text-emerald-400 font-bold uppercase text-[11px]">Para:</span>
              <span className="text-[10px] text-zinc-500 font-mono">Canal Destino</span>
            </label>
            <SearchableChannelSelect
              disabled={isRunning || isLoading}
              value={selectedTargetId}
              onChange={selectTarget}
              channels={filteredChannels}
              disabledId={selectedSourceId}
              placeholder="Elegir canal destino..."
              accentColor="emerald"
            />

            {/* Direct Local Upload Button */}
            {selectedTargetId && (
              <div className="space-y-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setActiveModal("upload")}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-white/5 hover:border-emerald-500/30 text-left transition-all group"
                  title="Subir archivo local directamente a este canal"
                >
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <UploadCloud className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-zinc-300 font-medium">Subir desde mi PC</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 group-hover:underline">
                    + Publicar directo
                  </span>
                </button>

                {selectedSourceId && selectedTargetId !== selectedSourceId && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-white/5 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isCheckingSync ? "animate-spin text-cyan-400" : syncStatus?.is_in_sync ? "text-emerald-400" : "text-amber-400"}`} />
                      {isCheckingSync ? (
                        <span className="text-zinc-400 truncate">Comprobando delta...</span>
                      ) : syncStatus?.is_in_sync ? (
                        <span className="text-emerald-300 font-medium truncate">✓ 100% sincronizado</span>
                      ) : syncStatus ? (
                        <span className="text-amber-300 font-medium font-mono truncate">
                          {syncStatus.missing_count} novedades
                        </span>
                      ) : (
                        <span className="text-zinc-400 truncate">Sin verificar</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => checkSyncStatus()}
                      disabled={isCheckingSync}
                      className="text-[10px] font-mono text-cyan-400 hover:underline shrink-0 ml-1.5"
                    >
                      Auditar
                    </button>
                  </div>
                )}

                {/* Auto-Sync en Vivo Toggle */}
                {selectedSourceId && selectedTargetId !== selectedSourceId && (
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          autoSyncStatus?.is_active
                            ? "bg-emerald-400"
                            : "bg-zinc-600"
                        }`}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-zinc-200 font-medium text-xs truncate flex items-center gap-1.5">
                          Auto-Sync en Vivo
                          {autoSyncStatus?.is_active && (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-1 py-0.5 rounded border border-emerald-500/30 font-mono">
                              MTProto Push
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate">
                          {autoSyncStatus?.is_active
                            ? "Sincroniza nuevos posts al instante"
                            : "Detecta y clona contenido en tiempo real"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isLoadingAutoSync}
                      onClick={() => toggleAutoSync(!autoSyncStatus?.is_active)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoSyncStatus?.is_active ? "bg-emerald-500" : "bg-zinc-700"
                      } ${isLoadingAutoSync ? "opacity-50 cursor-not-allowed" : ""}`}
                      title={
                        autoSyncStatus?.is_active
                          ? "Desactivar auto-sincronización"
                          : "Activar auto-sincronización"
                      }
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          autoSyncStatus?.is_active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Pipeline Modules: Caption Rules, Drip Feed & Duplicate Guard */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Pipeline & Módulos
              </span>
              <NavLink
                to="/pipeline"
                className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
                title="Abrir vista completa del pipeline de procesamiento"
              >
                Panel completo →
              </NavLink>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveModal("caption_rules")}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 transition-colors"
                title="Configurar limpieza de links, reemplazo de menciones y firmas"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Captions</span>
                </div>
                {activeRulesCount > 0 ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-medium">
                    {activeRulesCount} act.
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">Off</span>
                )}
              </button>

              <div className="relative">
                <select
                  value={dripDelaySeconds}
                  onChange={(e) => setDripDelaySeconds(Number(e.target.value))}
                  className="w-full appearance-none px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 focus:outline-none cursor-pointer"
                  title="Intervalo de publicación (Pacing anti-flood o goteo programado)"
                >
                  <option value={0}>⚡ Pacing: Inmediato (2s)</option>
                  <option value={60}>💧 Goteo: 1 min</option>
                  <option value={300}>💧 Goteo: 5 min</option>
                  <option value={900}>💧 Goteo: 15 min</option>
                  <option value={1800}>💧 Goteo: 30 min</option>
                </select>
              </div>
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
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Progreso de Cola
              </span>
              <span className="font-mono text-cyan-400 font-semibold">{percentage}%</span>
            </div>

            <Progress value={percentage} aria-label="Progreso de clonación" />

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] pt-1 border-t border-zinc-800">
              <div className="p-1 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 block">Total</span>
                <span className="text-zinc-200 font-semibold">{stats.total}</span>
              </div>
              <div className="p-1 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-400 block">Pend.</span>
                <span className="text-zinc-300 font-semibold">{stats.pending}</span>
              </div>
              <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 block">Éxito</span>
                <span className="text-emerald-300 font-semibold">{stats.completed}</span>
              </div>
              <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20">
                <span className="text-rose-400 block">Fallo</span>
                <span className="text-rose-300 font-semibold">{stats.failed}</span>
              </div>
            </div>

            {progress?.message && (
              <p className="text-[10px] text-zinc-400 font-mono truncate pt-0.5">
                {progress.message}
              </p>
            )}
          </div>
        )}

        {/* Technical Safeguard Note */}
        <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 space-y-1">
          {isCrossAccount ? (
            <>
              <div className="flex items-center gap-1.5 text-indigo-400 font-medium font-mono text-xs">
                🔄 Modo Puente Multi-Cuenta (Streaming)
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Clonación entre distintas cuentas de Telegram (<span className="text-zinc-300 font-medium">{sourceChannel?.account_name || "Cuenta A"}</span> → <span className="text-zinc-300 font-medium">{targetChannel?.account_name || "Cuenta B"}</span>). Streaming temporal sin almacenamiento persistente en disco.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                <Tv className="w-3.5 h-3.5" /> ⚡ Modo Directo MTProto (Instantáneo · 0.5s)
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Misma cuenta detectada. Copia pura por referencia MTProto (sin descargar ni subir archivos) con delay de {dripDelaySeconds > 0 ? `${dripDelaySeconds}s` : "1.5–2.0s"} por elemento.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 pt-0.5 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Duplicate Guard activo: media idéntica se saltará automáticamente.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Terminal Log Toggle */}
      <div className="border-t border-zinc-800 pt-2">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/40 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            Consola en vivo ({logs.length})
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {showLogs ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {showLogs && (
          <div className="mt-2 p-2 rounded-lg bg-[#090a0e] border border-zinc-800 font-mono text-[10px] text-zinc-400 max-h-36 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic">Esperando eventos...</div>
            ) : (
              logs.slice(0, 20).map((l) => (
                <div key={l.id} className="truncate">
                  <span className="text-zinc-600">[{l.timestamp}]</span>{" "}
                  <span
                    className={
                      l.level === "error"
                        ? "text-rose-400"
                        : l.level === "warn"
                        ? "text-amber-400"
                        : l.level === "success"
                        ? "text-emerald-400"
                        : "text-zinc-300"
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
