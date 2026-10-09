import React, { useEffect, useState } from "react";
import {
  Settings,
  Database,
  Cpu,
  Globe,
  Lock,
  Plus,
  KeyRound,
  Check,
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
import { useAuthStore } from "@/features/auth/application/useAuthStore";
import { Role } from "@/features/auth/domain/types";
import { cn } from "@/shared/lib/utils";

export const SettingsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Active tab navigation between Credentials and User Management
  const [activeTab, setActiveTab] = useState<"credentials" | "users">("credentials");
  // Hook 2: Temporary action feedback banner
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const accounts = useAuthStore((state) => state.accounts);
  const usersList = useAuthStore((state) => state.usersList);
  const loadAccounts = useAuthStore((state) => state.loadAccounts);
  const loadUsers = useAuthStore((state) => state.loadUsers);
  const saveCredentials = useAuthStore((state) => state.saveCredentials);
  const createUser = useAuthStore((state) => state.createUser);
  const updateUser = useAuthStore((state) => state.updateUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadAccounts();
    if (user?.role === "ADMIN") {
      loadUsers();
    }
  }, [loadAccounts, loadUsers, user]);

  const showFeedback = (message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => setFeedback(null), 3500);
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-cyan-400" />
            Configuración del Sistema
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión de seguridad RBAC, credenciales de Telegram y telemetría de microservicios.
          </p>
        </div>

        {/* Tab Switcher for Admins */}
        {user?.role === "ADMIN" && (
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950/80 border border-white/5 rounded-2xl">
            <button
              onClick={() => setActiveTab("credentials")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "credentials"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-950/40"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Credenciales Telegram
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                activeTab === "users"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-950/40"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Gestión de Usuarios (RBAC)
            </button>
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={cn(
            "p-3 rounded-2xl text-xs flex items-center gap-2 transition-all",
            feedback.isError
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          )}
        >
          {feedback.isError ? <XCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TAB 1: Telegram Credentials Form */}
      {activeTab === "credentials" && user?.role === "ADMIN" && (
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <KeyRound className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">Vincular Nueva Cuenta de Telegram</h2>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Las credenciales se cifran en reposo con AES-256 en PostgreSQL 18
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
              <Lock className="w-3 h-3" /> Cifrado At-Rest
            </span>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Etiqueta de la Cuenta</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Ej: Cuenta Producción / Personal"
                  defaultValue="Cuenta Principal"
                  required
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Teléfono (Opcional)</label>
                <input
                  name="phone"
                  type="text"
                  placeholder="+54 9 11 1234-5678"
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Telegram API ID <span className="text-rose-400">*</span>
                </label>
                <input
                  name="api_id"
                  type="text"
                  placeholder="Ej: 12345678"
                  required
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Telegram API Hash <span className="text-rose-400">*</span>
                </label>
                <input
                  name="api_hash"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  required
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">
                Session String MTProto (Opcional)
              </label>
              <textarea
                name="session_string"
                rows={2}
                placeholder="1BVtsOHQBu7... (Session string exportada)"
                className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              size="sm"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl px-5 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar Credenciales Cifradas</span>
            </Button>
          </form>

          {/* Configured Accounts Table */}
          {accounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
              <span className="text-xs font-bold text-zinc-300 block">Cuentas Registradas:</span>
              <div className="rounded-2xl bg-zinc-950/60 border border-white/5 overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/[0.02]">
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableHead className="text-zinc-400 font-semibold">Nombre de Cuenta</TableHead>
                      <TableHead className="text-zinc-400 font-semibold">Credenciales En Reposo</TableHead>
                      <TableHead className="text-right text-zinc-400 font-semibold">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc) => (
                      <TableRow key={acc.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="font-semibold text-white text-xs">{acc.name}</TableCell>
                        <TableCell className="text-[10px] text-zinc-400 font-mono">
                          API ID: {acc.api_id_masked} · Hash: {acc.api_hash_masked}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="admin">Activa</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Interactive User Management (RBAC) */}
      {activeTab === "users" && user?.role === "ADMIN" && (
        <div className="space-y-5">
          {/* Create User Card */}
          <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <UserPlus className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">Dar de Alta Nuevo Usuario</h2>
                <span className="text-[10px] text-zinc-400">
                  Crea accesos individuales y asigna roles de ejecución controlados
                </span>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Email del Usuario</label>
                <input
                  name="email"
                  type="email"
                  placeholder="operador@telegramhub.local"
                  required
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Contraseña Inicial</label>
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Rol de Ejecución</label>
                <Select name="role" defaultValue="OPERATOR">
                  <SelectTrigger className="w-full bg-zinc-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:ring-1 focus:ring-cyan-500/50 h-[38px]">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14161F] border border-white/10 text-xs">
                    <SelectItem value="OPERATOR">OPERATOR (Clonador y Chats)</SelectItem>
                    <SelectItem value="VIEWER">VIEWER (Solo Lectura)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Acceso Total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl px-5 text-xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Usuario</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Users Table Card */}
          <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Users className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-white">Usuarios del Sistema</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                Total: <strong className="text-zinc-200">{usersList.length}</strong>
              </span>
            </div>

            <div className="rounded-2xl bg-zinc-950/60 border border-white/5 overflow-hidden">
              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-zinc-400 font-semibold w-2/5">Usuario</TableHead>
                    <TableHead className="text-zinc-400 font-semibold">Rol Asignado</TableHead>
                    <TableHead className="text-zinc-400 font-semibold">Estado</TableHead>
                    <TableHead className="text-right text-zinc-400 font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((u) => (
                    <TableRow key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-zinc-300 text-xs flex-shrink-0">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-xs truncate">{u.email}</span>
                              {u.id === user?.id && (
                                <Badge variant="outline" className="text-[9px] text-cyan-400 bg-cyan-500/10 border-cyan-500/30">
                                  Tú
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block">ID: #{u.id}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="w-36">
                          <Select
                            value={u.role}
                            onValueChange={(val) => handleRoleChange(u.id, val as Role)}
                            disabled={u.id === user?.id}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-8 px-2.5 text-[10px] font-mono font-bold rounded-xl border shadow-sm transition-colors",
                                getRoleBadgeStyle(u.role)
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#14161F] border border-white/10 text-xs">
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                              <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                              <SelectItem value="VIEWER">VIEWER</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge
                          variant={u.is_active ? "admin" : "destructive"}
                          className="text-[10px]"
                        >
                          {u.is_active ? "Activo" : "Suspendido"}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <Button
                          onClick={() => handleToggleStatus(u.id, u.is_active)}
                          disabled={u.id === user?.id}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 px-3 rounded-xl text-[10px] font-mono font-semibold transition-colors gap-1.5",
                            u.is_active
                              ? "border-white/10 text-zinc-400 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          )}
                          title={u.id === user?.id ? "No puedes suspender tu propia cuenta" : undefined}
                        >
                          {u.is_active ? (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Suspender</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Activar</span>
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Infrastructure Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono text-emerald-400">Puerto 7902</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">PostgreSQL 18</h3>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              Usuarios, Roles (RBAC) y Cuentas Cifradas
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-white/5">
            Docker: telegram_migrator_postgres
          </div>
        </div>

        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono text-cyan-400">Puerto 7901</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">FastAPI Core</h3>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              Clean Architecture · Telethon MTProto
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-white/5">
            Docker: telegram_migrator_backend
          </div>
        </div>

        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono text-emerald-400">Puerto 7900</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Frontend SPA</h3>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              React Router v7 · Radix UI · Tailwind
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-white/5">
            Docker: telegram_migrator_frontend
          </div>
        </div>
      </div>
    </div>
  );
};
