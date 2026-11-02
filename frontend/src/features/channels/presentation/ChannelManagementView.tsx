import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tv,
  Search,
  ShieldCheck,
  Radio,
  Copy,
  Check,
  Plus,
  RefreshCw,
  UserX,
  MessageSquare,
  ArrowRightLeft,
  Key,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent } from "@/shared/components/ui/card";
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
  filter: string;
  modalOpen: boolean;
  modalChannelId: number;
  modalDays: number;
  modalUsername: string;
  generatedLink: string | null;
  copied: boolean;
  isSubmitting: boolean;
}

export const ChannelManagementView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 2 used)
  const [activeTab, setActiveTab] = useState<"channels" | "vip">("channels");
  const [state, setState] = useState<ViewState>({
    channels: [],
    members: [],
    loading: true,
    filter: "",
    modalOpen: false,
    modalChannelId: 0,
    modalDays: 30,
    modalUsername: "",
    generatedLink: null,
    copied: false,
    isSubmitting: false,
  });

  const navigate = useNavigate();

  const loadData = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [channelsData, membersData] = await Promise.all([
        channelApi.listManagedChannels(),
        channelApi.listVipMembers(),
      ]);
      setState((s) => ({
        ...s,
        channels: channelsData,
        members: membersData,
        modalChannelId: channelsData[0]?.id || 0,
        loading: false,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false }));
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
    if (!window.confirm("¿Deseas ejecutar el desalojo (Auto-Kick) de miembros VIP con suscripción vencida?")) {
      return;
    }
    setState((s) => ({ ...s, isSubmitting: true }));
    try {
      const res = await channelApi.evictExpiredMembers();
      alert(`Desalojo completado. Miembros expulsados: ${res.evicted_count}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Error al ejecutar desalojo.");
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

  const filteredChannels = state.channels.filter((c) => {
    const q = state.filter.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      c.id.toString().includes(q)
    );
  });

  const filteredMembers = state.members.filter((m) => {
    const q = state.filter.toLowerCase();
    return (
      (m.telegram_username && m.telegram_username.toLowerCase().includes(q)) ||
      m.channel_id.toString().includes(q) ||
      (m.telegram_user_id && m.telegram_user_id.toString().includes(q))
    );
  });

  return (
    <div className="w-full h-full flex flex-col space-y-2.5 sm:space-y-3 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* Standardized ViewHeader with Shadcn Actions */}
      <ViewHeader
        icon={<Tv className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Administrador de Canales"
        subtitle="Supervisión integral de canales vinculados, permisos de administración y orquestación de miembros VIP (Gatekeeper)."
      >
        <div className="flex items-center gap-2">
          {/* Tabs using Shadcn Button components */}
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-md border border-border">
            <Button
              variant={activeTab === "channels" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("channels")}
              className="h-7 text-xs px-2.5 font-medium"
            >
              <Radio className="w-3.5 h-3.5 mr-1 text-primary" />
              Canales ({state.channels.length})
            </Button>
            <Button
              variant={activeTab === "vip" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("vip")}
              className="h-7 text-xs px-2.5 font-medium"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              Miembros VIP ({state.members.length})
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={state.loading}
            className="h-8 px-2.5"
            title="Actualizar datos"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", state.loading && "animate-spin")} />
          </Button>
        </div>
      </ViewHeader>

      {/* Control & Filter Card */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder={
                activeTab === "channels"
                  ? "Buscar canal por título, @username o ID..."
                  : "Buscar miembro por username o ID de canal..."
              }
              value={state.filter}
              onChange={(e) => setState((s) => ({ ...s, filter: e.target.value }))}
              className="pl-9 h-8 text-xs"
            />
          </div>

          {activeTab === "vip" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEvictExpired}
                disabled={state.isSubmitting}
                className="h-8 text-xs gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <UserX className="w-3.5 h-3.5 text-destructive" />
                Purgar Vencidos (Auto-Kick)
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    modalOpen: true,
                    generatedLink: null,
                    modalUsername: "",
                  }))
                }
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear Pase VIP
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="flex-1 min-h-0 border border-border overflow-hidden shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {activeTab === "channels" ? (
              <Table>
                <TableHeader className="bg-secondary/60">
                  <TableRow className="border-b border-border">
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal / Comunidad</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Cuenta MTProto</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Permisos de Edición</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Estado</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase text-right">Acciones Directas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChannels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                        No se encontraron canales vinculados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChannels.map((channel) => (
                      <TableRow key={`${channel.id}-${channel.account_id}`} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-xs sm:text-sm">
                              {channel.title}
                            </span>
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {channel.username ? `@${channel.username}` : `ID: ${channel.id}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge variant="outline" className="text-[11px] font-normal bg-secondary">
                            {channel.account_name || `Cuenta #${channel.account_id || 1}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
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
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Conectado
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/chats")}
                              className="h-7 w-7 p-0"
                              title="Abrir mensajes y chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-primary" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/migration")}
                              className="h-7 w-7 p-0"
                              title="Clonar a otro canal"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
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
                              className="h-7 text-xs px-2 gap-1"
                            >
                              <Key className="w-3 h-3" />
                              Pase VIP
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader className="bg-secondary/60">
                  <TableRow className="border-b border-border">
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Canal Destino</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Usuario VIP</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Enlace de Invitación</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Estado</TableHead>
                    <TableHead className="py-2.5 px-4 font-mono text-[10px] uppercase">Fecha de Expiración</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                        No hay miembros VIP registrados en el Gatekeeper. Creá un enlace con el botón superior.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="py-3 px-4 font-mono text-xs font-semibold text-foreground">
                          {state.channels.find((c) => c.id === member.channel_id)?.title || `ID: ${member.channel_id}`}
                        </TableCell>
                        <TableCell className="py-3 px-4">
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
                        <TableCell className="py-3 px-4">
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
                        <TableCell className="py-3 px-4">
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
                              className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]"
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
                        <TableCell className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                          {member.expires_at ? new Date(member.expires_at).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
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
