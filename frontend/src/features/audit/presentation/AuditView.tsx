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
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import { AuditLogDetailModal } from "./components/AuditLogDetailModal";
import { ViewHeader } from "@/shared/components/ViewHeader";

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
          <Badge variant="outline" className="gap-1 font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <LogIn className="w-3 h-3" /> LOGIN
          </Badge>
        );
      case "LOGIN_FAILED":
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
            <AlertTriangle className="w-3 h-3" /> LOGIN FALLIDO
          </Badge>
        );
      case "MIGRATION_START":
        return (
          <Badge variant="outline" className="gap-1 font-mono text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            <PlayCircle className="w-3 h-3" /> MIGRACIÓN
          </Badge>
        );
      case "MIGRATION_CANCEL":
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
            MIGRACIÓN CANCELADA
          </Badge>
        );
      case "AUTO_SYNC_TOGGLE":
        return (
          <Badge variant="outline" className="gap-1 font-mono text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Radio className="w-3 h-3" /> AUTO-SYNC
          </Badge>
        );
      case "USER_CREATE":
      case "USER_UPDATE":
      case "USER_DELETE":
        return (
          <Badge variant="outline" className="gap-1 font-mono text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
            <UserPlus className="w-3 h-3" /> {action}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {action}
          </Badge>
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
    <div className="w-full h-full flex flex-col space-y-3 sm:space-y-4 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* Header */}
      <ViewHeader
        icon={<ShieldCheck className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Auditoría del Sistema"
        subtitle="Registro inmutable de accesos de usuarios, clonaciones de canales y cambios de configuración."
        badge={
          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            PostgreSQL Logbook
          </Badge>
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="text-xs text-zinc-300 flex items-center gap-1.5 h-8 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-cyan-400")} />
          Actualizar
        </Button>
      </ViewHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Eventos</span>
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-semibold font-mono text-foreground">{totalEvents}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Inicios de Sesión</span>
              <LogIn className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">{loginEvents}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Clonaciones Canales</span>
              <PlayCircle className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-semibold font-mono text-primary">{migrationEvents}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Vínculos Auto-Sync</span>
              <Radio className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-amber-600 dark:text-amber-400">{syncEvents}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-lg shrink-0">
        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar">
          {[
            { id: "ALL", label: "Todos" },
            { id: "AUTH", label: "Accesos / Login" },
            { id: "MIGRATION", label: "Clonaciones" },
            { id: "SYNC", label: "Auto-Sync" },
            { id: "USERS", label: "Usuarios RBAC" },
          ].map((cat) => (
            <Button
              key={cat.id}
              variant={filterCategory === cat.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterCategory(cat.id)}
              className={cn(
                "h-8 px-3 text-xs whitespace-nowrap",
                filterCategory === cat.id
                  ? "bg-zinc-800 text-white border border-zinc-700/80 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Buscar por usuario, acción o detalle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="border-border bg-card rounded-lg shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Registros Encontrados: <span className="font-mono text-primary">{filteredLogs.length}</span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">Orden: Más recientes primero</span>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground text-xs space-y-2">
              <Database className="w-8 h-8 text-muted-foreground/60" />
              <p>No se encontraron registros de auditoría para el criterio seleccionado.</p>
            </div>
          ) : (
            <Table className="w-full min-w-[700px] text-left text-xs border-collapse">
              <TableHeader className="bg-secondary/40 text-muted-foreground sticky top-0 font-mono text-xs border-b border-border z-10">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="py-2.5 px-3">Fecha y Hora</TableHead>
                  <TableHead className="py-2.5 px-3">Evento</TableHead>
                  <TableHead className="py-2.5 px-3">Usuario</TableHead>
                  <TableHead className="py-2.5 px-3">Recurso / Destino</TableHead>
                  <TableHead className="py-2.5 px-3">Detalles</TableHead>
                  <TableHead className="py-2.5 px-3">IP Origen</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border text-foreground font-mono text-xs">
                {filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-zinc-800/30 cursor-pointer transition-colors group"
                  >
                    <TableCell className="py-2.5 px-3 whitespace-nowrap text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 whitespace-nowrap">{getActionBadge(log.action)}</TableCell>
                    <TableCell className="py-2.5 px-3 text-zinc-200 font-sans font-medium">
                      {log.user_email || <span className="text-zinc-500 italic font-mono text-[10px]">Sistema / Bot</span>}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-cyan-300 font-mono max-w-xs truncate" title={log.resource || ""}>
                      {log.resource || "-"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 font-sans text-xs text-zinc-400 max-w-sm truncate" title={JSON.stringify(log.details || {})}>
                      {log.details ? (
                        <span className="font-mono text-[10px] text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 hover:border-cyan-500/30 transition-colors">
                          {JSON.stringify(log.details)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 whitespace-nowrap text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span>{log.ip_address || "127.0.0.1"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="h-7 px-2 text-xs font-sans font-medium"
                        title="Ver detalles completos del evento"
                      >
                        <Eye className="w-3 h-3 group-hover:scale-105 transition-transform mr-1" />
                        Ver Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-secondary/40 shrink-0">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => setPageSize(Number(val))}
              disabled={isLoading}
            >
              <SelectTrigger className="w-16 h-7 bg-card border-border text-xs text-foreground font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground font-mono">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>por página</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">
              Total: <strong className="font-mono text-zinc-200">{total}</strong> eventos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400">
              Página <strong className="text-cyan-400">{page}</strong> de{" "}
              <strong className="text-zinc-300">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="h-7 px-2 text-xs flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="h-7 px-2 text-xs flex items-center gap-1"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal de Detalle Extendido de Auditoría */}
      <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
};
