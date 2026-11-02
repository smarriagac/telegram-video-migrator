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
  FileVideo,
  Image,
  File,
  Search,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useSyncStore } from "../application/useSyncStore";
import { CreateSyncBindingModal } from "./components/CreateSyncBindingModal";
import { SyncRulesModal } from "./components/SyncRulesModal";
import { SyncBinding } from "../domain/types";

export const LiveSyncHubView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used for filter)
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleDelete = async (binding: SyncBinding) => {
    const confirmName = binding.source_channel_title || binding.source_channel_id;
    if (window.confirm(`¿Desvincular la sincronización automática de ${confirmName}?`)) {
      await deleteBinding(binding.source_channel_id, binding.target_channel_id);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Radio className="h-6 w-6 text-emerald-400" />
            Matriz de Sincronización en Vivo
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Replicación instantánea de mensajes y multimedia entre canales vía listeners push de MTProto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadDaemon()}
            disabled={isReloading}
            className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isReloading ? "animate-spin text-emerald-400" : ""}`} />
            Recargar Listeners
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Vincular Canales
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Daemon Status Bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Estado del Motor MTProto
            </CardTitle>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {health?.is_running ? "DAEMON ACTIVO" : "INICIANDO"}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Escucha pasiva de eventos NewMessage
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Clientes Conectados
            </CardTitle>
            <Radio className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {health?.attached_clients_count || 1}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Pool MTProto de cuentas vinculadas
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Rutas Activas
            </CardTitle>
            <ArrowRight className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {bindings.filter((b) => b.is_active).length} / {bindings.length}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Pares en escucha continua
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Cola de Despacho
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {health?.queue_depth || 0}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Mensajes en tránsito inmediato
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Bindings Matrix Card */}
      <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-sm backdrop-blur">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-medium text-white">
                Pares de Canales Vinculados
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Cada mensaje nuevo publicado en el origen será clonado instantáneamente hacia el destino según las reglas configuradas.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Buscar por nombre o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-zinc-950/50 border-zinc-800 text-xs text-white placeholder:text-zinc-500 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 text-xs">Canal Origen</TableHead>
                  <TableHead className="text-zinc-400 text-xs text-center w-12"></TableHead>
                  <TableHead className="text-zinc-400 text-xs">Canal Destino</TableHead>
                  <TableHead className="text-zinc-400 text-xs">Filtros & Reglas</TableHead>
                  <TableHead className="text-zinc-400 text-xs">Último Sincronizado</TableHead>
                  <TableHead className="text-zinc-400 text-xs text-center">Estado</TableHead>
                  <TableHead className="text-zinc-400 text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-xs text-zinc-500">
                      Cargando matriz de sincronización...
                    </TableCell>
                  </TableRow>
                ) : filteredBindings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-xs text-zinc-500">
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
                        className="border-zinc-800/60 hover:bg-zinc-800/30"
                      >
                        {/* Source Channel */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-white text-xs">
                              {binding.source_channel_title || "Canal Origen"}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {binding.source_channel_id}
                            </span>
                          </div>
                        </TableCell>

                        {/* Arrow */}
                        <TableCell className="text-center">
                          <ArrowRight className="h-4 w-4 text-emerald-500 inline-block" />
                        </TableCell>

                        {/* Target Channel */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-white text-xs">
                              {binding.target_channel_title || "Canal Destino"}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {binding.target_channel_id}
                            </span>
                          </div>
                        </TableCell>

                        {/* Filters & Rules */}
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {allowVideo && (
                              <Badge variant="outline" className="gap-1 border-zinc-700/80 bg-zinc-950/40 text-cyan-400">
                                <FileVideo className="h-3 w-3 shrink-0" />
                                <span>Video</span>
                              </Badge>
                            )}
                            {allowPhoto && (
                              <Badge variant="outline" className="gap-1 border-zinc-700/80 bg-zinc-950/40 text-amber-400">
                                <Image className="h-3 w-3 shrink-0" />
                                <span>Foto</span>
                              </Badge>
                            )}
                            {allowDoc && (
                              <Badge variant="outline" className="gap-1 border-zinc-700/80 bg-zinc-950/40 text-purple-400">
                                <File className="h-3 w-3 shrink-0" />
                                <span>Doc</span>
                              </Badge>
                            )}
                            {stripLinks && (
                              <Badge variant="outline" className="border-emerald-500/30 bg-zinc-950/40 text-emerald-400">
                                <span>Anti-Spam</span>
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Last Synced Message ID */}
                        <TableCell>
                          <Badge variant="outline" className="border-zinc-800 bg-zinc-950/60 font-mono text-[11px] text-zinc-300">
                            <span>Msg #{binding.last_synced_message_id}</span>
                          </Badge>
                        </TableCell>

                        {/* Active Toggle */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={binding.is_active}
                              onCheckedChange={() => toggleActive(binding)}
                            />
                            <span
                              className={`text-[10px] font-semibold uppercase ${
                                binding.is_active ? "text-emerald-400" : "text-zinc-500"
                              }`}
                            >
                              {binding.is_active ? "ACTIVO" : "PAUSA"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Action Buttons */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRules(binding)}
                              className="h-8 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Configurar Reglas de Pipeline"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(binding)}
                              className="h-8 px-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                              title="Desvincular Canal"
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
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateSyncBindingModal />
      <SyncRulesModal />
    </div>
  );
};
