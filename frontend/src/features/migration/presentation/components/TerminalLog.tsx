import React, { useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { LogEntry } from "../../domain/types";

export const TerminalLog: React.FC = () => {
  const logs = useMigrationStore((state) => state.logs);
  const clearLogs = useMigrationStore((state) => state.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // newer logs at top
    }
  }, [logs]);

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return "text-emerald-400";
      case "warn":
        return "text-amber-400";
      case "error":
        return "text-red-400";
      default:
        return "text-foreground";
    }
  };

  return (
    <section
      aria-label="Registro de actividad y logs en vivo"
      className="bg-card rounded-md border border-border overflow-hidden shadow-sm"
    >
      <div className="bg-secondary/60 px-3.5 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-foreground">
            Live Stream Logs & Activity
          </span>
          <span
            aria-label={`${logs.length} eventos registrados`}
            className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-mono border border-border"
          >
            {logs.length} eventos
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          title="Limpiar logs"
          aria-label="Limpiar registro de logs"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        tabIndex={0}
        aria-label="Lista de logs en vivo"
        className="h-44 overflow-y-auto p-3 space-y-1 font-mono text-[11px] select-text focus:outline-none focus:ring-1 focus:ring-primary/50 bg-card"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground italic">
            Esperando eventos de migración...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
              <span className="text-muted-foreground shrink-0 font-mono text-[11px]">{log.timestamp}</span>
              <span className="text-muted-foreground font-bold shrink-0" aria-hidden="true">›</span>
              <span className={`${getLogColor(log.level)} break-all`}>{log.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
