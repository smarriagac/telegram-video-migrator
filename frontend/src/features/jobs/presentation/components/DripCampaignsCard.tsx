import React, { useEffect, useState } from "react";
import {
  Droplets,
  Clock,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Send,
  Edit3,
  SkipForward,
  Plus,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  dripApi,
  DripCampaign,
  ReservoirItem,
  CreateCampaignPayload,
} from "../../infrastructure/dripApi";

interface CardState {
  campaigns: DripCampaign[];
  items: ReservoirItem[];
  totalItems: number;
  isLoading: boolean;
  isItemsLoading: boolean;
  isCreateModalOpen: boolean;
  editingItem: { id: string; caption: string } | null;
  feedback: { message: string; isError?: boolean } | null;
  createForm: {
    title: string;
    source_channel_id: string;
    target_channel_id: string;
    message_ids_str: string;
    interval_minutes: number;
    batch_size: number;
    jitter_seconds: number;
    daily_window_start: string;
    daily_window_end: string;
  };
}

export const DripCampaignsCard: React.FC = () => {
  // STRICT CONSTRAINT: At most 2 useState hooks
  // Hook 1: Selected campaign ID for items queue inspection
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Hook 2: Consolidated state for campaigns, items, modals, feedback, and form
  const [state, setState] = useState<CardState>({
    campaigns: [],
    items: [],
    totalItems: 0,
    isLoading: true,
    isItemsLoading: false,
    isCreateModalOpen: false,
    editingItem: null,
    feedback: null,
    createForm: {
      title: "",
      source_channel_id: "",
      target_channel_id: "",
      message_ids_str: "",
      interval_minutes: 60,
      batch_size: 1,
      jitter_seconds: 0,
      daily_window_start: "09:00",
      daily_window_end: "22:00",
    },
  });

  const loadCampaigns = async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const data = await dripApi.fetchCampaigns();
      setState((s) => ({
        ...s,
        campaigns: data,
        isLoading: false,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        feedback: { message: err.message || "Error al cargar campañas", isError: true },
      }));
    }
  };

  const loadItems = async (campaignId: string) => {
    setState((s) => ({ ...s, isItemsLoading: true }));
    try {
      const res = await dripApi.fetchCampaignItems(campaignId);
      setState((s) => ({
        ...s,
        items: res.items,
        totalItems: res.total,
        isItemsLoading: false,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isItemsLoading: false,
        feedback: { message: err.message || "Error al cargar elementos del reservorio", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadItems(selectedCampaignId);
    } else {
      setState((s) => ({ ...s, items: [], totalItems: 0 }));
    }
  }, [selectedCampaignId]);

  const handleTogglePause = async (campaign: DripCampaign) => {
    try {
      if (campaign.status === "ACTIVE") {
        await dripApi.pauseCampaign(campaign.id);
        setState((s) => ({
          ...s,
          feedback: { message: `Campaña '${campaign.title}' pausada` },
        }));
      } else {
        await dripApi.resumeCampaign(campaign.id);
        setState((s) => ({
          ...s,
          feedback: { message: `Campaña '${campaign.title}' reactivada` },
        }));
      }
      loadCampaigns();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        feedback: { message: err.message || "Error al cambiar estado de la campaña", isError: true },
      }));
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta campaña y sus elementos en reservorio?")) {
      return;
    }
    try {
      await dripApi.deleteCampaign(campaignId);
      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId(null);
      }
      setState((s) => ({
        ...s,
        feedback: { message: "Campaña eliminada exitosamente" },
      }));
      loadCampaigns();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        feedback: { message: err.message || "Error al eliminar campaña", isError: true },
      }));
    }
  };

  const handleReleaseNow = async (itemId: string) => {
    try {
      const res = await dripApi.releaseItemNow(itemId);
      setState((s) => ({
        ...s,
        feedback: { message: res.message || "Elemento liberado inmediatamente" },
      }));
      if (selectedCampaignId) loadItems(selectedCampaignId);
      loadCampaigns();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        feedback: { message: err.message || "Fallo al liberar elemento", isError: true },
      }));
    }
  };

  const handleSkipItem = async (itemId: string) => {
    try {
      await dripApi.skipItem(itemId);
      setState((s) => ({
        ...s,
        feedback: { message: "Elemento omitido del reservorio" },
      }));
      if (selectedCampaignId) loadItems(selectedCampaignId);
      loadCampaigns();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        feedback: { message: err.message || "Error al omitir elemento", isError: true },
      }));
    }
  };

  const handleSaveCaption = async () => {
    if (!state.editingItem) return;
    try {
      await dripApi.updateItemCaption(state.editingItem.id, state.editingItem.caption);
      setState((s) => ({
        ...s,
        editingItem: null,
        feedback: { message: "Caption actualizado exitosamente" },
      }));
      if (selectedCampaignId) loadItems(selectedCampaignId);
    } catch (err: any) {
      setState((s) => ({
        ...s,
        feedback: { message: err.message || "Error al actualizar caption", isError: true },
      }));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { createForm } = state;

    const sourceId = parseInt(createForm.source_channel_id.trim(), 10);
    const targetId = parseInt(createForm.target_channel_id.trim(), 10);

    if (isNaN(sourceId) || isNaN(targetId)) {
      setState((s) => ({
        ...s,
        feedback: { message: "Los IDs de los canales deben ser numéricos", isError: true },
      }));
      return;
    }

    const messageIds = createForm.message_ids_str
      .split(/[\s,]+/)
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id) && id > 0);

    if (messageIds.length === 0) {
      setState((s) => ({
        ...s,
        feedback: { message: "Debes ingresar al menos un ID de mensaje", isError: true },
      }));
      return;
    }

    const payload: CreateCampaignPayload = {
      title: createForm.title.trim() || `Campaña Drip ${sourceId} -> ${targetId}`,
      source_channel_id: sourceId,
      target_channel_id: targetId,
      source_message_ids: messageIds,
      interval_minutes: Number(createForm.interval_minutes) || 60,
      batch_size: Number(createForm.batch_size) || 1,
      jitter_seconds: Number(createForm.jitter_seconds) || 0,
      daily_window_start: createForm.daily_window_start || undefined,
      daily_window_end: createForm.daily_window_end || undefined,
    };

    try {
      const res = await dripApi.createCampaign(payload);
      setState((s) => ({
        ...s,
        isCreateModalOpen: false,
        feedback: { message: `Campaña '${res.campaign.title}' creada con ${messageIds.length} elementos` },
        createForm: {
          title: "",
          source_channel_id: "",
          target_channel_id: "",
          message_ids_str: "",
          interval_minutes: 60,
          batch_size: 1,
          jitter_seconds: 0,
          daily_window_start: "09:00",
          daily_window_end: "22:00",
        },
      }));
      loadCampaigns();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        feedback: { message: err.message || "Error al crear la campaña", isError: true },
      }));
    }
  };

  // KPIs
  const totalCampaigns = state.campaigns.length;
  const activeCampaigns = state.campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalStaged = state.campaigns.reduce((acc, c) => acc + (c.total_items - c.released_items), 0);
  const totalReleased = state.campaigns.reduce((acc, c) => acc + c.released_items, 0);

  const selectedCampaign = state.campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="space-y-4">
      {/* Banner de Explicación y Contexto */}
      <div className="p-3.5 rounded-lg border border-cyan-500/25 bg-cyan-950/20 flex items-start justify-between gap-3 text-xs shrink-0">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-300 mt-0.5">
            <Droplets className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <span className="font-semibold text-cyan-200">
              Content Reservoir & Campañas de Goteo Programado
            </span>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Encola cientos de videos y libéralos a un ritmo orgánico configurable (ej. 1 video cada 2 horas, ventana activa 09:00–22:00 y jitter antidetect). Protege la retención de tus suscriptores, evita saturaciones de notificaciones y resiste reinicios del servidor con persistencia en base de datos.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setState((s) => ({ ...s, isCreateModalOpen: true }))}
          className="h-8 bg-cyan-600 hover:bg-cyan-500 text-white shrink-0 text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nueva Campaña Drip
        </Button>
      </div>

      {/* Feedback Banner */}
      {state.feedback && (
        <div
          className={`p-3 rounded-lg flex items-center justify-between text-xs border ${
            state.feedback.isError
              ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
              : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {state.feedback.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{state.feedback.message}</span>
          </div>
          <button
            onClick={() => setState((s) => ({ ...s, feedback: null }))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Campañas Totales</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-foreground">{totalCampaigns}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Campañas Activas</span>
              <Play className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-emerald-400">{activeCampaigns}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>En Reservorio (Encolados)</span>
              <Droplets className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-amber-300">{Math.max(0, totalStaged)}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Publicados vía Drip</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xl font-semibold font-mono text-purple-300">{totalReleased}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card className="border-border bg-card shadow-sm">
        <div className="p-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-foreground">Campañas de Goteo Configuradas</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadCampaigns}
            disabled={state.isLoading}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${state.isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <div className="divide-y divide-border">
          {state.campaigns.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No hay campañas de goteo en curso. Hacé click en "Nueva Campaña Drip" para comenzar a dosificar publicaciones.
            </div>
          ) : (
            state.campaigns.map((camp) => {
              const progressPct =
                camp.total_items > 0 ? Math.round((camp.released_items / camp.total_items) * 100) : 0;
              const isSelected = selectedCampaignId === camp.id;

              return (
                <div
                  key={camp.id}
                  className={`p-3.5 transition-colors ${
                    isSelected ? "bg-cyan-950/20" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-foreground">{camp.title}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            camp.status === "ACTIVE"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : camp.status === "PAUSED"
                              ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                              : camp.status === "COMPLETED"
                              ? "border-purple-500/40 text-purple-400 bg-purple-500/10"
                              : "border-zinc-500/40 text-zinc-400"
                          }`}
                        >
                          {camp.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {camp.source_channel_id} → {camp.target_channel_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span>Intervalo: <strong>{camp.interval_minutes}m</strong></span>
                        <span>Lote: <strong>{camp.batch_size}</strong></span>
                        {camp.daily_window_start && camp.daily_window_end && (
                          <span>Ventana: <strong>{camp.daily_window_start}–{camp.daily_window_end}</strong></span>
                        )}
                        {camp.next_release_at && camp.status === "ACTIVE" && (
                          <span className="text-cyan-300 font-mono">
                            Próximo: {new Date(camp.next_release_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-32 space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                          <span>{camp.released_items}/{camp.total_items}</span>
                          <span>{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-1.5 bg-zinc-800" />
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePause(camp)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title={camp.status === "ACTIVE" ? "Pausar goteo" : "Reanudar goteo"}
                        >
                          {camp.status === "ACTIVE" ? (
                            <Pause className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </Button>

                        <Button
                          variant={isSelected ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCampaignId(isSelected ? null : camp.id)}
                          className="h-7 px-2 text-xs"
                          title="Inspeccionar cola de items"
                        >
                          <Layers className="w-3.5 h-3.5 mr-1" />
                          Cola ({camp.total_items - camp.released_items})
                          <ChevronRight
                            className={`w-3.5 h-3.5 ml-1 transition-transform ${
                              isSelected ? "rotate-90" : ""
                            }`}
                          />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                          title="Eliminar campaña"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Selected Campaign Reservoir Items Queue */}
      {selectedCampaign && (
        <Card className="border-border bg-card shadow-sm border-t-2 border-t-cyan-500">
          <div className="p-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold text-foreground">
                Cola en Reservorio: {selectedCampaign.title}
              </h3>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {state.totalItems} elementos
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadItems(selectedCampaign.id)}
              disabled={state.isItemsLoading}
              className="h-7 text-xs text-muted-foreground"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${state.isItemsLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          <div className="overflow-x-auto">
            {state.isItemsLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                Cargando cola del reservorio...
              </div>
            ) : state.items.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No hay elementos en cola para esta campaña.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12 text-[11px]">#</TableHead>
                    <TableHead className="text-[11px]">Msg ID</TableHead>
                    <TableHead className="text-[11px]">Programado Para</TableHead>
                    <TableHead className="text-[11px]">Caption</TableHead>
                    <TableHead className="text-[11px]">Estado</TableHead>
                    <TableHead className="text-right text-[11px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.items.map((item) => (
                    <TableRow key={item.id} className="border-border text-xs">
                      <TableCell className="font-mono text-muted-foreground text-[11px]">
                        {item.position}
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        #{item.source_message_id}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">
                        {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-[11px]">
                        {item.transformed_caption || item.original_caption || (
                          <span className="italic text-muted-foreground">Sin caption</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            item.status === "RELEASED"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : item.status === "QUEUED"
                              ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                              : item.status === "SKIPPED"
                              ? "border-zinc-500/40 text-zinc-400"
                              : "border-rose-500/40 text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.status === "QUEUED" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReleaseNow(item.id)}
                                className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                title="Liberar ya (adelantar envío)"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Liberar Ya
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setState((s) => ({
                                    ...s,
                                    editingItem: {
                                      id: item.id,
                                      caption: item.transformed_caption || item.original_caption,
                                    },
                                  }))
                                }
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Editar caption"
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSkipItem(item.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-zinc-300"
                                title="Omitir elemento"
                              >
                                <SkipForward className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      )}

      {/* Modal Nueva Campaña Drip */}
      {state.isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm">Nueva Campaña Drip</h3>
              </div>
              <button
                onClick={() => setState((s) => ({ ...s, isCreateModalOpen: false }))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Título de la Campaña</label>
                <input
                  type="text"
                  placeholder="ej. Lanzamiento escalonado Noviembre"
                  value={state.createForm.title}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      createForm: { ...s.createForm, title: e.target.value },
                    }))
                  }
                  className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">ID Canal Origen *</label>
                  <input
                    type="text"
                    required
                    placeholder="-100..."
                    value={state.createForm.source_channel_id}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, source_channel_id: e.target.value },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">ID Canal Destino *</label>
                  <input
                    type="text"
                    required
                    placeholder="-100..."
                    value={state.createForm.target_channel_id}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, target_channel_id: e.target.value },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">
                  IDs de Mensajes a Encolar (separados por coma o espacio) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="101, 102, 103, 104..."
                  value={state.createForm.message_ids_str}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      createForm: { ...s.createForm, message_ids_str: e.target.value },
                    }))
                  }
                  className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Intervalo (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={state.createForm.interval_minutes}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, interval_minutes: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Lote (videos)</label>
                  <input
                    type="number"
                    min={1}
                    value={state.createForm.batch_size}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, batch_size: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Jitter (seg)</label>
                  <input
                    type="number"
                    min={0}
                    value={state.createForm.jitter_seconds}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, jitter_seconds: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Ventana Inicio (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="09:00"
                    value={state.createForm.daily_window_start}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, daily_window_start: e.target.value },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Ventana Fin (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="22:00"
                    value={state.createForm.daily_window_end}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        createForm: { ...s.createForm, daily_window_end: e.target.value },
                      }))
                    }
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setState((s) => ({ ...s, isCreateModalOpen: false }))}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
                >
                  Crear y Encolar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Caption de Item */}
      {state.editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-lg max-w-sm w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="font-semibold text-xs">Editar Caption del Elemento</h4>
              <button
                onClick={() => setState((s) => ({ ...s, editingItem: null }))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              rows={4}
              value={state.editingItem.caption}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  editingItem: s.editingItem ? { ...s.editingItem, caption: e.target.value } : null,
                }))
              }
              className="w-full bg-secondary border border-border rounded p-2 text-foreground text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState((s) => ({ ...s, editingItem: null }))}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCaption}
                className="h-7 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
