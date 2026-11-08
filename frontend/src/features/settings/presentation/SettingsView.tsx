import React, { useEffect, useState } from "react";
import {
  Settings,
  Lock,
  Plus,
  KeyRound,
  Check,
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Bell,
  Send,
  ShieldAlert,
  Database,
  Activity,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { alertsApi } from "../infrastructure/alertsApi";
import { BackupManagerCard } from "./components/BackupManagerCard";
import { WebhookManagerCard } from "./components/WebhookManagerCard";
import { RateGovernorCard } from "./components/RateGovernorCard";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { useAuthStore } from "@/features/auth/application/useAuthStore";
import { Role } from "@/features/auth/domain/types";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { cn } from "@/shared/lib/utils";

export const SettingsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Active tab navigation between Credentials, Users, Alerts, Backups and Rate Governor
  const [activeTab, setActiveTab] = useState<"credentials" | "users" | "alerts" | "backups" | "governor">("credentials");
  // Hook 2: Consolidated local UI, alerts configuration and temporary action feedback banner
  const [localState, setLocalState] = useState<{
    feedback: { message: string; isError?: boolean } | null;
    alertRecipient: string;
    alertChannelId: string;
    notifyFloodWait: boolean;
    notifyJobFailures: boolean;
    notifyVipPurchases: boolean;
    notifyEvictions: boolean;
    isTestingAlert: boolean;
    isSavingAlerts: boolean;
    confirmDialog: {
      isOpen: boolean;
      title: string;
      description: string;
      confirmLabel?: string;
      variant?: "destructive" | "default";
      onConfirm: () => void;
    } | null;
  }>({
    feedback: null,
    alertRecipient: "@Smpyt",
    alertChannelId: "",
    notifyFloodWait: true,
    notifyJobFailures: true,
    notifyVipPurchases: true,
    notifyEvictions: true,
    isTestingAlert: false,
    isSavingAlerts: false,
    confirmDialog: null,
  });

  const accounts = useAuthStore((state) => state.accounts);
  const usersList = useAuthStore((state) => state.usersList);
  const loadAccounts = useAuthStore((state) => state.loadAccounts);
  const loadUsers = useAuthStore((state) => state.loadUsers);
  const saveCredentials = useAuthStore((state) => state.saveCredentials);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const createUser = useAuthStore((state) => state.createUser);
  const updateUser = useAuthStore((state) => state.updateUser);
  const deleteUser = useAuthStore((state) => state.deleteUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadAccounts();
    if (user?.role === "ADMIN") {
      loadUsers();
      alertsApi.getAlertConfig().then((res) => {
        if (res.config) {
          setLocalState((prev) => ({
            ...prev,
            alertRecipient: res.config.alert_recipient || "@Smpyt",
            alertChannelId: res.config.alert_channel_id ? String(res.config.alert_channel_id) : "",
            notifyFloodWait: res.config.notify_flood_wait ?? true,
            notifyJobFailures: res.config.notify_job_failures ?? true,
            notifyVipPurchases: res.config.notify_vip_purchases ?? true,
            notifyEvictions: res.config.notify_evictions ?? true,
          }));
        }
      }).catch(() => {});
    }
  }, [loadAccounts, loadUsers, user]);

  const showFeedback = (message: string, isError = false) => {
    setLocalState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setLocalState((prev) => ({ ...prev, feedback: null }));
    }, 3500);
  };

  const handleSaveAlerts = async () => {
    setLocalState((prev) => ({ ...prev, isSavingAlerts: true }));
    try {
      await alertsApi.saveAlertConfig({
        alert_recipient: localState.alertRecipient.trim() || null,
        alert_channel_id: localState.alertChannelId.trim() ? Number(localState.alertChannelId.trim()) : null,
        notify_flood_wait: localState.notifyFloodWait,
        notify_job_failures: localState.notifyJobFailures,
        notify_vip_purchases: localState.notifyVipPurchases,
        notify_evictions: localState.notifyEvictions,
      });
      showFeedback("Configuración de alertas guardada con éxito.");
    } catch (err: any) {
      showFeedback(err.message || "Error al guardar alertas", true);
    } finally {
      setLocalState((prev) => ({ ...prev, isSavingAlerts: false }));
    }
  };

  const handleTestAlert = async () => {
    setLocalState((prev) => ({ ...prev, isTestingAlert: true }));
    try {
      const res = await alertsApi.sendTestAlert({
        recipient: localState.alertRecipient.trim() || undefined,
        channel_id: localState.alertChannelId.trim() ? Number(localState.alertChannelId.trim()) : undefined,
        severity: "INFO",
        custom_message: "Prueba de canal y alertas operativas de Telegram Hub. Monitoreo en tiempo real 100% operativo.",
      });
      showFeedback(`¡Alerta entregada a ${res.delivered_to}! Verificá tu Telegram.`);
    } catch (err: any) {
      showFeedback(err.message || "Error al enviar alerta de prueba", true);
    } finally {
      setLocalState((prev) => ({ ...prev, isTestingAlert: false }));
    }
  };

  const openConfirm = (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "destructive" | "default";
    onConfirm: () => void;
  }) => {
    setLocalState((prev) => ({
      ...prev,
      confirmDialog: {
        isOpen: true,
        ...opts,
      },
    }));
  };

  const closeConfirm = () => {
    setLocalState((prev) => ({ ...prev, confirmDialog: null }));
  };

  const handleDeleteAccount = (id: number, name: string) => {
    openConfirm({
      title: "Desconectar Cuenta",
      description: `¿Estás seguro de que deseás desconectar y eliminar permanentemente la cuenta "${name}"?`,
      confirmLabel: "Eliminar Cuenta",
      variant: "destructive",
      onConfirm: async () => {
        const ok = await deleteAccount(id);
        if (ok) {
          showFeedback(`Cuenta "${name}" eliminada correctamente.`);
        } else {
          showFeedback(`No se pudo eliminar la cuenta "${name}".`, true);
        }
      },
    });
  };

  const handleSaveCredentials = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string) || "Cuenta Principal";
    const phone = (formData.get("phone") as string) || "";
    const api_id = (formData.get("api_id") as string) || "";
    const api_hash = (formData.get("api_hash") as string) || "";
    const session_string = (formData.get("session_string") as string) || "";

    if (!api_id.trim() || !api_hash.trim()) {
      showFeedback("API ID y API Hash son obligatorios.", true);
      return;
    }

    const ok = await saveCredentials({
      name,
      phone,
      api_id,
      api_hash,
      session_string: session_string.trim() || undefined,
    });

    if (ok) {
      showFeedback("Credenciales cifradas con éxito en PostgreSQL (AES-256).");
      (e.target as HTMLFormElement).reset();
    } else {
      showFeedback("No se pudieron guardar las credenciales.", true);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string) || "";
    const password = (formData.get("password") as string) || "";
    const role = (formData.get("role") as Role) || "OPERATOR";

    if (!email.trim() || !password.trim()) {
      showFeedback("Email y contraseña requeridos.", true);
      return;
    }

    const ok = await createUser({ email, password, role });
    if (ok) {
      showFeedback(`Usuario ${email} registrado con rol ${role}.`);
      (e.target as HTMLFormElement).reset();
    } else {
      showFeedback("Error creando usuario (verifique si el email ya existe).", true);
    }
  };

  const handleRoleChange = async (targetId: number, newRole: Role) => {
    const ok = await updateUser(targetId, { role: newRole });
    if (ok) {
      showFeedback(`Rol actualizado a ${newRole}.`);
    } else {
      showFeedback("Error actualizando el rol.", true);
    }
  };

  const handleToggleStatus = async (targetId: number, currentActive: boolean) => {
    const ok = await updateUser(targetId, { is_active: !currentActive });
    if (ok) {
      showFeedback(
        !currentActive ? "Usuario activado." : "Usuario suspendido correctamente."
      );
    } else {
      showFeedback("Error modificando estado del usuario.", true);
    }
  };

  const handleDeleteUser = (targetId: number, targetEmail: string) => {
    openConfirm({
      title: "Eliminar Usuario",
      description: `¿Estás seguro de que deseás eliminar permanentemente al usuario "${targetEmail}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar Usuario",
      variant: "destructive",
      onConfirm: async () => {
        const ok = await deleteUser(targetId);
        if (ok) {
          showFeedback(`Usuario ${targetEmail} eliminado.`);
        } else {
          showFeedback("Error eliminando el usuario.", true);
        }
      },
    });
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "OPERATOR":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      default:
        return "bg-zinc-800 text-zinc-400 border-white/10";
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-3.5 min-h-0 overflow-y-auto pr-1 pb-4">
      {/* Header */}
      <ViewHeader
        icon={<Settings className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Configuración del Sistema"
        subtitle="Gestión de seguridad RBAC, credenciales de Telegram y telemetría de microservicios."
      >

        {/* Tab Switcher for Admins */}
        {user?.role === "ADMIN" && (
          <div className="flex items-center gap-1 p-0.5 bg-secondary/60 border border-border rounded-lg shrink-0 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("credentials")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "credentials"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Credenciales Telegram
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "users"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Gestión de Usuarios (RBAC)
            </button>
            <button
              onClick={() => setActiveTab("alerts")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "alerts"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <Bell className="w-3.5 h-3.5" />
              Alertas y Monitoreo MTProto
            </button>
            <button
              onClick={() => setActiveTab("backups")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "backups"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <Database className="w-3.5 h-3.5" />
              Copias de Seguridad (DR)
            </button>
            <button
              onClick={() => setActiveTab("governor")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "governor"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              Gobernador de Tasa (AIMD)
            </button>
          </div>
        )}
      </ViewHeader>

      {/* Global Feedback Banner */}
      {localState.feedback && (
        <div
          className={cn(
            "p-2.5 rounded-lg text-xs flex items-center gap-2 transition-all shrink-0",
            localState.feedback.isError
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {localState.feedback.isError ? <XCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
          <span>{localState.feedback.message}</span>
        </div>
      )}

      {/* TAB 1: Telegram Credentials Form + Registered Accounts */}
      {activeTab === "credentials" && user?.role === "ADMIN" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
          {/* Left: Credentials Form (5 cols on xl) */}
          <div className="xl:col-span-5 bg-card border border-border rounded-md p-4 md:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  <KeyRound className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-xs font-bold text-foreground">Vincular Nueva Cuenta</h2>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Cifrado AES-256 en PostgreSQL 18
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 font-semibold">
                <Lock className="w-3 h-3" /> At-Rest
              </span>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Etiqueta de la Cuenta</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Ej: Cuenta Producción / Personal"
                  defaultValue="Cuenta Principal"
                  required
                  className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    Telegram API ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="api_id"
                    type="text"
                    placeholder="Ej: 12345678"
                    required
                    className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Teléfono (Opcional)</label>
                  <input
                    name="phone"
                    type="text"
                    placeholder="+54 9 11 1234-5678"
                    className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Telegram API Hash <span className="text-rose-500">*</span>
                </label>
                <input
                  name="api_hash"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  required
                  className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Session String MTProto (Opcional)
                </label>
                <textarea
                  name="session_string"
                  rows={2}
                  placeholder="1BVtsOHQBu7... (Session string exportada)"
                  className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md px-3.5 h-8 text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Guardar Credenciales Cifradas</span>
              </Button>
            </form>
          </div>

          {/* Right: Configured Accounts Table (7 cols on xl) */}
          <div className="xl:col-span-7 bg-card border border-border rounded-md p-4 md:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div>
                <h2 className="text-xs font-bold text-foreground">Cuentas Registradas</h2>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Identidades MTProto configuradas en el clúster
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                Total: <strong className="text-foreground">{accounts.length}</strong>
              </span>
            </div>

            {isLoading && accounts.length === 0 ? (
              <div className="rounded-lg bg-card border border-border p-2">
                <TableSkeleton rows={3} columns={4} />
              </div>
            ) : accounts.length > 0 ? (
              <div className="rounded-lg bg-card border border-border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/40">
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-semibold">Nombre de Cuenta</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Credenciales En Reposo</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc) => (
                      <TableRow key={acc.id} className="border-b border-border hover:bg-muted/50">
                        <TableCell className="font-semibold text-foreground text-xs">{acc.name}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          API ID: {acc.api_id_masked} · Hash: {acc.api_hash_masked}
                        </TableCell>
                        <TableCell>
                          <Badge variant="admin">Activa</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(acc.id, acc.name)}
                            className="p-1.5 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Desconectar y eliminar cuenta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground bg-secondary/30 rounded-lg border border-border flex flex-col items-center justify-center gap-2">
                <KeyRound className="w-8 h-8 text-muted-foreground/60 stroke-1" />
                <span>No hay cuentas registradas todavía.</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Completá el formulario a la izquierda para vincular una cuenta.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Interactive User Management (RBAC) */}
      {activeTab === "users" && user?.role === "ADMIN" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
          {/* Create User Card (Left on xl: 4 cols) */}
          <div className="xl:col-span-4 bg-card border border-border rounded-md p-4 md:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-border">
              <span className="p-1.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                <UserPlus className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-xs font-bold text-foreground">Dar de Alta Nuevo Usuario</h2>
                <span className="text-[10px] text-muted-foreground">
                  Crea accesos individuales y asigna roles
                </span>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Email del Usuario</label>
                <input
                  name="email"
                  type="email"
                  placeholder="operador@telegramhub.local"
                  required
                  className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Contraseña Inicial</label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Rol de Ejecución</label>
                <Select name="role" defaultValue="OPERATOR">
                  <SelectTrigger className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary h-8">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border text-popover-foreground text-xs">
                    <SelectItem value="OPERATOR">OPERATOR (Clonador y Chats)</SelectItem>
                    <SelectItem value="VIEWER">VIEWER (Solo Lectura)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Acceso Total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md px-3.5 h-8 text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Crear Usuario</span>
              </Button>
            </form>
          </div>

          {/* Users Table Card (Right on xl: 8 cols) */}
          <div className="xl:col-span-8 bg-card border border-border rounded-md p-4 md:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20">
                  <Users className="w-4 h-4" />
                </span>
                <h2 className="text-xs font-bold text-foreground">Usuarios del Sistema</h2>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                Total: <strong className="text-foreground">{usersList.length}</strong>
              </span>
            </div>

            {isLoading && usersList.length === 0 ? (
              <div className="rounded-lg bg-card border border-border p-2">
                <TableSkeleton rows={4} columns={4} />
              </div>
            ) : (
              <div className="rounded-lg bg-card border border-border overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold w-2/5">Usuario</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Rol Asignado</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
                    <TableHead className="text-right text-muted-foreground font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((u) => (
                    <TableRow key={u.id} className="border-b border-border hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-secondary border border-border flex items-center justify-center font-bold text-foreground text-[11px] flex-shrink-0">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground text-xs truncate">{u.email}</span>
                              {u.id === user?.id && (
                                <Badge variant="outline" size="sm" className="text-[9px] text-primary bg-primary/10 border-primary/30">
                                  Tú
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono block">ID: #{u.id}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="w-32">
                          <Select
                            value={u.role}
                            onValueChange={(val) => handleRoleChange(u.id, val as Role)}
                            disabled={u.id === user?.id}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-7 px-2 text-[10px] font-mono font-bold rounded-md border shadow-sm transition-colors",
                                getRoleBadgeStyle(u.role)
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border text-popover-foreground text-xs">
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                              <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                              <SelectItem value="VIEWER">VIEWER</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={u.is_active ? "admin" : "destructive"}
                          className="text-[9px]"
                        >
                          {u.is_active ? "Activo" : "Suspendido"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleToggleStatus(u.id, u.is_active)}
                            disabled={u.id === user?.id}
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 px-2.5 rounded-md text-[10px] font-mono font-semibold transition-colors gap-1.5",
                              u.is_active
                                ? "border-border text-muted-foreground hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            )}
                            title={u.id === user?.id ? "No puedes suspender tu propia cuenta" : undefined}
                          >
                            {u.is_active ? (
                              <>
                                <XCircle className="w-3 h-3" />
                                <span>Suspender</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Activar</span>
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={u.id === user?.id}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title={u.id === user?.id ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Operational Alerts and Proactive Monitoring */}
      {activeTab === "alerts" && user?.role === "ADMIN" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Card 1: Delivery Channel & Telegram Recipient */}
          <div className="lg:col-span-6 bg-card border border-border rounded-lg p-4 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Canal de Entrega Telegram (MTProto)</h3>
                <p className="text-xs text-muted-foreground">
                  Configurá el usuario o canal de administración que recibirá las alertas en tiempo real.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Destinatario Directo (@username o ID de Telegram)
                </label>
                <input
                  type="text"
                  placeholder="@Smpyt o 809438653"
                  value={localState.alertRecipient}
                  onChange={(e) => setLocalState((prev) => ({ ...prev, alertRecipient: e.target.value }))}
                  className="w-full bg-secondary/60 border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  La cuenta MTProto enviará un mensaje privado con el detalle del incidente a este destinatario.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  ID de Canal de Difusión Administrativo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="-100..."
                  value={localState.alertChannelId}
                  onChange={(e) => setLocalState((prev) => ({ ...prev, alertChannelId: e.target.value }))}
                  className="w-full bg-secondary/60 border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Si tenés un canal privado para el equipo de operaciones, agregá el ID con prefijo -100.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  onClick={handleTestAlert}
                  disabled={localState.isTestingAlert}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 flex items-center justify-center gap-1.5"
                >
                  <Send className={cn("w-3.5 h-3.5", localState.isTestingAlert && "animate-spin")} />
                  <span>{localState.isTestingAlert ? "Enviando..." : "Enviar Alerta de Prueba"}</span>
                </Button>
                <Button
                  onClick={handleSaveAlerts}
                  disabled={localState.isSavingAlerts}
                  size="sm"
                  className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{localState.isSavingAlerts ? "Guardando..." : "Guardar Configuración"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Card 2: Monitored Events & Triggers */}
          <div className="lg:col-span-6 bg-card border border-border rounded-lg p-4 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Eventos Críticos Monitoreados</h3>
                <p className="text-xs text-muted-foreground">
                  Elegí qué tipo de sucesos disparan notificaciones prioritarias a Telegram.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-medium text-foreground block">Rate-Limits y FloodWait</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Notifica cuando Telegram bloquea temporalmente por velocidad de subida/copia.
                  </span>
                </div>
                <Switch
                  checked={localState.notifyFloodWait}
                  onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, notifyFloodWait: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-medium text-foreground block">Fallos en Jobs de Migración</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Alerta cuando un job termina con estado FAILED debido a un error irrecuperable.
                  </span>
                </div>
                <Switch
                  checked={localState.notifyJobFailures}
                  onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, notifyJobFailures: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-medium text-foreground block">Compras y Altas VIP (Gatekeeper)</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Avisa en tiempo real cada vez que un webhook de Stripe/Crypto procesa un pase VIP.
                  </span>
                </div>
                <Switch
                  checked={localState.notifyVipPurchases}
                  onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, notifyVipPurchases: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-medium text-foreground block">Expulsiones Masivas</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Notifica auditoría al ejecutar la expulsión por lote de miembros VIP expirados.
                  </span>
                </div>
                <Switch
                  checked={localState.notifyEvictions}
                  onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, notifyEvictions: checked }))}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Multichannel Webhook Dispatcher (Discord, Slack, HTTP) */}
          <div className="lg:col-span-12">
            <WebhookManagerCard />
          </div>
        </div>
      )}

      {/* TAB 4: Disaster Recovery Snapshots and Backups */}
      {activeTab === "backups" && user?.role === "ADMIN" && (
        <BackupManagerCard />
      )}

      {/* TAB 5: Adaptive Rate Governor (AIMD Token Bucket) */}
      {activeTab === "governor" && user?.role === "ADMIN" && (
        <RateGovernorCard />
      )}

      {/* Confirmation Dialog (replaces browser window.confirm) */}
      {localState.confirmDialog && (
        <ConfirmDialog
          isOpen={localState.confirmDialog.isOpen}
          onClose={closeConfirm}
          onConfirm={localState.confirmDialog.onConfirm}
          title={localState.confirmDialog.title}
          description={localState.confirmDialog.description}
          confirmLabel={localState.confirmDialog.confirmLabel}
          variant={localState.confirmDialog.variant}
        />
      )}
    </div>
  );
};
