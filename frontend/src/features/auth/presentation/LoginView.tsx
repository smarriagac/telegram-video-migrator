import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../application/useAuthStore";
import { Button } from "@/shared/components/ui/button";
import { BrandLogo } from "@/shared/components/BrandLogo";

export const LoginView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  const [email, setEmail] = useState<string>("admin@telegramhub.local");
  const [password, setPassword] = useState<string>("admin1234");

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    const ok = await login(email, password);
    if (ok) {
      navigate("/migration", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col justify-center items-center px-4 relative selection:bg-cyan-500 selection:text-black">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm bg-[#14161F] border border-white/5 rounded-xl p-5 shadow-2xl space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <BrandLogo size="lg" className="w-12 h-12" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">Telegram Hub</h1>
          <p className="text-[11px] text-zinc-400 font-mono">
            Panel de Administración & Control RBAC
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300 block">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@telegramhub.local"
                required
                className="w-full bg-zinc-950/80 border border-white/10 rounded-md pl-9 pr-3 py-1.5 h-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-300 block">Contraseña</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-zinc-950/80 border border-white/10 rounded-md pl-9 pr-3 py-1.5 h-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-md h-8 text-xs flex items-center justify-center gap-2 mt-1 shadow-md shadow-cyan-950/40"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Acceder al Panel</span>
            )}
          </Button>
        </form>

        {/* Security Badge */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Sesión Cifrada
          </span>
          <span>PostgreSQL · RBAC</span>
        </div>
      </div>
    </div>
  );
};
