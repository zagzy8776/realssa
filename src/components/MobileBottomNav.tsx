import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Film, Bot, Sparkles, TrendingUp, User } from 'lucide-react';
import RealSSAChat from './RealSSAChat';

interface NavTab {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  path: string;
  matchPaths?: string[];
}

const tabs: NavTab[] = [
  { label: 'Home', icon: Home, path: '/', matchPaths: ['/'] },
  { label: 'Cinema', icon: Film, path: '/videos', matchPaths: ['/videos', '/cinema', '/movies', '/video-news', '/live-tv'] },
  { label: 'For You', icon: Sparkles, path: '/for-you', matchPaths: ['/for-you'] },
  { label: 'Trending', icon: TrendingUp, path: '/trending', matchPaths: ['/trending'] },
  { label: 'Profile', icon: User, path: '/profile', matchPaths: ['/profile', '/reading-list', '/reading-history', '/downloads', '/bookmarks'] },
];

const HIDDEN_ROUTES = [
  '/admin', '/browser', '/reels', '/wire', '/search', '/article',
  '/edit-news', '/admin-dashboard', '/internal', '/post-news',
  '/verify-email', '/publisher', '/entity', '/market', '/events',
  '/widget', '/library', '/country', '/state', '/city',
  '/local-government', '/ads', '/download', '/login',
];

const spring = { type: 'spring' as const, stiffness: 600, damping: 28, mass: 0.55 };

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  const isHidden = HIDDEN_ROUTES.some(r => pathname.startsWith(r));

  const activeIndex = tabs.findIndex(tab =>
    tab.path === '/' ? pathname === '/' : tab.matchPaths?.some(p => pathname === p || pathname.startsWith(`${p}/`))
  );

  const indicatorSlot = activeIndex < 0 ? 0 : activeIndex < 2 ? activeIndex : activeIndex + 1;

  useEffect(() => { setChatOpen(false); }, [pathname]);

  if (isHidden) return null;

  const go = (path: string) => {
    setPressed(path);
    navigate(path);
    setTimeout(() => setPressed(null), 240);
  };

  const Tab = ({ tab }: { tab: NavTab }) => {
    const isActive = activeIndex >= 0 && tabs[activeIndex].path === tab.path;
    const isPressed = pressed === tab.path;

    return (
      <button
        type="button"
        className="mobile-bottom-nav__item"
        onClick={() => go(tab.path)}
        aria-current={isActive ? 'page' : undefined}
        data-active={isActive}
      >
        <motion.span
          className="mobile-bottom-nav__icon"
          aria-hidden
          animate={{
            scale: isPressed ? 0.68 : isActive ? 1.18 : 1,
            y: isActive ? -3 : 0,
          }}
          transition={spring}
        >
          <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.7} />
        </motion.span>
        <span className="mobile-bottom-nav__label">{tab.label}</span>
      </button>
    );
  };

  return createPortal(
    <>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav__items">
          {activeIndex >= 0 && (
            <motion.div
              className="mobile-bottom-nav__indicator"
              initial={false}
              animate={{ x: `calc(${indicatorSlot} * 16.666% + 8.333% - 14px)` }}
              transition={spring}
            />
          )}

          <Tab tab={tabs[0]} />
          <Tab tab={tabs[1]} />

          {/* Assistant — same visual weight as other tabs, no solid disc, no glow */}
          <button
            type="button"
            className="mobile-bottom-nav__item mobile-bottom-nav__assistant"
            onClick={() => setChatOpen(true)}
            aria-label="Open RealSSA Assistant"
            aria-expanded={chatOpen}
            data-active={chatOpen}
          >
            <motion.span
              className="mobile-bottom-nav__icon"
              aria-hidden
              animate={{
                scale: chatOpen ? 1.12 : 1,
                y: chatOpen ? -2 : 0,
              }}
              whileTap={{ scale: 0.72 }}
              transition={spring}
            >
              <Bot size={22} strokeWidth={chatOpen ? 2.4 : 1.7} />
            </motion.span>
            <span className="mobile-bottom-nav__label">Assistant</span>
          </button>

          <Tab tab={tabs[2]} />
          <Tab tab={tabs[3]} />
          <Tab tab={tabs[4]} />
        </div>
      </nav>
    </>,
    document.body
  );
};

export default MobileBottomNav;
