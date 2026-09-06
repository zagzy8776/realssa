import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Home, TrendingUp, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import RealSSAChat from './RealSSAChat';

const tabs = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Trending', icon: TrendingUp, path: '/trending' },
  { label: 'Bookmarks', icon: Bookmark, path: '/bookmarks' },
  { label: 'Profile', icon: User, path: '/profile' },
];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  if (
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/browser') ||
    location.pathname.startsWith('/reels')
  ) return null;

  return (
    <>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-border bg-background/96 backdrop-blur-2xl md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2px)' }}
        aria-label="Mobile navigation"
      >
        <div className="relative mx-auto grid h-16 max-w-[520px] grid-cols-5 px-1">
          {tabs.slice(0, 2).map(({ label, icon: Icon, path }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all duration-200 active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className={cn(isActive ? 'opacity-100' : 'opacity-75')}>{label}</span>
                {isActive && <span className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />}
              </button>
            );
          })}

          <div className="relative flex items-center justify-center">
            <button
              onClick={() => setChatOpen(true)}
              className="absolute -top-5 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-background/90 text-black transition-all duration-200 active:scale-90 hover:scale-105"
              style={{
                background: 'linear-gradient(145deg, #FBBF24 0%, #F59E0B 45%, #D97706 100%)',
                boxShadow: '0 0 0 2px rgba(245,158,11,0.28), 0 0 22px rgba(245,158,11,0.5), 0 0 44px rgba(245,158,11,0.14), inset 0 1px 0 rgba(255,255,255,0.38)',
              }}
              aria-label="Open RealSSA Assistant"
            >
              <span className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)' }} />
              <Sparkles className="relative z-10 h-4 w-4 text-black" strokeWidth={2.5} />
              <span className="relative z-10 text-[7px] font-black uppercase tracking-wider leading-none">RealSSA</span>
            </button>
          </div>

          {tabs.slice(2).map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all duration-200 active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className={cn(isActive ? 'opacity-100' : 'opacity-75')}>{label}</span>
                {isActive && <span className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
