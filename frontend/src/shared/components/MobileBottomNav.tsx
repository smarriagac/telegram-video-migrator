import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Video, Tv, Clock, Menu } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useSidebar } from '@/shared/components/ui/sidebar';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();

  const navItems = [
    {
      to: '/chats',
      label: 'Chats',
      icon: MessageSquare,
      isActive: location.pathname === '/chats' || location.pathname.startsWith('/chats/'),
    },
    {
      to: '/migration',
      label: 'Clonar',
      icon: Video,
      isActive: location.pathname === '/migration',
    },
    {
      to: '/channels',
      label: 'Canales',
      icon: Tv,
      isActive: location.pathname === '/channels',
    },
    {
      to: '/jobs',
      label: 'Trabajos',
      icon: Clock,
      isActive: location.pathname === '/jobs',
    },
  ];

  const isMoreActive = [
    '/sync',
    '/pipeline',
    '/analytics',
    '/billing',
    '/audit',
    '/settings',
  ].includes(location.pathname);

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#090A0F]/95 backdrop-blur-md border-t border-border/70 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center h-full w-full py-1 text-[10px] font-medium transition-colors cursor-pointer select-none',
                item.isActive
                  ? 'text-cyan-400 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('size-5 transition-transform', item.isActive && 'scale-110')} />
                {item.isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                )}
              </div>
              <span className="mt-1 truncate">{item.label}</span>
            </NavLink>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex flex-col items-center justify-center h-full w-full py-1 text-[10px] font-medium transition-colors cursor-pointer select-none',
            isMoreActive
              ? 'text-cyan-400 font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="Abrir menú completo"
        >
          <div className="relative">
            <Menu className={cn('size-5 transition-transform', isMoreActive && 'scale-110')} />
            {isMoreActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            )}
          </div>
          <span className="mt-1 truncate">Más</span>
        </button>
      </div>
    </nav>
  );
};
