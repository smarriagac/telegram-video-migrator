import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radio,
  Search,
  ShieldCheck,
  Copy,
  Check,
  Plus,
  RefreshCw,
  UserX,
  MessageSquare,
  ArrowRightLeft,
  X,
  Key,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
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
    if (!confirm("¿Deseas ejecutar el desalojo (Auto-Kick) de todos los miembros VIP con suscripción vencida?")) {
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
    <div className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Administrador de Canales
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supervisión de canales vinculados, permisos de administración y orquestación de miembros VIP (Gatekeeper).
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-secondary/80 p-1.5 rounded-xl border border-border self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("channels")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "channels"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Radio className="w-3.5 h-3.5 text-primary" />
            Canales Gestionados ({state.channels.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("vip")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "vip"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Miembros VIP & Paywall ({state.members.length})
          </button>
        </div>
      </div>

      {/* Filter & Global Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeTab === "channels" ? "Buscar por nombre, @username o ID..." : "Buscar por usuario o ID de canal..."}
            value={state.filter}
            onChange={(e) => setState((s) => ({ ...s, filter: e.target.value }))}
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "vip" && (
            <>
              <button
                type="button"
                onClick={handleEvictExpired}
                disabled={state.isSubmitting}
                className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <UserX className="w-3.5 h-3.5 text-red-400" />
                Purgar Vencidos (Auto-Kick)
              </button>
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    modalOpen: true,
                    generatedLink: null,
                    modalUsername: "",
                  }))
                }
                className="px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear Pase VIP
              </button>
            </>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={state.loading}
            className="p-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={cn("w-4 h-4", state.loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Tab Content: Channels */}
      {activeTab === "channels" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Canal / Comunidad</th>
                  <th className="py-3 px-4">Cuenta MTProto</th>
                  <th className="py-3 px-4">Permisos</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones Directas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredChannels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No se encontraron canales vinculados.
                    </td>
                  </tr>
                ) : (
                  filteredChannels.map((channel) => (
                    <tr key={`${channel.id}-${channel.account_id}`} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-sm">
                            {channel.title}
                          </span>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {channel.username ? `@${channel.username}` : `ID: ${channel.id}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-secondary px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-foreground">
                          {channel.account_name || `Cuenta #${channel.account_id || 1}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {channel.can_post ? (
                          <span className="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3" />
                            Admin / Puede Publicar
                          </span>
                        ) : (
                          <span className="bg-secondary text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border w-fit">
                            Solo Lectura
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Conectado
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate("/chats")}
                            className="p-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg transition-colors"
                            title="Abrir mensajes y chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/migration")}
                            className="p-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg transition-colors"
                            title="Clonar a otro canal"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setState((s) => ({
                                ...s,
                                modalOpen: true,
                                modalChannelId: channel.id,
                                generatedLink: null,
                                modalUsername: "",
                              }))
                            }
                            className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Key className="w-3.5 h-3.5" />
                            Pase VIP
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: VIP Gatekeeper */}
      {activeTab === "vip" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 border-b border-border text-muted-foreground uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">Canal Destino</th>
                  <th className="py-3 px-4">Usuario VIP</th>
                  <th className="py-3 px-4">Enlace de Invitación</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Expiración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No hay miembros VIP registrados en el Gatekeeper. Creá un enlace con el botón superior.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-foreground font-semibold">
                        {state.channels.find((c) => c.id === member.channel_id)?.title || `ID: ${member.channel_id}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {member.telegram_username ? `@${member.telegram_username}` : "Pendiente de ingreso"}
                          </span>
                          {member.telegram_user_id && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              UID: {member.telegram_user_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {member.invite_link ? (
                          <div className="flex items-center gap-1.5 max-w-xs">
                            <input
                              type="text"
                              readOnly
                              value={member.invite_link}
                              className="bg-secondary border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-muted-foreground w-44 truncate select-all"
                            />
                            <button
                              type="button"
                              onClick={() => copyToClipboard(member.invite_link!)}
                              className="p-1 hover:text-primary transition-colors"
                              title="Copiar enlace"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {member.status === "ACTIVE" && (
                          <span className="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                            Activo
                          </span>
                        )}
                        {member.status === "INVITED" && (
                          <span className="bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/30">
                            Invitación Emitida
                          </span>
                        )}
                        {member.status === "EXPIRED" && (
                          <span className="bg-amber-500/15 text-amber-500 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                            Vencido
                          </span>
                        )}
                        {member.status === "KICKED" && (
                          <span className="bg-red-500/15 text-red-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-500/30">
                            Expulsado
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {member.expires_at ? new Date(member.expires_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create VIP Pass */}
      {state.modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Crear Pase de Acceso VIP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, modalOpen: false }))}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Canal Destino
                </label>
                <select
                  value={state.modalChannelId}
                  onChange={(e) =>
                    setState((s) => ({ ...s, modalChannelId: Number(e.target.value) }))
                  }
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {state.channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} {c.username ? `(@${c.username})` : `(${c.id})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Duración de la Membresía
                </label>
                <select
                  value={state.modalDays}
                  onChange={(e) =>
                    setState((s) => ({ ...s, modalDays: Number(e.target.value) }))
                  }
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={7}>7 Días (Acceso de Prueba)</option>
                  <option value={15}>15 Días</option>
                  <option value={30}>30 Días (Mensual)</option>
                  <option value={90}>90 Días (Trimestral)</option>
                  <option value={365}>365 Días (Anual)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Usuario o Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: cliente_vip_123 o @telegram_user"
                  value={state.modalUsername}
                  onChange={(e) =>
                    setState((s) => ({ ...s, modalUsername: e.target.value }))
                  }
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {state.generatedLink && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 space-y-2 mt-2">
                  <span className="text-[11px] font-semibold text-primary block">
                    ¡Enlace Único Generado con Éxito!
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={state.generatedLink}
                      className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(state.generatedLink!)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-1 shrink-0"
                    >
                      {state.copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {state.copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Este enlace expira automáticamente y admite un solo ingreso.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, modalOpen: false }))}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
              {!state.generatedLink && (
                <button
                  type="button"
                  onClick={handleCreateVipPass}
                  disabled={state.isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Generar Enlace
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelManagementView;
