import React, { useMemo, useState } from "react";
import { History, X, Search, Video, ImageIcon, FileText, MessageSquare } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

interface Props {
  onClose: () => void;
}

export const InlineCloningHistory: React.FC<Props> = ({ onClose }) => {
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const channels = useMigrationStore((state) => state.channels);
  const history = useMigrationStore((state) => state.channelCloningHistory);
  const clonedItems = useMigrationStore((state) => state.clonedContentItems);

  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used)
  const [filterState, setFilterState] = useState<{
    activeTab: "jobs" | "content";
    search: string;
  }>({
    activeTab: "jobs",
    search: "",
  });

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);

  const filteredContent = useMemo(() => {
    if (!filterState.search.trim()) return clonedItems;
    const q = filterState.search.toLowerCase();
    return clonedItems.filter(
      (it) =>
        it.caption.toLowerCase().includes(q) ||
        it.source_message_id.toString().includes(q) ||
        (it.target_message_id && it.target_message_id.toString().includes(q))
    );
  }, [clonedItems, filterState.search]);

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
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in flex flex-col text-xs">
      {/* Workbench Header */}
      <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
            Auditoría e Historial de Clonación:
          </span>
          <span className="text-xs font-bold text-foreground">
            {sourceChannel?.title || `#${selectedSourceId}`}
          </span>
          {history?.has_full_clone ? (
            <Badge variant="admin" className="text-[10px] font-mono">
              ✓ Clon Completo Registrado
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] font-mono text-muted-foreground">
              Parcial
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors cursor-pointer"
          title="Cerrar panel de historial"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="p-4 border-b border-border/70 bg-secondary/15 grid grid-cols-3 gap-3 font-mono">
        <div className="p-2.5 rounded-lg bg-card border border-border">
          <span className="text-[10px] text-muted-foreground block uppercase">Veces Clonado</span>
          <span className="text-base font-bold text-foreground mt-0.5 block">
            {history?.total_clones ?? 0} {(history?.total_clones ?? 0) === 1 ? "ejecución" : "ejecuciones"}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-card border border-border">
          <span className="text-[10px] text-muted-foreground block uppercase">Alcance</span>
          <span className="text-base font-bold text-foreground mt-0.5 block">
            {history?.has_full_clone ? "100% Completo" : "Clonación Selectiva"}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-card border border-border">
          <span className="text-[10px] text-muted-foreground block uppercase">Último Destino</span>
          <span className="text-xs font-semibold text-primary mt-1 block truncate">
            {history?.jobs?.[0]?.target_title || "Ninguno"}
          </span>
        </div>
      </div>

      {/* Sub Tabs: Trabajos vs Contenido */}
      <div className="px-4 pt-3 flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => setFilterState((s) => ({ ...s, activeTab: "jobs" }))}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filterState.activeTab === "jobs"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Trabajos ({history?.jobs?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilterState((s) => ({ ...s, activeTab: "content" }))}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filterState.activeTab === "content"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Contenido Migrado ({clonedItems.length})
          </button>
        </div>

        {filterState.activeTab === "content" && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por texto o ID..."
              value={filterState.search}
              onChange={(e) => setFilterState((s) => ({ ...s, search: e.target.value }))}
              className="w-full bg-secondary/60 border border-border rounded pl-8 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* Table / List Body */}
      <div className="p-4 max-h-56 overflow-y-auto">
        {filterState.activeTab === "jobs" ? (
          (!history?.jobs || history.jobs.length === 0) ? (
            <div className="text-center py-6 text-muted-foreground font-mono text-xs">
              No hay ejecuciones de clonación previas registradas para este canal origen.
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.jobs.map((j) => (
                <div
                  key={j.job_id}
                  className="p-2.5 rounded-lg border border-border/80 bg-secondary/30 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{j.target_title || `Canal #${j.target_id}`}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {j.created_at ? new Date(j.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {j.processed_videos} videos transferidos · Job #{j.job_id.slice(0, 8)}
                    </span>
                  </div>

                  <Badge variant={j.is_full_migration ? "admin" : "secondary"} className="text-[10px] font-mono">
                    {j.is_full_migration ? "Completo" : "Parcial"}
                  </Badge>
                </div>
              ))}
            </div>
          )
        ) : (
          filteredContent.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground font-mono text-xs">
              No se encontraron elementos clonados.
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredContent.map((it) => (
                <div
                  key={`${it.job_id}_${it.source_message_id}`}
                  className="p-2 rounded-lg border border-border/80 bg-secondary/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getTypeIcon(it.media_type)}
                    <span className="text-foreground truncate max-w-md font-sans">
                      {it.caption || <span className="text-muted-foreground italic font-mono">Sin texto</span>}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    Msg #{it.source_message_id} → #{it.target_message_id || "?"}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border bg-secondary/30 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="text-xs h-7.5 px-4"
        >
          Cerrar Auditoría
        </Button>
      </div>
    </div>
  );
};
