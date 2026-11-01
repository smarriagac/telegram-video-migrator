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
    <div className="min-h-screen bg-[#090a0e] text-zinc-200 flex flex-col justify-center items-center px-4 relative">
      <div className="relative z-10 w-full max-w-sm bg-[#0e1015] border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <BrandLogo size="lg" className="w-12 h-12" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Telegram Hub</h1>
          <p className="text-xs text-zinc-400 font-mono">
            Panel de Administración & Control RBAC
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 block">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@telegramhub.local"
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 h-9 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 block">Contraseña</label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 h-9 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            variant="primary"
            className="w-full h-9 text-xs mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Acceder al Panel</span>
            )}
          </Button>
        </form>

        {/* Security Badge */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Sesión Cifrada
          </span>
          <span>PostgreSQL · RBAC</span>
        </div>
      </div>
    </div>
  );
};
