import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  Video,
  X,
  ShieldCheck,
  LogOut,
  UserCheck,
  ListOrdered,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuthStore } from "@/features/auth/application/useAuthStore";
import { BrandLogo } from "@/shared/components/BrandLogo";

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
    name: "Pipeline & Módulos",
    path: "/pipeline",
    icon: Sparkles,
  },
  {
    name: "Chats & Mensajes",
    path: "/chats",
    icon: MessageSquare,
  },
  {
    name: "Cola de Trabajos",
    path: "/jobs",
    icon: ListOrdered,
  },
  {
    name: "Auditoría del Sistema",
    path: "/audit",
    icon: ShieldCheck,
    minRole: "ADMIN",
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
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "OPERATOR":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  return (
    <div className="h-screen h-dvh bg-[#090a0e] text-zinc-200 flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile & Tablet Top Bar (< 1024px) */}
      <div className="lg:hidden flex items-center justify-between p-3.5 bg-[#0e1015] border-b border-zinc-800 z-40 flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <BrandLogo size="md" />
          <span className="font-semibold text-sm text-zinc-100">Telegram Hub</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile & Tablet Backdrop Overlay (< 1024px) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation: Drawer on < lg, Pinned on >= lg */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#0e1015] border-r border-zinc-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:h-full lg:flex-shrink-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="p-3.5 px-4 border-b border-zinc-800 flex items-center space-x-2.5 flex-shrink-0">
          <BrandLogo size="md" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100 leading-none">
              Telegram Hub
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase mt-1 block">
              Multi-Module Admin
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Navegación principal" className="flex-1 min-h-0 p-2.5 px-3 space-y-1 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
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
                    "flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors group",
                    isActive
                      ? "bg-zinc-800/80 text-white border border-zinc-700/80"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-2.5">
                      <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-cyan-400" : "text-zinc-400 group-hover:text-zinc-300")} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Identity & RBAC Pill */}
        <div className="p-2.5 mx-2.5 mb-2 rounded-lg bg-[#13151d] border border-zinc-800 space-y-1.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="p-1 rounded-md bg-zinc-900 border border-zinc-800 text-cyan-400">
                <UserCheck className="w-3.5 h-3.5" />
              </span>
              <div className="truncate">
                <span className="text-xs font-medium text-zinc-200 block truncate">
                  {user?.email || "admin@telegramhub.local"}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 rounded-md hover:bg-rose-500/10 hover:text-rose-400 text-zinc-500 transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-mono">Rol Activo:</span>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold",
                getRoleBadgeColor(user?.role)
              )}
            >
              {user?.role || "ADMIN"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 relative z-10 px-2.5 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5 overflow-y-auto lg:overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
