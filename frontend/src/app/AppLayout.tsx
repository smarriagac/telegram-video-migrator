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
  Radio,
  BarChart3,
  ChevronDown,
  Sun,
  Moon,
  CreditCard,
  Tv,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuthStore } from "@/features/auth/application/useAuthStore";
import { useThemeStore } from "@/shared/lib/useThemeStore";
import { BrandLogo } from "@/shared/components/BrandLogo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

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
    name: "Sincronización en Vivo",
    path: "/sync",
    icon: Radio,
  },
  {
    name: "Administrar Canales",
    path: "/channels",
    icon: Tv,
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
    name: "Analíticas & Rendimiento",
    path: "/analytics",
    icon: BarChart3,
  },
  {
    name: "Suscripción & Planes",
    path: "/billing",
    icon: CreditCard,
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
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30";
      case "OPERATOR":
        return "bg-primary/15 text-primary border-primary/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const userInitials = (user?.email?.slice(0, 2) || "AD").toUpperCase();

  return (
    <div className="h-screen h-dvh bg-background text-foreground flex flex-col lg:flex-row overflow-hidden transition-colors duration-200">
      {/* Mobile & Tablet Top Bar (< 1024px) */}
      <div className="lg:hidden flex items-center justify-between p-3 px-3.5 bg-card/95 backdrop-blur border-b border-border z-40 flex-shrink-0">
        {/* Left: Drawer Toggle Button alongside Brand Logo & Title */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <BrandLogo size="md" />
          <span className="font-semibold text-sm text-foreground">Telegram Hub</span>
        </div>

        {/* Right: User Avatar with Theme Toggle & Logout Dropdown Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 p-1 pl-1.5 pr-2 rounded-full bg-muted/80 border border-border hover:border-primary/50 text-foreground transition-all select-none focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Menú de usuario"
            >
              <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-mono text-[10px] font-bold">
                {userInitials}
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-64 p-3 bg-popover border border-border shadow-2xl rounded-lg text-popover-foreground"
          >
            {/* User Identity Header */}
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-mono text-xs font-bold shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {user?.email ? user.email.split("@")[0] : "Admin"}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {user?.email || "admin@telegramhub.local"}
                </p>
              </div>
            </div>

            {/* Role Badge */}
            <div className="flex items-center justify-between py-2 border-b border-border/60 text-[11px]">
              <span className="text-muted-foreground font-mono">Rol Activo:</span>
              <span
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold",
                  getRoleBadgeColor(user?.role)
                )}
              >
                {user?.role || "ADMIN"}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <div className="py-2 border-b border-border/60">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span>{theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono uppercase">
                  {theme}
                </span>
              </button>
            </div>

            {/* Logout Action */}
            <div className="pt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile & Tablet Backdrop Overlay (< 1024px) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation: Drawer on < lg, Pinned on >= lg */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:h-full lg:flex-shrink-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="p-3.5 px-4 border-b border-border flex items-center space-x-2.5 flex-shrink-0">
          <BrandLogo size="md" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground leading-none">
              Telegram Hub
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase mt-1 block">
              Multi-Module Admin
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Navegación principal" className="flex-1 min-h-0 p-2.5 px-3 space-y-1 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-semibold">
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
                      ? "bg-primary/10 text-primary border border-primary/25 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-2.5">
                      <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Identity & Theme Toggle & RBAC Pill */}
        <div className="p-2.5 mx-2.5 mb-2 rounded-lg bg-muted/40 border border-border space-y-1.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="p-1 rounded-md bg-card border border-border text-primary">
                <UserCheck className="w-3.5 h-3.5" />
              </span>
              <div className="truncate">
                <span className="text-xs font-medium text-foreground block truncate">
                  {user?.email || "admin@telegramhub.local"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-primary" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="p-1 rounded-md hover:bg-rose-500/10 hover:text-rose-400 text-muted-foreground transition-colors"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <span className="text-[10px] text-muted-foreground font-mono">Rol Activo:</span>
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
      <main className="flex-1 min-h-0 relative z-10 px-2.5 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5 overflow-y-auto lg:overflow-hidden flex flex-col bg-background">
        <Outlet />
      </main>
    </div>
  );
};
