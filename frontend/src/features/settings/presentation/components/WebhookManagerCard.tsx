import React, { useEffect, useState } from "react";
import {
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Radio,
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
  // Hook 1: List collection, loading state, test in progress, and user feedback
  const [listState, setListState] = useState<{
    webhooks: WebhookEndpoint[];
    isLoading: boolean;
    testingId: string | null;
    feedback: { message: string; isError?: boolean } | null;
  }>({
    webhooks: [],
    isLoading: true,
    testingId: null,
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

  const loadWebhooks = async () => {
    try {
      const data = await webhooksApi.listWebhooks();
      setListState((prev) => ({ ...prev, webhooks: data, isLoading: false }));
    } catch (err: any) {
      setListState((prev) => ({
        ...prev,
        isLoading: false,
        feedback: { message: err.message || "Error al cargar webhooks", isError: true },
      }));
    }
  };

  useEffect(() => {
    loadWebhooks();
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
      showFeedback("El nombre y la URL del webhook son obligatorios", true);
      return;
    }

    setFormState((prev) => ({ ...prev, isSaving: true }));
    try {
      const created = await webhooksApi.createWebhook({
        name: formState.name.trim(),
        target_type: formState.targetType,
        url: formState.url.trim(),
        secret_token: formState.secretToken.trim() || null,
        events: formState.events.length > 0 ? formState.events : ["*"],
        is_enabled: true,
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
      showFeedback("Webhook registrado exitosamente");
    } catch (err: any) {
      setFormState((prev) => ({ ...prev, isSaving: false }));
      showFeedback(err.message || "Error al registrar webhook", true);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await webhooksApi.deleteWebhook(id);
      setListState((prev) => ({
        ...prev,
        webhooks: prev.webhooks.filter((w) => w.id !== id),
      }));
      showFeedback("Webhook eliminado");
    } catch (err: any) {
      showFeedback(err.message || "Error al eliminar webhook", true);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setListState((prev) => ({ ...prev, testingId: id }));
    try {
      const res = await webhooksApi.testWebhook(id);
      if (res.success) {
        showFeedback(`Prueba exitosa (HTTP ${res.status_code || 200})`);
      } else {
        showFeedback(`Fallo en entrega: ${res.error || "Código de error inesperado"}`, true);
      }
      if (res.endpoint) {
        setListState((prev) => ({
          ...prev,
          webhooks: prev.webhooks.map((w) => (w.id === id ? res.endpoint! : w)),
        }));
      }
    } catch (err: any) {
      showFeedback(err.message || "Error al ejecutar prueba de webhook", true);
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
    } catch (err: any) {
      showFeedback(err.message || "Error al actualizar estado", true);
    }
  };

  const getTargetBadge = (type: WebhookTargetType) => {
    switch (type) {
      case "DISCORD":
        return (
          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-[10px] font-mono">
            Discord
          </Badge>
        );
      case "SLACK":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
            Slack
          </Badge>
        );
      case "TELEGRAM_BOT":
        return (
          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] font-mono">
            Telegram Bot
          </Badge>
        );
      default:
        return (
          <Badge className="bg-secondary text-foreground border-border text-[10px] font-mono">
            HTTP Genérico
          </Badge>
        );
    }
  };

  return (
    <div className="bg-card border border-border rounded-md p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground font-mono">
              Webhooks Multicanal (Discord, Slack, HTTP)
            </h3>
            <p className="text-xs text-muted-foreground">
              Despacho en tiempo real con reintentos y firma HMAC para eventos del sistema.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setFormState((prev) => ({ ...prev, isOpen: !prev.isOpen }))}
          className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{formState.isOpen ? "Cerrar Formulario" : "Nuevo Webhook"}</span>
        </Button>
      </div>

      {/* Feedback Alert */}
      {listState.feedback && (
        <div
          className={cn(
            "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
            listState.feedback.isError
              ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
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

      {/* Add Webhook Form Accordion */}
      {formState.isOpen && (
        <form onSubmit={handleCreateWebhook} className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3.5">
          <div className="text-xs font-semibold text-foreground font-mono flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-primary" />
            <span>Configurar Nuevo Destino de Notificación</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="text-[11px] font-medium text-foreground block mb-1">Nombre Descriptivo</label>
              <Input
                placeholder="Ej: Canal Discord de Alertas Ops"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="h-8 text-xs font-sans bg-background"
                required
              />
            </div>
            <div className="sm:col-span-6">
              <label className="text-[11px] font-medium text-foreground block mb-1">Plataforma Destino</label>
              <Select
                value={formState.targetType}
                onValueChange={(val: any) => setFormState((prev) => ({ ...prev, targetType: val }))}
              >
                <SelectTrigger className="h-8 text-xs font-sans bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="DISCORD">Discord (Embed enriquecido con colores)</SelectItem>
                  <SelectItem value="SLACK">Slack (Incoming Webhook attachments)</SelectItem>
                  <SelectItem value="TELEGRAM_BOT">Telegram Bot API</SelectItem>
                  <SelectItem value="GENERIC">HTTP Genérico (JSON Payload + HMAC)</SelectItem>
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
    </div>
  );
};
