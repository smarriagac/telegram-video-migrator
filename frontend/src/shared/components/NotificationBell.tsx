import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { notificationApi, AppNotification } from "@/shared/infrastructure/notificationApi";

interface NotificationsState {
  isOpen: boolean;
  unreadCount: number;
  items: AppNotification[];
  isLoading: boolean;
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();

  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Core notification data and popover status
  const [notificationsState, setNotificationsState] = useState<NotificationsState>({
    isOpen: false,
    unreadCount: 0,
    items: [],
    isLoading: false,
  });

  // Hook 2: Filter selection (all vs unread only)
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadUnreadCount = useCallback(async () => {
    const count = await notificationApi.getUnreadCount();
    setNotificationsState((prev) => ({ ...prev, unreadCount: count }));
  }, []);

  const loadItems = useCallback(async () => {
    setNotificationsState((prev) => ({ ...prev, isLoading: true }));
    const items = await notificationApi.listNotifications(filter === "unread");
    setNotificationsState((prev) => ({
      ...prev,
      items,
      isLoading: false,
    }));
  }, [filter]);

  // Periodic unread count polling every 20 seconds
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 20000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // Reload items when popover opens or filter changes
  useEffect(() => {
    if (notificationsState.isOpen) {
      loadItems();
    }
  }, [notificationsState.isOpen, filter, loadItems]);

  const handleOpenChange = (open: boolean) => {
    setNotificationsState((prev) => ({ ...prev, isOpen: open }));
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ok = await notificationApi.markAsRead(id);
    if (ok) {
      setNotificationsState((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        items: prev.items.map((it) => (it.id === id ? { ...it, is_read: true } : it)),
      }));
    }
  };

  const handleMarkAllAsRead = async () => {
    const marked = await notificationApi.markAllAsRead();
    if (marked > 0 || notificationsState.unreadCount > 0) {
      setNotificationsState((prev) => ({
        ...prev,
        unreadCount: 0,
        items: prev.items.map((it) => ({ ...it, is_read: true })),
      }));
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await handleMarkAsRead(notif.id);
    }
    if (notif.link) {
      setNotificationsState((prev) => ({ ...prev, isOpen: false }));
      navigate(notif.link);
    }
  };

  const renderSeverityIcon = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "ERROR":
      case "CRITICAL":
        return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />;
      case "WARNING":
        return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
      case "SUCCESS":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-primary shrink-0" />;
    }
  };

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 60) return "Ahora";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
      return `${Math.floor(diffSec / 86400)}d`;
    } catch {
      return "";
    }
  };

  return (
    <Popover open={notificationsState.isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Centro de Notificaciones"
          aria-label="Abrir notificaciones"
        >
          <Bell className="w-4 h-4" />
          {notificationsState.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse font-mono">
              {notificationsState.unreadCount > 99 ? "99+" : notificationsState.unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 bg-card border-border shadow-xl rounded-lg overflow-hidden flex flex-col max-h-[500px]"
      >
        {/* Header */}
        <div className="p-3 border-b border-border bg-secondary/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-primary" />
              Notificaciones
            </span>
            {notificationsState.unreadCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-400 border-rose-500/30 font-mono">
                {notificationsState.unreadCount} sin leer
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {notificationsState.unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary font-medium"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Marcar leídas</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 py-1.5 border-b border-border bg-background flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filter === "all"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filter === "unread"
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            No leídas
          </button>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 min-h-0 max-h-80">
          {notificationsState.isLoading ? (
            <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span className="text-[11px] font-mono">Cargando alertas...</span>
            </div>
          ) : notificationsState.items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-1">
              <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500/50 mb-1" />
              <p className="text-xs font-medium text-foreground">Bandeja despejada</p>
              <p className="text-[11px] text-muted-foreground">
                {filter === "unread" ? "No tenés notificaciones pendientes." : "No hay eventos registrados recientemente."}
              </p>
            </div>
          ) : (
            notificationsState.items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3 text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                  item.is_read
                    ? "bg-background/40 hover:bg-secondary/40 opacity-75"
                    : "bg-secondary/20 hover:bg-secondary/50"
                }`}
              >
                <div className="mt-0.5">{renderSeverityIcon(item.severity)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-medium truncate ${item.is_read ? "text-foreground" : "text-foreground font-semibold"}`}>
                      {item.title}
                    </p>
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    {item.link ? (
                      <span className="text-[10px] text-primary flex items-center gap-1 font-medium hover:underline">
                        <span>Ver detalle</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    ) : <span />}

                    {!item.is_read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        className="text-[10px] text-muted-foreground hover:text-foreground font-mono"
                        title="Marcar como leída"
                      >
                        ✓ Leída
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
