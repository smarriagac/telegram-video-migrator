import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tv,
  Search,
  CheckCircle2,
  ShieldCheck,
  Clock,
  RefreshCw,
  Plus,
  Key,
  MessageSquare,
  ArrowRightLeft,
  UserX,
  Copy,
  Check,
  AlertCircle,
  UserCheck,
  Inbox,
  XCircle,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  channelApi,
  ManagedChannel,
  VipMembership,
  JoinRequest,
} from "../infrastructure/channelApi";

interface ActionModalState {
  type: "EVICT_EXPIRED" | "KICK_MEMBER" | "REJECT_REQUEST" | null;
  title: string;
  description: string;
  member?: VipMembership;
  request?: JoinRequest;
  reason?: string;
}

interface NotificationState {
  message: string;
  type: "success" | "error";
}

interface ViewState {
  channels: ManagedChannel[];
  members: VipMembership[];
  requests: JoinRequest[];
  requestDurations: Record<number, number>;
  loading: boolean;
  searchQuery: string;
  modalOpen: boolean;
  modalChannelId: number;
  modalDays: number;
  modalUsername: string;
  modalAutoSendDm: boolean;
  lastDmSent: boolean | null;
  lastDmError: string | null;
  generatedLink: string | null;
  copied: boolean;
  isSubmitting: boolean;
  actionModal: ActionModalState | null;
  notification: NotificationState | null;
}

export const ChannelManagementView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 2 useState hooks
  // Default to "ADMIN" so the user immediately sees only their owned channels
  const [filterCategory, setFilterCategory] = useState<string>("ADMIN");
  const [state, setState] = useState<ViewState>({
    channels: [],
    members: [],
    requests: [],
    requestDurations: {},
    loading: true,
    searchQuery: "",
    modalOpen: false,
    modalChannelId: 0,
    modalDays: 30,
    modalUsername: "",
    modalAutoSendDm: true,
    lastDmSent: null,
    lastDmError: null,
    generatedLink: null,
    copied: false,
    isSubmitting: false,
    actionModal: null,
    notification: null,
  });

  const navigate = useNavigate();

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setState((s) => ({ ...s, notification: { message, type } }));
    setTimeout(() => {
      setState((s) => (s.notification?.message === message ? { ...s, notification: null } : s));
    }, 5000);
  };

  const loadData = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [channelsRes, membersRes, requestsRes] = await Promise.allSettled([
        channelApi.listManagedChannels(),
        channelApi.listVipMembers(),
        channelApi.listJoinRequests(),
      ]);

      const channelsData = channelsRes.status === "fulfilled" ? channelsRes.value : [];
      const membersData = membersRes.status === "fulfilled" ? membersRes.value : [];
      const requestsData = requestsRes.status === "fulfilled" ? requestsRes.value : [];

      const adminChannels = channelsData.filter((c) => c.can_post);

      setState((s) => ({
        ...s,
        channels: channelsData,
        members: membersData,
        requests: requestsData,
        modalChannelId: adminChannels[0]?.id || channelsData[0]?.id || 0,
        loading: false,
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
      }));
      showNotification("Error al sincronizar datos del servidor.", "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVipPass = async () => {
    if (!state.modalChannelId) return;
    setState((s) => ({ ...s, isSubmitting: true }));
    try {
      const pass = await channelApi.createVipInvite(
        state.modalChannelId,
        state.modalDays,
        state.modalUsername,
        state.modalAutoSendDm
      );
      setState((s) => ({
        ...s,
        generatedLink: pass.invite_link || null,
        lastDmSent: pass.dm_sent ?? false,
        lastDmError: pass.dm_error ?? null,
        members: [pass, ...s.members],
        isSubmitting: false,
      }));
      showNotification("¡Pase de acceso VIP generado con éxito!");
    } catch (err: any) {
      setState((s) => ({ ...s, isSubmitting: false }));
      showNotification(err.message || "Error al crear enlace VIP.", "error");
    }
  };

  const handleApproveRequest = async (req: JoinRequest, durationDays: number = 30) => {
    setState((s) => ({ ...s, isSubmitting: true }));
    try {
      await channelApi.approveJoinRequest(
        req.channel_id,
        req.user_id,
        durationDays,
        req.username || undefined
      );
      showNotification(
        `¡Solicitud aprobada! ${req.first_name} ingresó al canal. Período: ${durationDays} días.`
      );
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Error al aprobar la solicitud de ingreso.", "error");
    } finally {
      setState((s) => ({ ...s, isSubmitting: false }));
    }
  };

  const openRejectRequestModal = (req: JoinRequest) => {
    setState((s) => ({
      ...s,
      actionModal: {
        type: "REJECT_REQUEST",
        title: "Rechazar Solicitud de Ingreso",
        description: `¿Estás seguro de que deseas rechazar la solicitud de ingreso de ${req.first_name} (@${
          req.username || req.user_id
        })?`,
        request: req,
      },
    }));
  };

  const openKickMemberModal = (member: VipMembership) => {
    if (!member.telegram_user_id) {
      showNotification("El miembro aún no cuenta con Telegram UID activo.", "error");
      return;
    }
    const userLabel = member.telegram_username
      ? `@${member.telegram_username}`
      : `UID ${member.telegram_user_id}`;
    const channel = state.channels.find((c) => c.id === member.channel_id);

    setState((s) => ({
      ...s,
      actionModal: {
        type: "KICK_MEMBER",
        title: `Expulsar Miembro: ${userLabel}`,
        description: `Esta acción expulsará inmediatamente a ${userLabel} del canal ${
          channel?.title || "seleccionado"
        } en Telegram.`,
        member: member,
        reason: "Incumplimiento de normas de la comunidad",
      },
    }));
  };

  const openEvictExpiredModal = () => {
    setState((s) => ({
      ...s,
      actionModal: {
        type: "EVICT_EXPIRED",
        title: "Confirmar Desalojo de Vencidos (Auto-Kick)",
        description:
          "¿Deseas ejecutar el desalojo inmediato de todos los miembros VIP cuya membresía haya expirado? Serán removidos en tiempo real vía MTProto.",
      },
    }));
  };

  const handleConfirmActionModal = async () => {
    if (!state.actionModal) return;
    const { type, member, request, reason } = state.actionModal;
    setState((s) => ({ ...s, isSubmitting: true }));

    try {
      if (type === "EVICT_EXPIRED") {
        const res = await channelApi.evictExpiredMembers();
        setState((s) => ({ ...s, actionModal: null, isSubmitting: false }));
        showNotification(`Desalojo completado. Miembros expulsados: ${res.evicted_count}`);
        await loadData();
      } else if (type === "KICK_MEMBER" && member && member.telegram_user_id) {
        await channelApi.kickMember(
          member.channel_id,
          member.telegram_user_id,
          member.id,
          reason || "Incumplimiento de normas de la comunidad"
        );
        const userLabel = member.telegram_username
          ? `@${member.telegram_username}`
          : `UID ${member.telegram_user_id}`;
        setState((s) => ({ ...s, actionModal: null, isSubmitting: false }));
        showNotification(`Miembro ${userLabel} expulsado exitosamente del canal.`);
        await loadData();
      } else if (type === "REJECT_REQUEST" && request) {
        await channelApi.rejectJoinRequest(request.channel_id, request.user_id);
        setState((s) => ({ ...s, actionModal: null, isSubmitting: false }));
        showNotification("Solicitud de ingreso rechazada.");
        await loadData();
      }
    } catch (err: any) {
      setState((s) => ({ ...s, isSubmitting: false }));
      showNotification(err.message || "Error al procesar la acción.", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setState((s) => ({ ...s, copied: true }));
    setTimeout(() => {
      setState((s) => ({ ...s, copied: false }));
    }, 2000);
  };

  // KPIs
  const adminChannels = state.channels.filter((c) => c.can_post);
  const pendingRequestsCount = state.requests.length;
  const activeVipCount = state.members.filter(
    (m) => m.status === "ACTIVE" || m.status === "INVITED"
  ).length;
  const expiredVipCount = state.members.filter((m) => m.status === "EXPIRED").length;

  // Filtered Channels
  const filteredChannels = state.channels.filter((c) => {
    if (filterCategory === "ADMIN" && !c.can_post) return false;
    if (filterCategory === "READONLY" && c.can_post) return false;

    if (!state.searchQuery.trim()) return true;
    const q = state.searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      c.id.toString().includes(q)
    );
  });

  // Filtered Members
  const filteredMembers = state.members.filter((m) => {
    if (!state.searchQuery.trim()) return true;
    const q = state.searchQuery.toLowerCase();
    return (
      (m.telegram_username && m.telegram_username.toLowerCase().includes(q)) ||
      m.channel_id.toString().includes(q) ||
      (m.telegram_user_id && m.telegram_user_id.toString().includes(q))
    );
  });

  // Filtered Requests
  const filteredRequests = state.requests.filter((r) => {
    if (!state.searchQuery.trim()) return true;
    const q = state.searchQuery.toLowerCase();
    return (
      r.first_name.toLowerCase().includes(q) ||
      (r.username && r.username.toLowerCase().includes(q)) ||
      r.user_id.toString().includes(q) ||
      r.channel_id.toString().includes(q)
    );
  });

  return (
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* View Header with project design system */}
      <ViewHeader
        icon={<Tv className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Orquestador de Canales y Gatekeeper VIP"
        subtitle="Control estricto de canales propios, aprobación manual de solicitudes de ingreso y auditoría de expiración."
        badge={
          <Badge
            variant="outline"
            className="text-[10px] font-mono bg-cyan-500/15 text-cyan-500 dark:text-cyan-400 border-cyan-500/30"
          >
            {adminChannels.length} Canales Propios Administrados
          </Badge>
        }
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={state.loading}
            className="h-8 border-border bg-card/60 hover:bg-muted text-foreground text-xs flex items-center gap-1.5"
            title="Recargar datos de canales y solicitudes"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", state.loading && "animate-spin text-primary")} />
            Recargar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openEvictExpiredModal}
            disabled={state.isSubmitting}
            className="h-8 text-xs gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            title="Expulsar miembros con membresía vencida"
          >
            <UserX className="w-3.5 h-3.5 text-destructive" />
            Purgar Vencidos
          </Button>
          <Button
            size="sm"
            onClick={() =>
              setState((s) => ({
                ...s,
                modalOpen: true,
                generatedLink: null,
                lastDmSent: null,
                lastDmError: null,
                modalUsername: "",
              }))
            }
            className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center shadow-sm gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear Pase VIP
          </Button>
        </div>
      </ViewHeader>

      {/* Non-intrusive notification feedback banner */}
      {state.notification && (
        <div
          className={cn(
            "rounded-md border p-3 text-xs flex items-center justify-between gap-2 shadow-xs transition-all",
            state.notification.type === "success"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {state.notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="font-medium">{state.notification.message}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState((s) => ({ ...s, notification: null }))}
            className="h-5 w-5 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Canales Propios
            </CardTitle>
            <Tv className="w-3.5 h-3.5 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {adminChannels.length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Con permisos de administración
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "border-border bg-card shadow-sm transition-colors cursor-pointer",
            pendingRequestsCount > 0 && "border-amber-500/40 bg-amber-500/5"
          )}
          onClick={() => setFilterCategory("REQUESTS")}
        >
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Solicitudes por Aprobar
            </CardTitle>
            <Inbox
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                pendingRequestsCount > 0
                  ? "text-amber-500 animate-bounce"
                  : "text-muted-foreground"
              )}
            />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div
              className={cn(
                "text-base sm:text-xl font-bold font-mono",
                pendingRequestsCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-foreground"
              )}
            >
              {pendingRequestsCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              {pendingRequestsCount > 0
                ? "Click para revisar y admitir"
                : "Sin solicitudes pendientes"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Pases VIP Activos
            </CardTitle>
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-primary">
              {activeVipCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Membresías vigentes
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Vencidos / Auto-Kick
            </CardTitle>
            <Clock className="w-3.5 h-3.5 text-destructive shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-destructive">
              {expiredVipCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Listos para expulsión
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card border border-border p-2.5 rounded-lg shrink-0 shadow-sm">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar">
          {[
            { id: "ADMIN", label: `Mis Canales Propios (${adminChannels.length})` },
            {
              id: "REQUESTS",
              label: `Solicitudes de Ingreso (${pendingRequestsCount})`,
            },
            { id: "VIP", label: `Membresías VIP (${state.members.length})` },
            { id: "ALL", label: `Todos en Sesión (${state.channels.length})` },
          ].map((cat) => (
            <Button
              key={cat.id}
              variant={filterCategory === cat.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterCategory(cat.id)}
              className={cn(
                "h-7 text-xs px-2.5 rounded-md transition-colors gap-1.5",
                filterCategory === cat.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span>{cat.label}</span>
            </Button>
          ))}
        </div>

        {/* Search Bar Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={
              filterCategory === "REQUESTS"
                ? "Buscar por nombre, @user o ID..."
                : filterCategory === "VIP"
                ? "Buscar por username o ID..."
                : "Buscar por título o @username..."
            }
            value={state.searchQuery}
            onChange={(e) => setState((s) => ({ ...s, searchQuery: e.target.value }))}
            className="pl-8 h-8 text-xs bg-background border-border"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border border-border bg-card shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col">
        <CardHeader className="p-3 pb-2 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              {filterCategory === "REQUESTS"
                ? "Solicitudes de Unión Pendientes de Aprobación"
                : filterCategory === "VIP"
                ? "Membresías VIP y Control de Expiración"
                : filterCategory === "ADMIN"
                ? "Canales Propios con Permisos de Administración"
                : "Todos los Diálogos de Telegram"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {filterCategory === "REQUESTS"
                ? "Los usuarios que usaron el enlace VIP esperan tu aprobación para ingresar al canal y activar su período de tiempo."
                : filterCategory === "VIP"
                ? "Auditoría en vivo de cuándo se unió cada miembro, su fecha límite y estado de permanencia."
                : filterCategory === "ADMIN"
                ? "Canales donde la cuenta del sistema es administradora y puede orquestar pases VIP, invitar y expulsar."
                : "Canales y grupos detectados en la sesión de MTProto."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {filterCategory === "REQUESTS"
              ? `${filteredRequests.length} solicitudes`
              : filterCategory === "VIP"
              ? `${filteredMembers.length} miembros`
              : `${filteredChannels.length} canales`}
          </Badge>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-auto">
          {filterCategory === "REQUESTS" ? (
            /* TAB: PENDING JOIN REQUESTS */
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="border-b border-border">
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal Destino</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Usuario Solicitante</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Fecha de Solicitud</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Duración a Conceder</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase text-right">
                    Decisión del Admin
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-xs font-mono">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Consultando solicitudes en Telegram MTProto...
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-xs">
                      No hay solicitudes de unión pendientes en este momento. Cuando un usuario use el enlace VIP, aparecerá acá para que lo apruebes.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((req) => {
                    const channel = state.channels.find((c) => c.id === req.channel_id);
                    return (
                      <TableRow
                        key={`${req.channel_id}-${req.user_id}`}
                        className="hover:bg-muted/40 transition-colors border-b border-border/50"
                      >
                        <TableCell className="py-2.5 px-4 font-mono text-xs font-semibold text-foreground">
                          {channel?.title || `Canal ${req.channel_id}`}
                        </TableCell>
                        <TableCell className="py-2.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-xs">
                              {req.first_name} {req.last_name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {req.username ? (
                                <span className="text-primary font-mono text-[11px]">
                                  @{req.username}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">Sin @alias</span>
                              )}
                              <span className="text-[10px] text-muted-foreground font-mono">
                                [UID: {req.user_id}]
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-xs font-mono text-muted-foreground">
                          {req.date ? new Date(req.date).toLocaleString() : "Reciente"}
                        </TableCell>
                        <TableCell className="py-2.5 px-4">
                          <div className="w-48">
                            <Select
                              value={String(state.requestDurations[req.user_id] ?? 30)}
                              onValueChange={(val) =>
                                setState((s) => ({
                                  ...s,
                                  requestDurations: {
                                    ...s.requestDurations,
                                    [req.user_id]: Number(val),
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-7 text-xs bg-secondary/80 border-border">
                                <SelectValue placeholder="Elegir duración" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 Día (Acceso 24h)</SelectItem>
                                <SelectItem value="3">3 Días (Fin de semana)</SelectItem>
                                <SelectItem value="7">7 Días (Semanal)</SelectItem>
                                <SelectItem value="15">15 Días (Quincenal)</SelectItem>
                                <SelectItem value="30">30 Días (Mensual)</SelectItem>
                                <SelectItem value="60">60 Días (Bimestral)</SelectItem>
                                <SelectItem value="90">90 Días (Trimestral)</SelectItem>
                                <SelectItem value="180">180 Días (Semestral)</SelectItem>
                                <SelectItem value="365">365 Días (Anual)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRejectRequestModal(req)}
                              disabled={state.isSubmitting}
                              className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Rechazar
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                const days = state.requestDurations[req.user_id] ?? 30;
                                handleApproveRequest(req, days);
                              }}
                              disabled={state.isSubmitting}
                              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1 font-semibold shadow-xs"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Aprobar ({state.requestDurations[req.user_id] ?? 30}d)
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          ) : filterCategory === "VIP" ? (
            /* TAB: VIP MEMBERS WITH JOINED_AT, EXPIRES_AT AND DIRECT KICK */
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="border-b border-border">
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal Destino</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Usuario VIP</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Enlace de Acceso</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Estado</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Fecha de Ingreso</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Fecha de Expiración</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-xs font-mono">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Cargando registros Gatekeeper...
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                      No hay miembros VIP registrados en el Gatekeeper. Creá un enlace con el botón "+ Crear Pase VIP".
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/40 transition-colors border-b border-border/50">
                      <TableCell className="py-2.5 px-4 font-mono text-xs font-semibold text-foreground">
                        {state.channels.find((c) => c.id === member.channel_id)?.title || `Canal ${member.channel_id}`}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">
                            {member.telegram_username ? `@${member.telegram_username}` : "Pendiente de ingreso"}
                          </span>
                          {member.telegram_user_id && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              UID: {member.telegram_user_id}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        {member.invite_link ? (
                          <div className="flex items-center gap-1.5 max-w-xs">
                            <Input
                              readOnly
                              value={member.invite_link}
                              className="h-7 text-[11px] font-mono select-all bg-secondary/80 w-44"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(member.invite_link!)}
                              className="h-7 w-7 p-0"
                              title="Copiar enlace"
                            >
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        {member.status === "ACTIVE" && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                          >
                            Activo
                          </Badge>
                        )}
                        {member.status === "INVITED" && (
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/30 text-[10px]"
                          >
                            Invitado (Por aprobar)
                          </Badge>
                        )}
                        {member.status === "EXPIRED" && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30 text-[10px]"
                          >
                            Vencido
                          </Badge>
                        )}
                        {member.status === "KICKED" && (
                          <Badge
                            variant="outline"
                            className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]"
                          >
                            Expulsado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-xs font-mono">
                        {member.joined_at ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {new Date(member.joined_at).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">
                            Esperando ingreso...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {member.expires_at ? new Date(member.expires_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-right">
                        {member.status === "ACTIVE" && member.telegram_user_id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openKickMemberModal(member)}
                            disabled={state.isSubmitting}
                            className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 font-medium"
                            title="Expulsar inmediatamente por incumplimiento de normas"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Expulsar
                          </Button>
                        ) : member.status === "KICKED" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-destructive border-destructive/20 bg-destructive/5 font-mono"
                          >
                            Expulsado
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            /* TAB: CHANNELS (DEFAULT: ADMIN CHANNELS ONLY) */
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="border-b border-border">
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal / Comunidad</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Cuenta MTProto</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Permisos de Publicación</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Estado</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase text-right">Acciones Directas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-xs font-mono">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Cargando canales desde el motor MTProto...
                    </TableCell>
                  </TableRow>
                ) : filteredChannels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-xs">
                      No se encontraron canales que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredChannels.map((channel) => (
                    <TableRow
                      key={`${channel.id}-${channel.account_id}`}
                      className="hover:bg-muted/40 transition-colors border-b border-border/50"
                    >
                      <TableCell className="py-2.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs sm:text-sm">
                            {channel.title}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {channel.username ? (
                              <span className="text-primary font-mono text-[11px]">
                                @{channel.username}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">Canal Privado</span>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              [ID: {channel.id}]
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[11px] font-normal bg-secondary">
                          {channel.account_name || `Cuenta #${channel.account_id || 1}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        {channel.can_post ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Admin / Puede Publicar
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            Solo Lectura
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Conectado
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/chats")}
                            className="h-7 px-2 text-xs gap-1 border-border hover:bg-muted"
                            title="Abrir mensajes y chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-primary" />
                            <span className="hidden sm:inline">Mensajes</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/migration")}
                            className="h-7 px-2 text-xs gap-1 border-border hover:bg-muted"
                            title="Clonar a otro canal"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                            <span className="hidden sm:inline">Clonar</span>
                          </Button>
                          {channel.can_post && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                setState((s) => ({
                                  ...s,
                                  modalOpen: true,
                                  modalChannelId: channel.id,
                                  generatedLink: null,
                                  lastDmSent: null,
                                  lastDmError: null,
                                  modalUsername: "",
                                }))
                              }
                              className="h-7 px-2 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              <Key className="w-3 h-3" />
                              <span>Pase VIP</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shadcn Dialog: Create VIP Pass Modal */}
      <Dialog
        open={state.modalOpen}
        onOpenChange={(open) =>
          setState((s) => ({
            ...s,
            modalOpen: open,
            generatedLink: open ? s.generatedLink : null,
          }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Key className="w-4 h-4 text-primary" />
              Crear Pase de Acceso VIP
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generá un enlace que requiere solicitud de unión. Cuando el usuario lo pulse, vos aprobarás su ingreso y el tiempo comenzará a correr.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Canal Propio Destino (Solo Administrados)
              </label>
              <Select
                value={String(state.modalChannelId)}
                onValueChange={(val) => setState((s) => ({ ...s, modalChannelId: Number(val) }))}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Seleccionar canal propio" />
                </SelectTrigger>
                <SelectContent>
                  {adminChannels.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.title} {c.username ? `(@${c.username})` : `(${c.id})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">Duración de la Membresía</label>
              <Select
                value={String(state.modalDays)}
                onValueChange={(val) => setState((s) => ({ ...s, modalDays: Number(val) }))}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Seleccionar duración" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Día (Acceso 24h)</SelectItem>
                  <SelectItem value="3">3 Días (Fin de semana)</SelectItem>
                  <SelectItem value="7">7 Días (Acceso de Prueba)</SelectItem>
                  <SelectItem value="15">15 Días</SelectItem>
                  <SelectItem value="30">30 Días (Mensual)</SelectItem>
                  <SelectItem value="60">60 Días (Bimestral)</SelectItem>
                  <SelectItem value="90">90 Días (Trimestral)</SelectItem>
                  <SelectItem value="180">180 Días (Semestral)</SelectItem>
                  <SelectItem value="365">365 Días (Anual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Usuario Telegram de Destino (Opcional)
              </label>
              <Input
                placeholder="Ej: @Smpyt o 123456789"
                value={state.modalUsername}
                onChange={(e) => setState((s) => ({ ...s, modalUsername: e.target.value }))}
                className="h-8 text-xs"
              />
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="auto-send-dm"
                  checked={state.modalAutoSendDm}
                  onChange={(e) => setState((s) => ({ ...s, modalAutoSendDm: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="auto-send-dm" className="text-xs text-foreground cursor-pointer select-none">
                  Auto-enviar enlace por mensaje privado al usuario vía MTProto
                </label>
              </div>
            </div>

            {state.generatedLink && (
              <div className="bg-primary/10 border border-primary/30 rounded-md p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary block">
                    ¡Enlace Único Generado con Aprobación Previa!
                  </span>
                  {state.modalAutoSendDm && state.modalUsername && (
                    state.lastDmSent ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Enviado por DM
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1" title={state.lastDmError || "No se pudo entregar por DM"}>
                        <AlertCircle className="w-3 h-3" />
                        No entregado por DM
                      </Badge>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={state.generatedLink}
                    className="h-8 text-xs font-mono select-all bg-card"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => copyToClipboard(state.generatedLink!)}
                    className="h-8 px-3 shrink-0 gap-1.5 text-xs"
                  >
                    {state.copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {state.copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>

                {state.lastDmSent ? (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ El enlace fue auto-enviado con éxito a {state.modalUsername} por mensaje privado en Telegram.
                  </p>
                ) : state.lastDmError ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠️ Telegram no permitió enviar el DM a {state.modalUsername} ({state.lastDmError}). Copiá el enlace manualmente.
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Este enlace activa una solicitud de unión. Cuando el usuario lo use, te llegará la solicitud a la pestaña "Solicitudes de Ingreso" para aprobarlo.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState((s) => ({ ...s, modalOpen: false }))}
              className="h-8 text-xs"
            >
              Cerrar
            </Button>
            {!state.generatedLink && (
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateVipPass}
                disabled={state.isSubmitting}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Generar Enlace
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shadcn Dialog: Action Confirmation Modal (Replaces browser alerts/confirms/prompts) */}
      <Dialog
        open={!!state.actionModal}
        onOpenChange={(open) => {
          if (!open) setState((s) => ({ ...s, actionModal: null }));
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              {state.actionModal?.type === "KICK_MEMBER" ? (
                <UserX className="w-5 h-5 text-destructive" />
              ) : state.actionModal?.type === "EVICT_EXPIRED" ? (
                <Clock className="w-5 h-5 text-amber-500" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              {state.actionModal?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {state.actionModal?.description}
            </DialogDescription>
          </DialogHeader>

          {state.actionModal?.type === "KICK_MEMBER" && (
            <div className="space-y-2 py-2">
              <label className="text-xs font-semibold text-foreground block">
                Motivo de la expulsión:
              </label>
              <Input
                value={state.actionModal.reason || ""}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    actionModal: s.actionModal
                      ? { ...s.actionModal, reason: e.target.value }
                      : null,
                  }))
                }
                placeholder="Ej: Incumplimiento de normas o conducta inadecuada"
                className="h-8 text-xs bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                El usuario será expulsado de Telegram en tiempo real vía MTProto.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState((s) => ({ ...s, actionModal: null }))}
              disabled={state.isSubmitting}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              variant={state.actionModal?.type === "EVICT_EXPIRED" ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirmActionModal}
              disabled={state.isSubmitting}
              className="h-8 text-xs gap-1.5 font-semibold"
            >
              {state.isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {state.actionModal?.type === "KICK_MEMBER"
                ? "Confirmar Expulsión"
                : state.actionModal?.type === "EVICT_EXPIRED"
                ? "Ejecutar Desalojo"
                : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelManagementView;
