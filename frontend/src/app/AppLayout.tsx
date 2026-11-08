import React, { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  Settings,
  Video,
  ShieldCheck,
  LogOut,
  BarChart3,
  ChevronDown,
  ChevronsUpDown,
  Sun,
  Moon,
  CreditCard,
  Tv,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuthStore } from "@/features/auth/application/useAuthStore";
import { useThemeStore } from "@/shared/lib/useThemeStore";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { NotificationBell } from "@/shared/components/NotificationBell";
import { Separator } from "@/shared/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/shared/components/ui/sidebar";

const ROUTE_META: Record<string, { domain: string; module: string }> = {
  "/chats": { domain: "Canales & Audiencia", module: "Chats & Mensajes" },
  "/channels": { domain: "Canales & Audiencia", module: "Administrar Canales" },
  "/migration": { domain: "Clonación & Pipeline", module: "Clonador de Videos" },
  "/sync": { domain: "Clonación & Pipeline", module: "Sincronización en Vivo" },
  "/pipeline": { domain: "Clonación & Pipeline", module: "Pipeline & Reglas" },
  "/jobs": { domain: "Clonación & Pipeline", module: "Cola de Trabajos" },
  "/analytics": { domain: "Plataforma & Control", module: "Analíticas & Rendimiento" },
  "/billing": { domain: "Plataforma & Control", module: "Suscripción & Planes" },
  "/audit": { domain: "Plataforma & Control", module: "Auditoría del Sistema" },
  "/settings": { domain: "Plataforma & Control", module: "Configuración & API" },
};

export const AppLayout: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used)
  const [cloningMenuOpen, setCloningMenuOpen] = useState(true);

  const location = useLocation();
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
  const isCloningActive = ["/migration", "/sync", "/pipeline", "/jobs"].includes(location.pathname);
  const currentMeta = ROUTE_META[location.pathname] || {
    domain: "Telegram Hub",
    module: "Módulos",
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen h-dvh w-full flex overflow-hidden bg-background text-foreground transition-colors duration-200">
        <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
          {/* Header: Symmetrical h-16 Header matching Inset Top Bar */}
          <SidebarHeader className="h-16 border-b border-sidebar-border px-3 flex justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:items-center">
            <SidebarMenu className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary shrink-0">
                    <BrandLogo size="md" />
                  </div>
                  <div className="grid flex-1 text-left text-xs leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-foreground">Telegram Hub</span>
                    <span className="truncate text-[10px] text-muted-foreground font-mono">
                      Enterprise Suite
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          {/* Content: Domain Navigation */}
          <SidebarContent className="px-2 py-3 space-y-3 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:space-y-1">
            {/* Group 1: Canales & Audiencia */}
            <SidebarGroup className="group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-1">
              <SidebarGroupLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                Canales & Audiencia
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/chats"}
                      tooltip="Chats & Mensajes"
                    >
                      <NavLink
                        to="/chats"
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2",
                            isActive && "text-primary font-semibold"
                          )
                        }
                      >
                        <MessageSquare className="size-4 shrink-0" />
                        <span>Chats & Mensajes</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/channels"}
                      tooltip="Administrar Canales"
                    >
                      <NavLink
                        to="/channels"
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2",
                            isActive && "text-primary font-semibold"
                          )
                        }
                      >
                        <Tv className="size-4 shrink-0" />
                        <span>Administrar Canales</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Group 2: Clonación & Pipeline (Nested sub-menu with vertical tree line) */}
            <SidebarGroup className="group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-1">
              <SidebarGroupLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                Clonación & Pipeline
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCloningMenuOpen((prev) => !prev)}
                      isActive={isCloningActive}
                      tooltip="Motor de Clonación"
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Video className={cn("size-4 shrink-0", isCloningActive && "text-primary")} />
                        <span className={cn(isCloningActive && "font-semibold text-foreground")}>
                          Motor de Clonación
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
                          cloningMenuOpen ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </SidebarMenuButton>

                    {cloningMenuOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === "/migration"}
                          >
                            <NavLink to="/migration">
                              <span>Clonador de Videos</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === "/sync"}
                          >
                            <NavLink to="/sync">
                              <span>Sincronización en Vivo</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === "/pipeline"}
                          >
                            <NavLink to="/pipeline">
                              <span>Pipeline & Reglas</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === "/jobs"}
                          >
                            <NavLink to="/jobs">
                              <span>Cola de Trabajos</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Group 3: Plataforma & Control */}
            <SidebarGroup className="group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-1">
              <SidebarGroupLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                Plataforma & Control
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/analytics"}
                      tooltip="Analíticas & Rendimiento"
                    >
                      <NavLink
                        to="/analytics"
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2",
                            isActive && "text-primary font-semibold"
                          )
                        }
                      >
                        <BarChart3 className="size-4 shrink-0" />
                        <span>Analíticas & Rendimiento</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/billing"}
                      tooltip="Suscripción & Planes"
                    >
                      <NavLink
                        to="/billing"
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2",
                            isActive && "text-primary font-semibold"
                          )
                        }
                      >
                        <CreditCard className="size-4 shrink-0" />
                        <span>Suscripción & Planes</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {(!user || user.role === "ADMIN") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/audit"}
                        tooltip="Auditoría del Sistema"
                      >
                        <NavLink
                          to="/audit"
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2",
                              isActive && "text-primary font-semibold"
                            )
                          }
                        >
                          <ShieldCheck className="size-4 shrink-0" />
                          <span>Auditoría del Sistema</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {(!user || user.role === "ADMIN") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === "/settings"}
                        tooltip="Configuración & API"
                      >
                        <NavLink
                          to="/settings"
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2",
                              isActive && "text-primary font-semibold"
                            )
                          }
                        >
                          <Settings className="size-4 shrink-0" />
                          <span>Configuración & API</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer: User Identity & Actions */}
          <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <div className="flex items-center justify-between group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2 w-full">
              <div className="flex items-center gap-2 overflow-hidden min-w-0 group-data-[collapsible=icon]:justify-center">
                <div
                  className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-mono text-[11px] font-bold shrink-0"
                  title={user?.email || "Admin"}
                >
                  {userInitials}
                </div>
                <div className="truncate min-w-0 group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-medium text-foreground block truncate">
                    {user?.email || "admin@telegramhub.local"}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-mono px-1 py-0.2 rounded border font-semibold inline-block mt-0.5",
                      getRoleBadgeColor(user?.role)
                    )}
                  >
                    {user?.role || "ADMIN"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-md hover:bg-rose-500/10 hover:text-rose-400 text-muted-foreground transition-colors cursor-pointer group-data-[collapsible=icon]:hidden"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        {/* Main View Area with Top Bar & Trigger */}
        <SidebarInset className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
          {/* Top Inset Bar: Symmetrical h-16 Header matching SidebarHeader */}
          <header className="h-16 border-b border-border px-4 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">{currentMeta.domain}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentMeta.module}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden cursor-pointer"
                title="Cambiar tema"
              >
                {theme === "dark" ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-primary" />
                )}
              </button>
            </div>
          </header>

          {/* View Container */}
          <main className="flex-1 min-h-0 relative z-10 px-2.5 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5 overflow-y-auto lg:overflow-hidden flex flex-col bg-background">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
