import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Home, MonitorSmartphone, TrendingUp, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import RealSSAChat from './RealSSAChat';

const tabs = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Trending', icon: TrendingUp, path: '/trending' },
  { label: 'Browser', icon: MonitorSmartphone, path: '/browser' },
  { label: 'Bookmarks', icon: Bookmark, path: '/bookmarks' },
  { label: 'Profile', icon: User, path: '/profile' },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/browser') || location.pathname.startsWith('/reels')) return null;

  return (
    <>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <nav
        className="fixed inset-x-0 bottom-0 z-[9998] border-t border-border/80 bg-background/96 backdrop-blur-2xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="relative mx-auto grid h-[68px] max-w-[520px] grid-cols-5 px-1">
          {tabs.map(({ label, icon: Icon, path }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            const isBrowser = path === '/browser';
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] transition-transform active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={cn(
                  'grid h-9 w-9 place-items-center rounded-xl border transition-all',
                  isBrowser && 'h-11 w-11 -translate-y-2 rounded-2xl border-primary/35 bg-primary text-primary-foreground shadow-[0_8px_26px_rgba(245,158,11,0.28)]',
                  isBrowser && !isActive && 'bg-primary/10 text-primary',
                  !isBrowser && isActive && 'border-primary/20 bg-primary/10',
                  !isBrowser && !isActive && 'border-transparent'
                )}>
                  <Icon size={isBrowser ? 20 : 19} strokeWidth={isActive ? 2.5 : 1.9} />
                </span>
                <span className={cn(isBrowser && '-mt-2', !isActive && 'opacity-75')}>{label}</span>
                {isActive && !isBrowser && <span className="absolute bottom-1.5 h-0.5 w-5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
