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
import { channelApi, ManagedChannel, VipMembership } from "../infrastructure/channelApi";

interface ViewState {
  channels: ManagedChannel[];
  members: VipMembership[];
  loading: boolean;
  searchQuery: string;
  modalOpen: boolean;
  modalChannelId: number;
  modalDays: number;
  modalUsername: string;
  generatedLink: string | null;
  copied: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export const ChannelManagementView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Exactly 2 useState hooks
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [state, setState] = useState<ViewState>({
    channels: [],
    members: [],
    loading: true,
    searchQuery: "",
    modalOpen: false,
    modalChannelId: 0,
    modalDays: 30,
    modalUsername: "",
    generatedLink: null,
    copied: false,
    isSubmitting: false,
    error: null,
  });

  const navigate = useNavigate();

  const loadData = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [channelsRes, membersRes] = await Promise.allSettled([
        channelApi.listManagedChannels(),
        channelApi.listVipMembers(),
      ]);

      const channelsData = channelsRes.status === "fulfilled" ? channelsRes.value : [];
      const membersData = membersRes.status === "fulfilled" ? membersRes.value : [];

      setState((s) => ({
        ...s,
        channels: channelsData,
        members: membersData,
        modalChannelId: channelsData[0]?.id || 0,
        loading: false,
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Error al sincronizar datos del servidor.",
      }));
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
        state.modalUsername
      );
      setState((s) => ({
        ...s,
        generatedLink: pass.invite_link || null,
        members: [pass, ...s.members],
        isSubmitting: false,
      }));
    } catch (err: any) {
      alert(err.message || "Error al crear enlace VIP.");
      setState((s) => ({ ...s, isSubmitting: false }));
    }
  };

  const handleEvictExpired = async () => {
    if (!window.confirm("¿Deseas ejecutar el desalojo (Auto-Kick) de miembros VIP con membresía vencida?")) {
      return;
    }
    setState((s) => ({ ...s, isSubmitting: true }));
    try {
      const res = await channelApi.evictExpiredMembers();
      alert(`Desalojo completado. Miembros expulsados: ${res.evicted_count}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Error al ejecutar desalojo de miembros.");
    } finally {
      setState((s) => ({ ...s, isSubmitting: false }));
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
  const totalChannels = state.channels.length;
  const adminChannels = state.channels.filter((c) => c.can_post).length;
  const activeVipCount = state.members.filter((m) => m.status === "ACTIVE" || m.status === "INVITED").length;
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

  return (
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* View Header with project design system */}
      <ViewHeader
        icon={<Tv className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Administrador de Canales"
        subtitle="Supervisión centralizada de canales de Telegram, control de permisos MTProto y automatización de membresías VIP con Gatekeeper."
        badge={
          <Badge
            variant="outline"
            className="text-[10px] font-mono bg-cyan-500/15 text-cyan-500 dark:text-cyan-400 border-cyan-500/30"
          >
            MTProto Pool ({totalChannels} canales)
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
            title="Recargar datos de canales"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", state.loading && "animate-spin text-primary")} />
            Recargar Canales
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEvictExpired}
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
                modalUsername: "",
              }))
            }
            className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center shadow-sm gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            Crear Pase VIP
          </Button>
        </div>
      </ViewHeader>

      {state.error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Total Canales MTProto
            </CardTitle>
            <Tv className="w-3.5 h-3.5 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-foreground">
              {totalChannels}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Detectados en sesión activa
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Con Permiso de Admin
            </CardTitle>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {adminChannels}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Capacidad de publicación directa
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
              Membresías temporales vigentes
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-3 pb-1">
            <CardTitle className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold truncate">
              Vencidos / Auto-Kick
            </CardTitle>
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 sm:p-3 pt-0">
            <div className="text-base sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {expiredVipCount}
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
              Candidatos para expulsión
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card border border-border p-2.5 rounded-lg shrink-0 shadow-sm">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar">
          {[
            { id: "ALL", label: `Todos (${totalChannels})` },
            { id: "ADMIN", label: `Admin (${adminChannels})` },
            { id: "READONLY", label: `Solo Lectura (${totalChannels - adminChannels})` },
            { id: "VIP", label: `Membresías VIP (${state.members.length})` },
          ].map((cat) => (
            <Button
              key={cat.id}
              variant={filterCategory === cat.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterCategory(cat.id)}
              className={cn(
                "h-7 text-xs px-2.5 rounded-md transition-colors",
                filterCategory === cat.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Search Bar Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={
              filterCategory === "VIP"
                ? "Buscar por username o ID de canal..."
                : "Buscar por título, @username o ID..."
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
              {filterCategory === "VIP"
                ? "Membresías VIP y Registros Gatekeeper"
                : "Listado de Canales y Permisos de Administración"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {filterCategory === "VIP"
                ? "Gestión de accesos con expiración y expulsión programada mediante MTProto."
                : "Canales vinculados a tu cuenta MTProto con estado de publicación y acciones rápidas."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {filterCategory === "VIP"
              ? `${filteredMembers.length} miembros`
              : `${filteredChannels.length} canales`}
          </Badge>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-auto">
          {filterCategory === "VIP" ? (
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="border-b border-border">
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal Destino</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Usuario VIP</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Enlace de Invitación Efímero</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Estado Gatekeeper</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Fecha de Expiración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-xs font-mono">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Cargando registros Gatekeeper...
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-xs">
                      No hay miembros VIP registrados aún en el Gatekeeper. Creá un enlace con el botón superior "+ Crear Pase VIP".
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
                              className="h-7 text-[11px] font-mono select-all bg-secondary/80 w-48"
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
                            Invitación Emitida
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
                      <TableCell className="py-2.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {member.expires_at ? new Date(member.expires_at).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="border-b border-border">
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal / Comunidad</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Cuenta MTProto</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Permisos de Publicación</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Estado</TableHead>
                  <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase text-right">Acciones Rápidas</TableHead>
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
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              setState((s) => ({
                                ...s,
                                modalOpen: true,
                                modalChannelId: channel.id,
                                generatedLink: null,
                                modalUsername: "",
                              }))
                            }
                            className="h-7 px-2 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Key className="w-3 h-3" />
                            <span>Pase VIP</span>
                          </Button>
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
          setState((s) => ({ ...s, modalOpen: open, generatedLink: open ? s.generatedLink : null }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Key className="w-4 h-4 text-primary" />
              Crear Pase de Acceso VIP
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generá un enlace de invitación efímero con expiración automática mediante el Gatekeeper MTProto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">Canal Destino</label>
              <Select
                value={String(state.modalChannelId)}
                onValueChange={(val) => setState((s) => ({ ...s, modalChannelId: Number(val) }))}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Seleccionar canal" />
                </SelectTrigger>
                <SelectContent>
                  {state.channels.map((c) => (
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
                  <SelectItem value="7">7 Días (Acceso de Prueba)</SelectItem>
                  <SelectItem value="15">15 Días</SelectItem>
                  <SelectItem value="30">30 Días (Mensual)</SelectItem>
                  <SelectItem value="90">90 Días (Trimestral)</SelectItem>
                  <SelectItem value="365">365 Días (Anual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Usuario o Referencia (Opcional)
              </label>
              <Input
                placeholder="Ej: cliente_vip_123 o @telegram_user"
                value={state.modalUsername}
                onChange={(e) => setState((s) => ({ ...s, modalUsername: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            {state.generatedLink && (
              <div className="bg-primary/10 border border-primary/30 rounded-md p-3 space-y-2 mt-2">
                <span className="text-xs font-semibold text-primary block">
                  ¡Enlace Único Generado con Éxito!
                </span>
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
                <p className="text-[10px] text-muted-foreground">
                  Este enlace expira automáticamente en Telegram y admite un solo ingreso.
                </p>
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
    </div>
  );
};

export default ChannelManagementView;
