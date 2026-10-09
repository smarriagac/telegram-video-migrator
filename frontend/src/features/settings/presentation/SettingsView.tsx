import React, { useState } from "react";
import {
  Settings,
  Shield,
  Database,
  Cpu,
  Globe,
  CheckCircle2,
  RefreshCw,
  Server,
  Layers,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export const SettingsView: React.FC = () => {
  // Strict rule: maximum 2 useState hooks per view.
  // We use 1 hook for simulated cache reload feedback.
  const [refreshed, setRefreshed] = useState(false);

  const handleRefresh = () => {
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-cyan-400" />
          Configuración del Sistema
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Parámetros operativos de MTProto, base de datos SQLite y entorno Docker.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Telegram MTProto Gateway Card */}
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Shield className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white">Sesión MTProto</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Activa
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
              <span className="text-zinc-400">Nombre de Sesión:</span>
              <span className="font-mono text-zinc-200">telethon_user.session</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
              <span className="text-zinc-400">Modo de Copia:</span>
              <span className="font-semibold text-cyan-400">Zero-Download (InputDocument)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
              <span className="text-zinc-400">FloodWait Manejo:</span>
              <span className="font-mono text-emerald-400">Exponencial / Auto-Pause</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-zinc-400">Cifrado de Capa:</span>
              <span className="font-mono text-zinc-200">MTProto 2.0 (Diffie-Hellman)</span>
            </div>
          </div>
        </div>

        {/* Database & Storage Card */}
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Database className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white">Persistencia & Idempotencia</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
              WAL Mode
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
              <span className="text-zinc-400">Motor de Base de Datos:</span>
              <span className="font-mono text-zinc-200">SQLite (aiosqlite Async)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
              <span className="text-zinc-400">Ubicación de Datos:</span>
              <span className="font-mono text-zinc-300">/app/data/migration.db</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
              <span className="text-zinc-400">Tabla de Idempotencia:</span>
              <span className="font-mono text-emerald-400">migration_items</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-zinc-400">Checkpoints Automáticos:</span>
              <span className="font-mono text-zinc-200">Por mensaje migrado</span>
            </div>
          </div>
        </div>

        {/* Docker & Infrastructure Card */}
        <div className="bg-[#14161F] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4 md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Server className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white">Infraestructura de Contenedores</h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              Rango de Puertos: <strong className="text-white">790x</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1 font-mono">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Frontend SPA (Nginx)
              </div>
              <div className="text-sm font-bold text-white font-mono">Puerto 7900</div>
              <span className="text-[10px] text-zinc-500">React Router v7 + Tailwind</span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1 font-mono">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                Backend API (FastAPI)
              </div>
              <div className="text-sm font-bold text-white font-mono">Puerto 7901</div>
              <span className="text-[10px] text-zinc-500">Uvicorn + Clean Architecture</span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1 font-mono">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Event Stream (SSE)
              </div>
              <div className="text-sm font-bold text-white font-mono">/api/events/stream</div>
              <span className="text-[10px] text-emerald-400">proxy_buffering off</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Todos los microservicios están sincronizados y auditados bajo Spec-Driven Development.
            </span>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="rounded-xl border-white/10 text-xs hover:bg-white/5"
            >
              {refreshed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Sincronizado
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                  Verificar Estado
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
