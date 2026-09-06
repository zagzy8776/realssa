import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Home, Sparkles, TrendingUp, User } from 'lucide-react';
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
        className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-border bg-background md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="relative mx-auto grid h-[60px] max-w-[520px] grid-cols-5">
          {tabs.slice(0, 2).map(({ label, icon: Icon, path }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-[0.04em]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                <span>{label}</span>
                {isActive && <span className="absolute bottom-1 h-0.5 w-4 bg-primary" />}
              </button>
            );
          })}

          <div className="relative flex items-center justify-center">
            <button
              onClick={() => setChatOpen(true)}
              className="absolute -top-3.5 left-1/2 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-xl border-2 border-background bg-primary text-primary-foreground shadow-[0_5px_16px_rgba(0,0,0,0.2)]"
              aria-label="Open RealSSA Assistant"
            >
              <Sparkles size={18} strokeWidth={2.3} />
            </button>
            <span className="mt-7 text-[9px] font-bold tracking-[0.04em] text-primary">Assistant</span>
          </div>

          {tabs.slice(2).map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-[0.04em]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
                <span>{label}</span>
                {isActive && <span className="absolute bottom-1 h-0.5 w-4 bg-primary" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
