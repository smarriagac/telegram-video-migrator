import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  MessageSquare,
  Settings,
  Tv2,
  Video,
  X,
  ShieldCheck,
  LogOut,
  UserCheck,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuthStore } from "@/features/auth/application/useAuthStore";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  minRole?: "ADMIN" | "OPERATOR" | "VIEWER";
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Clonador de Videos",
    path: "/migration",
    icon: Video,
  },
  {
    name: "Chats & Mensajes",
    path: "/chats",
    icon: MessageSquare,
  },
  {
    name: "Configuración & API",
    path: "/settings",
    icon: Settings,
    minRole: "ADMIN",
  },
];

export const AppLayout: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const getRoleBadgeColor = (role?: string) => {
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
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col md:flex-row selection:bg-cyan-500 selection:text-black">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#14161F]/90 backdrop-blur-md border-b border-white/5 z-40">
        <div className="flex items-center space-x-2.5">
          <span className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Tv2 className="w-5 h-5" />
          </span>
          <span className="font-bold text-sm text-white">Telegram Hub</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-300"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#10121A]/95 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-200 md:static md:translate-x-0 shadow-2xl",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5 flex items-center space-x-3">
          <span className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-950/50">
            <Tv2 className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white leading-none">
              Telegram Hub
            </h2>
            <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase mt-1 block">
              Multi-Module Admin
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Navegación principal" className="flex-1 p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
            Módulos del Sistema
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            // Filter out admin routes for non-admins
            if (item.minRole === "ADMIN" && user && user.role !== "ADMIN") {
              return null;
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group",
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-950/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  )
                }
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Identity & RBAC Pill */}
        <div className="p-3 mx-3 mb-2 rounded-2xl bg-zinc-950/80 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="p-1.5 rounded-lg bg-zinc-900 text-cyan-400">
                <UserCheck className="w-3.5 h-3.5" />
              </span>
              <div className="truncate">
                <span className="text-xs font-bold text-zinc-200 block truncate">
                  {user?.email || "admin@telegramhub.local"}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-400 text-zinc-500 transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
            <span className="text-[10px] text-zinc-500 font-mono">Rol Activo:</span>
            <span
              className={cn(
                "text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold",
                getRoleBadgeColor(user?.role)
              )}
            >
              {user?.role || "ADMIN"}
            </span>
          </div>
        </div>

        {/* Status / Infrastructure Footer */}
        <div className="p-3 border-t border-white/5 m-3 rounded-2xl bg-zinc-950/60 border text-[10px] font-mono text-zinc-500 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">PostgreSQL:</span>
            <span className="text-emerald-400">7902 · Online</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Backend API:</span>
            <span className="text-cyan-400">7901 · FastAPI</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Cifrado AES-256
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 px-4 py-8 md:px-10 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
