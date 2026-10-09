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
        return "text-zinc-300";
    }
  };

  return (
    <section
      aria-label="Registro de actividad y logs en vivo"
      className="bg-[#090A0F] rounded-2xl border border-white/5 overflow-hidden shadow-2xl"
    >
      <div className="bg-zinc-950/80 px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
            Live Stream Logs & Activity
          </span>
          <span
            aria-label={`${logs.length} eventos registrados`}
            className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono"
          >
            {logs.length} eventos
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
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
        className="h-56 overflow-y-auto p-4 space-y-2 font-mono text-xs select-text scrollbar-thin scrollbar-thumb-zinc-800 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 italic">
            Esperando eventos de migración...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
              <span className="text-zinc-600 shrink-0 font-mono text-[11px]">{log.timestamp}</span>
              <span className="text-zinc-600 font-bold shrink-0" aria-hidden="true">›</span>
              <span className={`${getLogColor(log.level)} break-all`}>{log.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
