import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Bookmark, TrendingUp, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import RealSSAChat from './RealSSAChat';

const tabs = [
  { label: 'Home',      icon: Home,       path: '/' },
  { label: 'Trending',  icon: TrendingUp,  path: '/trending' },
  // center slot = RealSSA AI button
  { label: 'Bookmarks', icon: Bookmark,    path: '/bookmarks' },
  { label: 'Profile',   icon: User,        path: '/profile' },
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 supports-[backdrop-filter]:bg-background/70 backdrop-blur-xl border-t border-border/50 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {/* Left two tabs */}
          {tabs.slice(0, 2).map(({ label, icon: Icon, path }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-semibold tracking-wide uppercase transition-all duration-200 active:scale-95',
                  isActive ? 'text-amber-500' : 'text-muted-foreground'
                )}
                aria-label={label}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} className={cn('transition-transform duration-200', isActive && 'scale-110')} />
                <span className={cn(isActive ? 'opacity-100' : 'opacity-75')}>{label}</span>
                {isActive && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-amber-500" />}
              </button>
            );
          })}

          {/* Center — RealSSA AI floating button */}
          <div className="relative flex-1 flex items-center justify-center">
            <button
              onClick={() => setChatOpen(true)}
              className="absolute -top-8 w-14 h-14 rounded-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)] flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 hover:shadow-[0_0_28px_rgba(245,158,11,0.8)] border-2 border-background"
              aria-label="RealSSA AI"
            >
              <Sparkles className="w-5 h-5 text-black" strokeWidth={2.5} />
              <span className="text-[8px] font-black text-black uppercase tracking-wider leading-none">RealSSA</span>
            </button>
          </div>

          {/* Right two tabs */}
          {tabs.slice(2).map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-semibold tracking-wide uppercase transition-all duration-200 active:scale-95',
                  isActive ? 'text-amber-500' : 'text-muted-foreground'
                )}
                aria-label={label}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} className={cn('transition-transform duration-200', isActive && 'scale-110')} />
                <span className={cn(isActive ? 'opacity-100' : 'opacity-75')}>{label}</span>
                {isActive && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-amber-500" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
