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
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAuthStore } from "@/features/auth/application/useAuthStore";

export const SettingsView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Saved feedback notification
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  // Hook 2: Error message or toggle
  const [formError, setFormError] = useState<string | null>(null);

  const accounts = useAuthStore((state) => state.accounts);
  const loadAccounts = useAuthStore((state) => state.loadAccounts);
  const saveCredentials = useAuthStore((state) => state.saveCredentials);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSaveCredentials = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string) || "Cuenta Principal";
    const phone = (formData.get("phone") as string) || "";
    const api_id = (formData.get("api_id") as string) || "";
    const api_hash = (formData.get("api_hash") as string) || "";
    const session_string = (formData.get("session_string") as string) || "";

    if (!api_id.trim() || !api_hash.trim()) {
      setFormError("API ID y API Hash son obligatorios.");
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
      setSavedSuccess(true);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setFormError("No se pudieron guardar las credenciales.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-cyan-400" />
          Configuración & Credenciales de Telegram
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Gestión de credenciales cifradas en PostgreSQL (AES-256) y telemetría de microservicios.
        </p>
      </div>

      {/* Admin Credentials Management Form */}
      {user?.role === "ADMIN" && (
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <KeyRound className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">Vincular Nueva Cuenta de Telegram</h2>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Las credenciales se cifran en reposo con AES-256 en PostgreSQL
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
              <Lock className="w-3 h-3" /> Cifrado At-Rest
            </span>
          </div>

          {savedSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Credenciales cifradas y guardadas con éxito en PostgreSQL.</span>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {formError}
            </div>
          )}

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
                Session String MTProto (Opcional si ya la posees)
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
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
              <span className="text-xs font-bold text-zinc-300 block">Cuentas Registradas:</span>
              <div className="divide-y divide-white/5 rounded-2xl bg-zinc-950/60 border border-white/5 overflow-hidden">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white block">{acc.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        API ID: {acc.api_id_masked} · Hash: {acc.api_hash_masked}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Activa
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Infrastructure Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* PostgreSQL Card */}
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono text-emerald-400">Puerto 7902</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">PostgreSQL 16</h3>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              Usuarios, Roles (RBAC) y Cuentas Cifradas
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-white/5">
            Docker: telegram_migrator_postgres
          </div>
        </div>

        {/* Backend FastAPI Card */}
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

        {/* Frontend Nginx Card */}
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
