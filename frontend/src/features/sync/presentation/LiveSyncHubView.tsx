import React, { useEffect, useState } from "react";
import {
  Radio,
  RefreshCw,
  Plus,
  Sliders,
  Trash2,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileVideo,
  Image,
  File,
  Search,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { useSyncStore } from "../application/useSyncStore";
import { CreateSyncBindingModal } from "./components/CreateSyncBindingModal";
import { SyncRulesModal } from "./components/SyncRulesModal";
import { SwitchSyncAccountModal } from "./components/SwitchSyncAccountModal";
import { SyncBinding } from "../domain/types";

export const LiveSyncHubView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  // Hook 1: Search query filter
  const [searchQuery, setSearchQuery] = useState("");
  // Hook 2: Confirmation dialog state (replaces browser window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "destructive" | "default";
    onConfirm: () => void;
  } | null>(null);

  const {
    bindings,
    health,
    isLoading,
    isReloading,
    error,
    fetchData,
    toggleActive,
    deleteBinding,
    reloadDaemon,
    setSelectedBinding,
    setCreateModalOpen,
    setRulesModalOpen,
    openSwitchModal,
  } = useSyncStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBindings = bindings.filter((b) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (b.source_channel_title && b.source_channel_title.toLowerCase().includes(query)) ||
      (b.target_channel_title && b.target_channel_title.toLowerCase().includes(query)) ||
      b.source_channel_id.toString().includes(query) ||
      b.target_channel_id.toString().includes(query)
    );
  });

  const handleOpenRules = (binding: SyncBinding) => {
    setSelectedBinding(binding);
    setRulesModalOpen(true);
  };

  const handleVerify = async (binding: SyncBinding) => {
    try {
      await fetch(`/api/sync/bindings/${binding.source_channel_id}/${binding.target_channel_id}/verify`, {
        method: "POST",
      });
      await fetchData();
    } catch (e) {
      console.error("Error verifying sync binding:", e);
    }
  };

  const handleDelete = (binding: SyncBinding) => {
    const confirmName = binding.source_channel_title || binding.source_channel_id;
    setConfirmDialog({
      isOpen: true,
      title: "Desvincular Sincronización",
      description: `¿Estás seguro de que deseás desvincular la sincronización automática de "${confirmName}"?`,
      confirmLabel: "Desvincular",
      variant: "destructive",
      onConfirm: async () => {
        await deleteBinding(binding.source_channel_id, binding.target_channel_id);
      },
    });
  };

  return (
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* View Header */}
      <ViewHeader
        icon={<Radio className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Matriz de Sincronización en Vivo"
        subtitle="Replicación instantánea de mensajes y multimedia entre canales vía listeners push de MTProto."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => reloadDaemon()}
          disabled={isReloading}
          className="h-8 border-border bg-card/60 hover:bg-muted text-foreground text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isReloading ? "animate-spin text-primary" : ""}`} />
          Recargar Listeners
        </Button>
        <Button
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Vincular Canales
        </Button>
      </ViewHeader>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Daemon Status Bar - Compact 2x2 on mobile, 4 columns on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-2.5 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Estado del Motor MTProto
            </CardTitle>
            <div className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500"></span>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-2.5 pt-0">
            <div className="text-xs sm:text-base font-bold text-foreground flex items-center gap-1 sm:gap-1.5 font-mono truncate">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{health?.is_running ? "DAEMON ACTIVO" : "INICIANDO"}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Escucha pasiva MTProto
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-2.5 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Clientes Conectados
            </CardTitle>
            <Radio className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-2.5 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-foreground">
              {health?.attached_clients_count || 1}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Pool MTProto cuentas
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-2.5 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Rutas Activas
            </CardTitle>
            <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-2.5 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-foreground">
              {bindings.filter((b) => b.is_active).length} / {bindings.length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Pares en escucha
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-2.5 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Cola de Despacho
            </CardTitle>
            <ShieldAlert className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-2.5 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-foreground">
              {health?.queue_depth || 0}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              En tránsito inmediato
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Bindings Matrix Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="p-3 pb-2">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Pares de Canales Vinculados
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Cada mensaje nuevo publicado en el origen será clonado instantáneamente hacia el destino según las reglas configuradas.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-background border-border text-xs text-foreground placeholder:text-muted-foreground h-7.5"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="rounded-md border border-border overflow-hidden bg-card">
            {/* Mobile View: High-Density Card List (< 640px) */}
            <div className="sm:hidden divide-y divide-border">
              {isLoading ? (
                <div className="p-3 space-y-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={`skel-mob-sync-${idx}`} className="p-3 space-y-2 rounded border border-border/50 bg-secondary/20">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-10 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-44" />
                      <div className="flex gap-1.5 pt-1">
                        <Skeleton className="h-4 w-12 rounded" />
                        <Skeleton className="h-4 w-12 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredBindings.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground font-mono">
                  No hay canales vinculados para sincronización en vivo. Haz clic en "+ Vincular Canales" para iniciar.
                </div>
              ) : (
                filteredBindings.map((binding) => {
                  const allowVideo = binding.media_filter_rules?.allow_video ?? true;
                  const allowPhoto = binding.media_filter_rules?.allow_photo ?? true;
                  const allowDoc = binding.media_filter_rules?.allow_document ?? true;
                  const stripLinks = binding.caption_rules?.strip_links ?? true;

                  return (
                    <div
                      key={`mobile-${binding.source_channel_id}-${binding.target_channel_id}`}
                      className="p-3 space-y-2.5 hover:bg-muted/40 transition-colors"
                    >
                      {/* Header: Origin -> Target and Switch */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Source */}
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0">DE:</span>
                              <span className="truncate">{binding.source_channel_title || "Canal Origen"}</span>
                              <span className="text-[9px] font-mono text-muted-foreground shrink-0">[{binding.source_channel_id}]</span>
                            </div>
                            {binding.status === "ACCESS_REVOKED" && (
                              <span className="text-[9px] text-destructive font-mono flex items-center gap-1 font-semibold mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                <span>Expulsado de Telegram</span>
                              </span>
                            )}
                          </div>
                          {/* Arrow & Target */}
                          <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">A:</span>
                            <span className="truncate">{binding.target_channel_title || "Canal Destino"}</span>
                            <span className="text-[9px] font-mono text-muted-foreground shrink-0">[{binding.target_channel_id}]</span>
                          </div>
                        </div>

                        {/* Active Switch or Access Revoked Badge */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          {binding.status === "ACCESS_REVOKED" ? (
                            <Badge
                              variant="destructive"
                              className="text-[9px] font-mono gap-1 px-1.5 py-0.5 bg-destructive/15 text-destructive border-destructive/30"
                              title={binding.last_error || "Fuiste expulsado del grupo en Telegram"}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>SIN ACCESO</span>
                            </Badge>
                          ) : (
                            <>
                              <Switch
                                checked={binding.is_active}
                                onCheckedChange={() => toggleActive(binding)}
                              />
                              <span
                                className={`text-[9px] font-semibold uppercase font-mono ${
                                  binding.is_active ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"
                                }`}
                              >
                                {binding.is_active ? "ACTIVO" : "PAUSA"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Rules Badges + Last Synced + Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border">
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {allowVideo && (
                            <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-primary text-[9px] px-1.5 py-0.5">
                              <FileVideo className="h-2.5 w-2.5 shrink-0" />
                              <span>Video</span>
                            </Badge>
                          )}
                          {allowPhoto && (
                            <Badge variant="outline" className="gap-1 border-amber-500/25 bg-amber-500/10 text-amber-500 dark:text-amber-400 text-[9px] px-1.5 py-0.5">
                              <Image className="h-2.5 w-2.5 shrink-0" />
                              <span>Foto</span>
                            </Badge>
                          )}
                          {allowDoc && (
                            <Badge variant="outline" className="gap-1 border-purple-500/25 bg-purple-500/10 text-purple-500 dark:text-purple-400 text-[9px] px-1.5 py-0.5">
                              <File className="h-2.5 w-2.5 shrink-0" />
                              <span>Doc</span>
                            </Badge>
                          )}
                          {stripLinks && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                              <span>Anti-Spam</span>
                            </Badge>
                          )}
                          <Badge variant="outline" className="border-border bg-secondary font-mono text-[9px] text-muted-foreground px-1.5 py-0.5">
                            <span>Msg #{binding.last_synced_message_id}</span>
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRules(binding)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Configurar filtros y reglas"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(binding)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            title="Eliminar vinculación"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop & Tablet View: Full Scrollable Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto w-full">
              <Table className="min-w-[680px]">
                <TableHeader className="bg-secondary/70">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs py-2 px-3">Canal Origen</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-center w-10 py-2 px-1"></TableHead>
                    <TableHead className="text-muted-foreground text-xs py-2 px-3">Canal Destino</TableHead>
                    <TableHead className="text-muted-foreground text-xs py-2 px-3">Filtros & Reglas</TableHead>
                    <TableHead className="text-muted-foreground text-xs py-2 px-3">Último Sincronizado</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-center py-2 px-3">Estado</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right py-2 px-3">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={`skel-sync-row-${idx}`} className="border-border/60">
                        <TableCell className="py-3 px-3"><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell className="py-3 px-3">
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-2.5 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-3">
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-2.5 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-3"><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="py-3 px-3"><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="py-3 px-3 text-center"><Skeleton className="h-5 w-12 mx-auto rounded-full" /></TableCell>
                        <TableCell className="py-3 px-3 text-right"><Skeleton className="h-7 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredBindings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground font-mono">
                        No hay canales vinculados para sincronización en vivo. Haz clic en "+ Vincular Canales" para iniciar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBindings.map((binding) => {
                      const allowVideo = binding.media_filter_rules?.allow_video ?? true;
                      const allowPhoto = binding.media_filter_rules?.allow_photo ?? true;
                      const allowDoc = binding.media_filter_rules?.allow_document ?? true;
                      const stripLinks = binding.caption_rules?.strip_links ?? true;

                      return (
                        <TableRow
                          key={`${binding.source_channel_id}-${binding.target_channel_id}`}
                          className="border-border/60 hover:bg-muted/40"
                        >
                          {/* Source Channel */}
                          <TableCell className="py-2 px-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground text-xs truncate max-w-[180px]">
                                {binding.source_channel_title || "Canal Origen"}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {binding.source_channel_id}
                              </span>
                              {binding.status === "ACCESS_REVOKED" && (
                                <span className="text-[10px] text-destructive font-mono flex items-center gap-1 font-semibold mt-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  <span>Expulsado de Telegram</span>
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Arrow */}
                          <TableCell className="text-center py-2 px-1">
                            <ArrowRight className="h-3.5 w-3.5 text-primary inline-block" />
                          </TableCell>

                          {/* Target Channel */}
                          <TableCell className="py-2 px-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground text-xs truncate max-w-[180px]">
                                {binding.target_channel_title || "Canal Destino"}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {binding.target_channel_id}
                              </span>
                            </div>
                          </TableCell>

                          {/* Filters & Rules */}
                          <TableCell className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {allowVideo && (
                                <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-primary text-[10px]">
                                  <FileVideo className="h-3 w-3 shrink-0" />
                                  <span>Video</span>
                                </Badge>
                              )}
                              {allowPhoto && (
                                <Badge variant="outline" className="gap-1 border-amber-500/25 bg-amber-500/10 text-amber-500 dark:text-amber-400 text-[10px]">
                                  <Image className="h-3 w-3 shrink-0" />
                                  <span>Foto</span>
                                </Badge>
                              )}
                              {allowDoc && (
                                <Badge variant="outline" className="gap-1 border-purple-500/25 bg-purple-500/10 text-purple-500 dark:text-purple-400 text-[10px]">
                                  <File className="h-3 w-3 shrink-0" />
                                  <span>Doc</span>
                                </Badge>
                              )}
                              {stripLinks && (
                                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-[10px]">
                                  <span>Anti-Spam</span>
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Last Synced Message ID */}
                          <TableCell className="py-2 px-3 whitespace-nowrap">
                            <Badge variant="outline" className="border-border bg-secondary font-mono text-[10px] text-muted-foreground">
                              <span>Msg #{binding.last_synced_message_id}</span>
                            </Badge>
                          </TableCell>

                          {/* Active Toggle or Revoked Status */}
                          <TableCell className="text-center py-2 px-3 whitespace-nowrap">
                            {binding.status === "ACCESS_REVOKED" ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge
                                  variant="destructive"
                                  className="bg-destructive/15 text-destructive border-destructive/30 font-mono text-[9px] gap-1 px-1.5 py-0.5"
                                  title={binding.last_error || "Fuiste expulsado del canal en Telegram"}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  <span>SIN ACCESO</span>
                                </Badge>
                                <span className="text-[8px] font-mono text-muted-foreground">Expulsado</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <Switch
                                  checked={binding.is_active}
                                  onCheckedChange={() => toggleActive(binding)}
                                />
                                <span
                                  className={`text-[9px] font-semibold uppercase font-mono ${
                                    binding.is_active ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"
                                  }`}
                                >
                                  {binding.is_active ? "ACTIVO" : "PAUSA"}
                                </span>
                              </div>
                            )}
                          </TableCell>

                          {/* Action Buttons */}
                          <TableCell className="text-right py-2 px-3 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {binding.status === "ACCESS_REVOKED" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openSwitchModal(binding)}
                                  className="h-7 px-2 border-amber-500/40 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 text-xs gap-1 font-medium"
                                  title="Relevar cuenta de extracción para este canal"
                                >
                                  <Users className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Cambiar Cuenta</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVerify(binding)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-muted"
                                title="Recomprobar acceso MTProto a este canal"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRules(binding)}
                                className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                                title="Configurar filtros y reglas de este canal"
                              >
                                <Sliders className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(binding)}
                                className="h-7 px-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 text-xs"
                                title="Eliminar vinculación"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateSyncBindingModal />
      <SyncRulesModal />
      <SwitchSyncAccountModal />

      {/* Confirmation Dialog (replaces browser window.confirm) */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
        />
      )}
    </div>
  );
};
