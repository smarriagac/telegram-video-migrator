import React, { useState, useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ChannelCloningHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const channels = useMigrationStore((state) => state.channels);
  const history = useMigrationStore((state) => state.channelCloningHistory);
  const clonedItems = useMigrationStore((state) => state.clonedContentItems);

  const [activeTab, setActiveTab] = useState<"jobs" | "content">("jobs");
  const [contentSearch, setContentSearch] = useState<string>("");

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);

  const filteredContent = useMemo(() => {
    if (!contentSearch.trim()) return clonedItems;
    const q = contentSearch.toLowerCase();
    return clonedItems.filter(
      (it) =>
        it.caption.toLowerCase().includes(q) ||
        it.source_message_id.toString().includes(q) ||
        (it.target_message_id && it.target_message_id.toString().includes(q))
    );
  }, [clonedItems, contentSearch]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="w-3.5 h-3.5 text-purple-400" />;
      case "photo":
        return <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />;
      case "document":
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 space-y-4">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Registro y Auditoría de Clonación
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-normal">
                  {sourceChannel?.title || `#${selectedSourceId}`}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Historial auditado de ejecuciones, alcance (completo vs parcial) y detalle exacto de contenido clonado.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {/* Metric 1: Veces Clonado */}
          <div className="p-3 rounded-md bg-zinc-950/80 border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              Veces Clonado
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-white">
                {history?.total_clones ?? 0}
              </span>
              <span className="text-[11px] text-zinc-400">
                {(history?.total_clones ?? 0) === 1 ? "ejecución" : "ejecuciones"}
              </span>
            </div>
          </div>

          {/* Metric 2: ¿Se clonó todo? */}
          <div className="p-3 rounded-md bg-zinc-950/80 border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              ¿Se clonó todo?
            </span>
            <div>
              {history?.has_full_clone ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Canal Completo (100%)
                </span>
              ) : (history?.total_clones ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5" /> Clonaciones Parciales
                </span>
              ) : (
                <span className="text-xs text-zinc-500 font-mono">Nunca clonado</span>
              )}
            </div>
          </div>

          {/* Metric 3: Elementos Copiados */}
          <div className="p-3 rounded-md bg-zinc-950/80 border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              Contenido Copiado
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-cyan-400">
                {history?.total_items_cloned ?? 0}
              </span>
              <span className="text-[11px] text-zinc-400">elementos únicos</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("jobs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "jobs"
                  ? "bg-cyan-500 text-black shadow-sm"
                  : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/5"
              }`}
            >
              Historial de Ejecuciones ({history?.jobs.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "content"
                  ? "bg-cyan-500 text-black shadow-sm"
                  : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/5"
              }`}
            >
              Contenido Clonado ({clonedItems.length})
            </button>
          </div>

          {activeTab === "content" && (
            <div className="relative w-52">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por texto o #ID..."
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-md pl-7 pr-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}
        </div>

        {/* Tab Content: Jobs List */}
        {activeTab === "jobs" && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 max-h-[360px]">
            {(!history || history.jobs.length === 0) ? (
              <div className="text-center py-12 text-zinc-500 text-xs border border-dashed border-white/10 rounded-md bg-black/20">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-500" />
                Este canal no tiene registros de migraciones previas.
              </div>
            ) : (
              history.jobs.map((job, idx) => {
                const isSuccess = job.status === "COMPLETED";
                return (
                  <div
                    key={job.job_id}
                    className="p-3.5 rounded-md bg-secondary/50 border border-border hover:border-border/80 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground font-semibold">
                          #{history.jobs.length - idx}
                        </span>
                        {job.is_full_migration ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-500 dark:text-emerald-300 border border-emerald-500/25">
                            <Sparkles className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Clonación Completa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/15 text-primary border border-primary/25">
                            🎯 Selección Parcial
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            isSuccess
                              ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20"
                              : job.status === "RUNNING"
                              ? "bg-primary/10 text-primary border-primary/30 animate-pulse"
                              : "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{job.created_at ? new Date(job.created_at).toLocaleString() : "Reciente"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Destino:</span>
                        <span className="text-foreground font-medium font-mono">
                          {job.target_title || `Canal ${job.target_id}`}
                        </span>
                      </div>

                      <div className="font-mono text-[11px] text-foreground">
                        <span className="text-primary font-semibold">{job.processed_videos}</span> / {job.total_videos} elementos
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab Content: Cloned Items List */}
        {activeTab === "content" && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[360px]">
            {filteredContent.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-border rounded-md bg-secondary/30">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                No se encontraron elementos clonados para los criterios de búsqueda.
              </div>
            ) : (
              filteredContent.map((item) => (
                <div
                  key={`${item.job_id}-${item.source_message_id}`}
                  className="p-2.5 px-3 rounded-lg bg-secondary/50 border border-border flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-md bg-card border border-border shrink-0">
                      {getTypeIcon(item.media_type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-muted-foreground font-semibold">#{item.source_message_id}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-emerald-500 dark:text-emerald-400 font-semibold">#{item.target_message_id || "OK"}</span>
                        {item.target_channel_title && (
                          <span className="text-muted-foreground text-[10px]">({item.target_channel_title})</span>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground truncate mt-0.5">
                        {item.caption || <span className="text-muted-foreground italic">[Multimedia sin texto]</span>}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      {item.migrated_at ? new Date(item.migrated_at).toLocaleDateString() : ""}
                    </span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                      Clonado
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
