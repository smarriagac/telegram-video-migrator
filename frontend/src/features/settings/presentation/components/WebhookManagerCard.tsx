import React, { useEffect, useState } from "react";
import {
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Radio,
  RotateCcw,
  RefreshCw,
  Zap,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  webhooksApi,
  WebhookEndpoint,
  WebhookTargetType,
  WebhookDelivery,
  WebhookDeliveriesSummary,
} from "../../infrastructure/webhooksApi";
import { cn } from "@/shared/lib/utils";

const AVAILABLE_EVENTS = [
  { id: "flood_wait", label: "FloodWait Rate Limit", desc: "Alertas de espera impuestas por Telegram" },
  { id: "job.failed", label: "Fallo de Migración / Difusión", desc: "Errores fatales en trabajos o posts" },
  { id: "backup.created", label: "Backups & Snapshots", desc: "Respaldos generados automáticamente" },
  { id: "channel.eviction", label: "Expulsión de Canal", desc: "Pérdida de acceso o baneo en canal fuente" },
];

export const WebhookManagerCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Master state for endpoints, deliveries, DLQ summary, loading and action indicators
  const [listState, setListState] = useState<{
    activeTab: "endpoints" | "dlq";
    webhooks: WebhookEndpoint[];
    deliveries: WebhookDelivery[];
    summary: WebhookDeliveriesSummary;
    deliveryStatusFilter: string;
    isLoading: boolean;
    testingId: string | null;
    retryingDeliveryId: string | null;
    isBatchRetrying: boolean;
    feedback: { message: string; isError?: boolean } | null;
  }>({
    activeTab: "endpoints",
    webhooks: [],
    deliveries: [],
    summary: { total: 0, dlq: 0, pending: 0, delivered: 0, failed: 0 },
    deliveryStatusFilter: "ALL",
    isLoading: true,
    testingId: null,
    retryingDeliveryId: null,
    isBatchRetrying: false,
    feedback: null,
  });

  // Hook 2: Creation / Edit form state
  const [formState, setFormState] = useState<{
    isOpen: boolean;
    isSaving: boolean;
    name: string;
    targetType: WebhookTargetType;
    url: string;
    secretToken: string;
    events: string[];
  }>({
    isOpen: false,
    isSaving: false,
    name: "",
    targetType: "DISCORD",
    url: "",
    secretToken: "",
    events: ["flood_wait", "job.failed", "backup.created", "channel.eviction"],
  });

  const loadData = async (filterStatus?: string) => {
    try {
      const activeFilter = filterStatus !== undefined ? filterStatus : listState.deliveryStatusFilter;
      const [webhooksData, summaryData, deliveriesData] = await Promise.all([
        webhooksApi.listWebhooks(),
        webhooksApi.fetchDeliveriesSummary().catch(() => ({ total: 0, dlq: 0, pending: 0, delivered: 0, failed: 0 })),
        webhooksApi.listDeliveries({
          status: activeFilter === "ALL" ? undefined : activeFilter,
          limit: 50,
        }).catch(() => ({ items: [], total: 0, limit: 50, offset: 0 })),
      ]);

      setListState((prev) => ({
        ...prev,
        webhooks: webhooksData,
        summary: summaryData,
        deliveries: deliveriesData.items,
        isLoading: false,
      }));
    } catch (err: any) {
      setListState((prev) => ({
        ...prev,
        isLoading: false,
        feedback: { message: err.message || "Error al cargar datos de webhooks", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (message: string, isError = false) => {
    setListState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setListState((prev) => ({ ...prev, feedback: null }));
    }, 4000);
  };

  const handleToggleEvent = (eventId: string) => {
    setFormState((prev) => {
      const exists = prev.events.includes(eventId);
      const newEvents = exists
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId];
      return { ...prev, events: newEvents };
    });
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.url.trim()) {
      showFeedback("Nombre y URL son campos obligatorios", true);
      return;
    }
    setFormState((prev) => ({ ...prev, isSaving: true }));
    try {
      const created = await webhooksApi.createWebhook({
        name: formState.name.trim(),
        target_type: formState.targetType,
        url: formState.url.trim(),
        secret_token: formState.secretToken.trim() || null,
        events: formState.events,
      });

      setListState((prev) => ({
        ...prev,
        webhooks: [created, ...prev.webhooks],
      }));
      setFormState({
        isOpen: false,
        isSaving: false,
        name: "",
        targetType: "DISCORD",
        url: "",
        secretToken: "",
        events: ["flood_wait", "job.failed", "backup.created", "channel.eviction"],
      });
      showFeedback(`Webhook "${created.name}" registrado correctamente.`);
    } catch (err: any) {
      setFormState((prev) => ({ ...prev, isSaving: false }));
      showFeedback(err.message || "Error al guardar webhook", true);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setListState((prev) => ({ ...prev, testingId: id }));
    try {
      const res = await webhooksApi.testWebhook(id);
      if (res.success) {
        showFeedback(`Prueba exitosa (HTTP ${res.status_code || 200})`);
      } else {
        showFeedback(`Prueba fallida: ${res.error || "Código HTTP no 2xx"}`, true);
      }
      loadData();
    } catch (err: any) {
      showFeedback(err.message || "Error al probar webhook", true);
    } finally {
      setListState((prev) => ({ ...prev, testingId: null }));
    }
  };

  const handleToggleEnabled = async (wh: WebhookEndpoint) => {
    try {
      const updated = await webhooksApi.updateWebhook(wh.id, {
        is_enabled: !wh.is_enabled,
      });
      setListState((prev) => ({
        ...prev,
        webhooks: prev.webhooks.map((w) => (w.id === wh.id ? updated : w)),
      }));
      showFeedback(`Webhook ${updated.is_enabled ? "reanudado" : "pausado"}`);
    } catch (err: any) {
      showFeedback(err.message || "Error al cambiar estado", true);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este webhook de notificaciones?")) {
      return;
    }
    try {
      await webhooksApi.deleteWebhook(id);
      setListState((prev) => ({
        ...prev,
        webhooks: prev.webhooks.filter((w) => w.id !== id),
      }));
      showFeedback("Webhook eliminado correctamente");
    } catch (err: any) {
      showFeedback(err.message || "Error al eliminar webhook", true);
    }
  };

  // DLQ Actions
  const handleRetryDelivery = async (deliveryId: string) => {
    setListState((prev) => ({ ...prev, retryingDeliveryId: deliveryId }));
    try {
      const res = await webhooksApi.retryDelivery(deliveryId);
      if (res.success) {
        showFeedback(`Entrega reintentada con éxito (HTTP ${res.status_code || 200})`);
      } else {
        showFeedback(`Fallo en reintento: ${res.error || "No respondió"}`, true);
      }
      loadData();
    } catch (err: any) {
      showFeedback(err.message || "Error al reintentar entrega", true);
    } finally {
      setListState((prev) => ({ ...prev, retryingDeliveryId: null }));
    }
  };

  const handleRetryAllDLQ = async () => {
    setListState((prev) => ({ ...prev, isBatchRetrying: true }));
    try {
      const res = await webhooksApi.retryAllDLQ();
      showFeedback(`Reintento masivo completado: ${res.succeeded} exitosos, ${res.failed} fallidos.`);
      loadData();
    } catch (err: any) {
      showFeedback(err.message || "Error al ejecutar reintento masivo en DLQ", true);
    } finally {
      setListState((prev) => ({ ...prev, isBatchRetrying: false }));
    }
  };

  const handleDismissDelivery = async (deliveryId: string) => {
    try {
      await webhooksApi.dismissDelivery(deliveryId);
      setListState((prev) => ({
        ...prev,
        deliveries: prev.deliveries.filter((d) => d.id !== deliveryId),
        summary: {
          ...prev.summary,
          total: Math.max(0, prev.summary.total - 1),
          dlq: Math.max(0, prev.summary.dlq - 1),
        },
      }));
      showFeedback("Entrega descartada de la cola");
    } catch (err: any) {
      showFeedback(err.message || "Error al descartar entrega", true);
    }
  };

  const getTargetBadge = (target: WebhookTargetType) => {
    switch (target) {
      case "DISCORD":
        return <Badge className="bg-[#5865F2]/15 text-[#5865F2] border-[#5865F2]/30 text-[10px]">Discord</Badge>;
      case "SLACK":
        return <Badge className="bg-[#4A154B]/15 text-[#E01E5A] border-[#4A154B]/30 text-[10px]">Slack</Badge>;
      case "TELEGRAM_BOT":
        return <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px]">Telegram Bot</Badge>;
      default:
        return <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Generic HTTP</Badge>;
    }
  };

  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Entregado</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Reintentando</Badge>;
      case "DLQ":
        return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px]">DLQ Caído</Badge>;
      default:
        return <Badge className="bg-secondary text-muted-foreground border-border text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {listState.feedback && (
        <div
          className={cn(
            "p-3 rounded-lg border text-xs flex items-center gap-2 transition-all font-mono",
            listState.feedback.isError
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          )}
        >
          {listState.feedback.isError ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{listState.feedback.message}</span>
        </div>
      )}

      {/* Header and Mode Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant={listState.activeTab === "endpoints" ? "default" : "outline"}
            size="sm"
            onClick={() => setListState((prev) => ({ ...prev, activeTab: "endpoints" }))}
            className="text-xs h-8"
          >
            <span>Destinos Configurados</span>
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground">
              {listState.webhooks.length}
            </span>
          </Button>

          <Button
            variant={listState.activeTab === "dlq" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setListState((prev) => ({ ...prev, activeTab: "dlq" }));
              loadData();
            }}
            className={cn(
              "text-xs h-8 flex items-center gap-1",
              listState.summary.dlq > 0 && listState.activeTab !== "dlq" && "border-rose-500/50 text-rose-400"
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Dead-Letter Queue</span>
            {listState.summary.dlq > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                {listState.summary.dlq}
              </span>
            )}
          </Button>
        </div>

        {listState.activeTab === "endpoints" && (
          <Button
            size="sm"
            onClick={() => setFormState((prev) => ({ ...prev, isOpen: !prev.isOpen }))}
            className="text-xs h-8 flex items-center gap-1 bg-primary text-primary-foreground shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Webhook</span>
          </Button>
        )}

        {listState.activeTab === "dlq" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadData()}
              className="text-xs h-8 px-2.5"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              disabled={listState.summary.dlq === 0 || listState.isBatchRetrying}
              onClick={handleRetryAllDLQ}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
            >
              <Zap className={cn("w-3.5 h-3.5", listState.isBatchRetrying && "animate-spin")} />
              <span>{listState.isBatchRetrying ? "Reintentando..." : `Reintentar Todo DLQ (${listState.summary.dlq})`}</span>
            </Button>
          </div>
        )}
      </div>

      {/* --- TAB 1: DESTINOS CONFIGURADOS --- */}
      {listState.activeTab === "endpoints" && (
        <>
          {/* New Webhook Form Drawer */}
          {formState.isOpen && (
            <form
              onSubmit={handleCreateWebhook}
              className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3.5 transition-all"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-semibold text-foreground font-mono">
                  Configurar Nuevo Destino de Notificación
                </span>
                <button
                  type="button"
                  onClick={() => setFormState((prev) => ({ ...prev, isOpen: false }))}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">Nombre Descriptivo</label>
                  <Input
                    type="text"
                    placeholder="Ej: Canal Discord Incidentes"
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">Plataforma Destino</label>
                  <Select
                    value={formState.targetType}
                    onValueChange={(val: WebhookTargetType) => setFormState((prev) => ({ ...prev, targetType: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Seleccionar plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISCORD">Discord (Embeds nativos con color)</SelectItem>
                      <SelectItem value="SLACK">Slack (Attachments y bloques)</SelectItem>
                      <SelectItem value="TELEGRAM_BOT">Telegram Bot API</SelectItem>
                      <SelectItem value="GENERIC">Generic HTTP (JSON con firma HMAC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">URL del Webhook</label>
                <Input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/... o https://hooks.slack.com/services/..."
                  value={formState.url}
                  onChange={(e) => setFormState((prev) => ({ ...prev, url: e.target.value }))}
                  className="h-8 text-xs font-mono bg-background"
                  required
                />
              </div>

              {formState.targetType === "GENERIC" && (
                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Token Secreto HMAC (Opcional - Se enviará firma en header X-TelegramHub-Signature)
                  </label>
                  <Input
                    type="password"
                    placeholder="secreto_seguro_para_validar_firma"
                    value={formState.secretToken}
                    onChange={(e) => setFormState((prev) => ({ ...prev, secretToken: e.target.value }))}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-foreground block">
                  Eventos a los que suscribirse:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map((ev) => {
                    const checked = formState.events.includes(ev.id);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => handleToggleEvent(ev.id)}
                        className={cn(
                          "p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors",
                          checked
                            ? "bg-primary/10 border-primary/40 text-foreground"
                            : "bg-background border-border text-muted-foreground hover:bg-secondary/40"
                        )}
                      >
                        <div>
                          <div className="font-semibold text-[11px]">{ev.label}</div>
                          <div className="text-[10px] text-muted-foreground">{ev.desc}</div>
                        </div>
                        <Switch
                          checked={checked}
                          onCheckedChange={() => handleToggleEvent(ev.id)}
                          className="shrink-0 pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormState((prev) => ({ ...prev, isOpen: false }))}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={formState.isSaving}
                  className="h-8 text-xs bg-primary text-primary-foreground"
                >
                  {formState.isSaving ? "Guardando..." : "Guardar Webhook"}
                </Button>
              </div>
            </form>
          )}

          {/* Webhooks List */}
          <div className="space-y-2.5">
            {listState.isLoading ? (
              <div className="p-6 text-center text-xs text-muted-foreground font-mono">
                Cargando destinos configurados...
              </div>
            ) : listState.webhooks.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border text-xs text-muted-foreground space-y-2">
                <Radio className="w-6 h-6 mx-auto text-muted-foreground/60" />
                <p>No hay webhooks externos registrados.</p>
                <p className="text-[11px]">
                  Agregá un canal de Discord, Slack o endpoint HTTP para recibir alertas instantáneas sin depender solo de MTProto.
                </p>
              </div>
            ) : (
              listState.webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="p-3.5 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-foreground font-mono truncate max-w-[220px]">
                        {wh.name}
                      </span>
                      {getTargetBadge(wh.target_type)}
                      <span
                        className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                          wh.is_enabled
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-secondary border-border text-muted-foreground"
                        )}
                      >
                        {wh.is_enabled ? "Activo" : "Pausado"}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground truncate max-w-md sm:max-w-xl">
                      {wh.url}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Eventos:</span>
                      {wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-secondary/80 border border-border text-foreground"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status and Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {wh.last_status_code && (
                      <div
                        className={cn(
                          "text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1",
                          wh.last_status_code >= 200 && wh.last_status_code < 300
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        )}
                      >
                        <span>HTTP {wh.last_status_code}</span>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={listState.testingId === wh.id}
                      onClick={() => handleTestWebhook(wh.id)}
                      className="h-7 text-xs flex items-center gap-1 font-mono"
                    >
                      <Send className={cn("w-3 h-3", listState.testingId === wh.id && "animate-spin")} />
                      <span>{listState.testingId === wh.id ? "Enviando..." : "Probar"}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleEnabled(wh)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {wh.is_enabled ? "Pausar" : "Reanudar"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="h-7 w-7 p-0 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* --- TAB 2: DEAD-LETTER QUEUE & ENTREGAS --- */}
      {listState.activeTab === "dlq" && (
        <div className="space-y-4">
          {/* Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg border border-border bg-secondary/10 flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono uppercase">En Cola DLQ</span>
              <span className="text-xl font-bold font-mono text-rose-400">{listState.summary.dlq}</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-secondary/10 flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Reintentos Pendientes</span>
              <span className="text-xl font-bold font-mono text-amber-400">{listState.summary.pending}</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-secondary/10 flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Entregados Exitosos</span>
              <span className="text-xl font-bold font-mono text-emerald-400">{listState.summary.delivered}</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-secondary/10 flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Total Histórico</span>
              <span className="text-xl font-bold font-mono text-foreground">{listState.summary.total}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrar estado:</span>
            <select
              value={listState.deliveryStatusFilter}
              onChange={(e) => {
                const newFilter = e.target.value;
                setListState((prev) => ({ ...prev, deliveryStatusFilter: newFilter }));
                loadData(newFilter);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none"
            >
              <option value="ALL">Todas las Entregas</option>
              <option value="DLQ">Solo DLQ (Agotados)</option>
              <option value="PENDING">Solo Pendientes / En Reintento</option>
              <option value="DELIVERED">Solo Entregados</option>
            </select>
          </div>

          {/* Deliveries Ledger */}
          <div className="space-y-2">
            {listState.deliveries.length === 0 ? (
              <div className="p-8 text-center rounded-lg border border-dashed border-border text-xs text-muted-foreground space-y-2">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400/60" />
                <p>No hay entregas pendientes ni fallos en la cola de reintentos.</p>
                <p className="text-[11px]">
                  Todos los webhooks operaron con éxito o el registro está limpio.
                </p>
              </div>
            ) : (
              listState.deliveries.map((deliv) => (
                <div
                  key={deliv.id}
                  className="p-3 rounded-lg border border-border bg-secondary/15 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-foreground">{deliv.event_type}</span>
                      {getDeliveryStatusBadge(deliv.status)}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Intentos: {deliv.attempts}/{deliv.max_attempts}
                      </span>
                      {deliv.last_status_code && (
                        <span className="text-[10px] font-mono text-rose-400">
                          HTTP {deliv.last_status_code}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground truncate max-w-lg">
                      {deliv.url}
                    </div>

                    {deliv.last_error && (
                      <div className="text-[10px] font-mono text-rose-300 truncate max-w-lg">
                        Error: {deliv.last_error}
                      </div>
                    )}

                    {deliv.next_retry_at && (
                      <div className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Próximo reintento: {new Date(deliv.next_retry_at).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={listState.retryingDeliveryId === deliv.id}
                      onClick={() => handleRetryDelivery(deliv.id)}
                      className="h-7 text-xs flex items-center gap-1 font-mono"
                    >
                      <RotateCcw className={cn("w-3 h-3", listState.retryingDeliveryId === deliv.id && "animate-spin")} />
                      <span>{listState.retryingDeliveryId === deliv.id ? "Reintentando..." : "Reintentar"}</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismissDelivery(deliv.id)}
                      className="h-7 text-xs text-muted-foreground hover:text-rose-400"
                    >
                      Descartar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
