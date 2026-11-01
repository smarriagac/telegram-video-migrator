import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Search,
  LogIn,
  AlertTriangle,
  PlayCircle,
  Radio,
  UserPlus,
  Clock,
  Layers,
  Globe,
  Database,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useAuditStore } from "../application/useAuditStore";
import { Button } from "@/shared/components/ui/button";
import { AuditLogDetailModal } from "./components/AuditLogDetailModal";

export const AuditView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const logs = useAuditStore((state) => state.logs);
  const total = useAuditStore((state) => state.total);
  const page = useAuditStore((state) => state.page);
  const pageSize = useAuditStore((state) => state.pageSize);
  const totalPages = useAuditStore((state) => state.totalPages);
  const selectedLog = useAuditStore((state) => state.selectedLog);
  const setSelectedLog = useAuditStore((state) => state.setSelectedLog);
  const isLoading = useAuditStore((state) => state.isLoading);
  const error = useAuditStore((state) => state.error);
  const fetchLogs = useAuditStore((state) => state.fetchLogs);
  const setPage = useAuditStore((state) => state.setPage);
  const setPageSize = useAuditStore((state) => state.setPageSize);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    // Category filter
    let matchesCategory = true;
    if (filterCategory === "AUTH") {
      matchesCategory = log.action === "LOGIN" || log.action === "LOGIN_FAILED";
    } else if (filterCategory === "MIGRATION") {
      matchesCategory = log.action === "MIGRATION_START" || log.action === "MIGRATION_CANCEL";
    } else if (filterCategory === "SYNC") {
      matchesCategory = log.action === "AUTO_SYNC_TOGGLE";
    } else if (filterCategory === "USERS") {
      matchesCategory =
        log.action === "USER_CREATE" ||
        log.action === "USER_UPDATE" ||
        log.action === "USER_DELETE";
    }

    if (!matchesCategory) return false;

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const emailMatch = log.user_email ? log.user_email.toLowerCase().includes(q) : false;
    const actionMatch = log.action.toLowerCase().includes(q);
    const resourceMatch = log.resource ? log.resource.toLowerCase().includes(q) : false;
    const detailsMatch = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false;
    return emailMatch || actionMatch || resourceMatch || detailsMatch;
  });

  // KPI Calculations
  const totalEvents = logs.length;
  const loginEvents = logs.filter((l) => l.action === "LOGIN" || l.action === "LOGIN_FAILED").length;
  const migrationEvents = logs.filter((l) => l.action.startsWith("MIGRATION_")).length;
  const syncEvents = logs.filter((l) => l.action === "AUTO_SYNC_TOGGLE").length;

  const getActionBadge = (action: string) => {
    switch (action) {
      case "LOGIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <LogIn className="w-3 h-3" /> LOGIN
          </span>
        );
      case "LOGIN_FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> LOGIN FALLIDO
          </span>
        );
      case "MIGRATION_START":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <PlayCircle className="w-3 h-3" /> MIGRACIÓN
          </span>
        );
      case "MIGRATION_CANCEL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            MIGRACIÓN CANCELADA
          </span>
        );
      case "AUTO_SYNC_TOGGLE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Radio className="w-3 h-3" /> AUTO-SYNC
          </span>
        );
      case "USER_CREATE":
      case "USER_UPDATE":
      case "USER_DELETE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <UserPlus className="w-3 h-3" /> {action}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-white/5">
            {action}
          </span>
        );
    }
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 min-h-0 overflow-y-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Auditoría del Sistema
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                PostgreSQL Logbook
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Registro inmutable de accesos de usuarios, clonaciones de canales y cambios de configuración.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs()}
            disabled={isLoading}
            className="border-white/10 bg-[#14161F] hover:bg-white/5 text-xs text-zinc-300 flex items-center gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            Actualizar
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-[#14161F] border border-white/5 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Total Eventos</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">{totalEvents}</p>
        </div>

        <div className="bg-[#14161F] border border-white/5 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Inicios de Sesión</span>
            <LogIn className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-400">{loginEvents}</p>
        </div>

        <div className="bg-[#14161F] border border-white/5 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Clonaciones Canales</span>
            <PlayCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold font-mono text-cyan-400">{migrationEvents}</p>
        </div>

        <div className="bg-[#14161F] border border-white/5 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Vínculos Auto-Sync</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-400">{syncEvents}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#14161F] border border-white/5 p-2.5 rounded-xl shrink-0">
        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: "ALL", label: "Todos" },
            { id: "AUTH", label: "Accesos / Login" },
            { id: "MIGRATION", label: "Clonaciones" },
            { id: "SYNC", label: "Auto-Sync" },
            { id: "USERS", label: "Usuarios RBAC" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs whitespace-nowrap ${
                filterCategory === cat.id
                  ? "bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por usuario, acción o detalle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 h-8 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 w-full sm:w-64 transition-all"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#14161F] border border-white/5 rounded-xl shadow-2xl flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 border-b border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold text-zinc-300">
            Registros Encontrados: <span className="font-mono text-cyan-400">{filteredLogs.length}</span>
          </span>
          <span className="text-[11px] font-mono text-zinc-500">Orden: Más recientes primero</span>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500 text-xs space-y-2">
              <Database className="w-8 h-8 text-zinc-600" />
              <p>No se encontraron registros de auditoría para el criterio seleccionado.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-black/30 text-zinc-400 sticky top-0 font-mono text-[11px] border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Evento</th>
                  <th className="py-2.5 px-3">Usuario</th>
                  <th className="py-2.5 px-3">Recurso / Destino</th>
                  <th className="py-2.5 px-3">Detalles</th>
                  <th className="py-2.5 px-3">IP Origen</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="py-2.5 px-3 text-zinc-200 font-sans font-medium">
                      {log.user_email || <span className="text-zinc-500 italic font-mono text-[10px]">Sistema / Bot</span>}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 font-mono max-w-xs truncate" title={log.resource || ""}>
                      {log.resource || "-"}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-xs text-zinc-400 max-w-sm truncate" title={JSON.stringify(log.details || {})}>
                      {log.details ? (
                        <span className="font-mono text-[10px] text-zinc-300 bg-black/40 px-1.5 py-0.5 rounded border border-white/5 hover:border-cyan-500/30 transition-colors">
                          {JSON.stringify(log.details)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span>{log.ip_address || "127.0.0.1"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/20 text-[11px] font-sans font-medium transition-all"
                        title="Ver detalles completos del evento"
                      >
                        <Eye className="w-3 h-3 group-hover:scale-110 transition-transform" />
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 bg-black/20 shrink-0">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              disabled={isLoading}
              className="bg-[#0D0E15] border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>por página</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">
              Total: <strong className="font-mono text-zinc-200">{total}</strong> eventos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-zinc-400">
              Página <strong className="text-cyan-400">{page}</strong> de{" "}
              <strong className="text-zinc-300">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="h-7 px-2 border-white/10 bg-[#0D0E15] hover:bg-white/5 text-xs text-zinc-300 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="h-7 px-2 border-white/10 bg-[#0D0E15] hover:bg-white/5 text-xs text-zinc-300 flex items-center gap-1"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalle Extendido de Auditoría */}
      <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
};
