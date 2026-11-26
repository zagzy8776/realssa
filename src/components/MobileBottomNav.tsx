import { useState, useEffect, useRef } from 'react';
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
  {
    label: 'Home',
    icon: Home,
    path: '/',
    matchPaths: ['/'],
  },
  {
    label: 'Cinema',
    icon: Film,
    path: '/videos',
    matchPaths: ['/videos', '/cinema', '/movies', '/video-news', '/live-tv'],
  },
  {
    label: 'For You',
    icon: Sparkles,
    path: '/for-you',
    matchPaths: ['/for-you'],
  },
  {
    label: 'Trending',
    icon: TrendingUp,
    path: '/trending',
    matchPaths: ['/trending'],
  },
  {
    label: 'Profile',
    icon: User,
    path: '/profile',
    matchPaths: ['/profile', '/reading-list', '/reading-history', '/downloads', '/bookmarks'],
  },
];

const HIDDEN_ROUTES = [
  '/admin', '/browser', '/reels', '/wire', '/search', '/article',
  '/edit-news', '/admin-dashboard', '/internal', '/post-news',
  '/verify-email', '/publisher', '/entity', '/market', '/events',
  '/widget', '/library', '/country', '/state', '/city',
  '/local-government', '/ads', '/download', '/login',
];

const spring = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 32,
  mass: 0.6,
};

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [pressedPath, setPressedPath] = useState<string | null>(null);

  const isHidden = HIDDEN_ROUTES.some(route => pathname.startsWith(route));

  const activeIndex = tabs.findIndex(tab =>
    tab.path === '/'
      ? pathname === '/'
      : tab.matchPaths?.some(path => pathname === path || pathname.startsWith(`${path}/`))
  );

  // Visual slots: 0 Home | 1 Cinema | 2 Assistant | 3 For You | 4 Trending | 5 Profile
  // Indicator only moves under the 5 real tabs (skips Assistant slot)
  const indicatorSlot = activeIndex === -1 ? 0 : activeIndex < 2 ? activeIndex : activeIndex + 1;

  useEffect(() => {
    setChatOpen(false);
  }, [pathname]);

  if (isHidden) return null;

  const handleTabClick = (path: string) => {
    setPressedPath(path);
    navigate(path);
    setTimeout(() => setPressedPath(null), 220);
  };

  const renderTab = (tab: NavTab) => {
    const isActive = activeIndex !== -1 && tabs[activeIndex]?.path === tab.path;
    const isPressed = pressedPath === tab.path;

    return (
      <button
        key={tab.path}
        type="button"
        className="mobile-bottom-nav__item"
        onClick={() => handleTabClick(tab.path)}
        aria-current={isActive ? 'page' : undefined}
        data-active={isActive}
      >
        <motion.span
          className="mobile-bottom-nav__icon"
          aria-hidden="true"
          animate={{
            scale: isPressed ? 0.72 : isActive ? 1.15 : 1,
            y: isActive ? -2 : 0,
          }}
          transition={spring}
        >
          <tab.icon size={22} strokeWidth={isActive ? 2.4 : 1.7} />
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
          {/* Sliding indicator */}
          {activeIndex !== -1 && (
            <motion.div
              className="mobile-bottom-nav__indicator"
              initial={false}
              animate={{
                x: `calc(${indicatorSlot} * 100% / 6 + 50% / 6 - 14px)`,
              }}
              transition={spring}
            />
          )}

          {renderTab(tabs[0])}
          {renderTab(tabs[1])}

          {/* Center Assistant — no glow, Bot icon */}
          <button
            type="button"
            className="mobile-bottom-nav__item mobile-bottom-nav__assistant"
            onClick={() => setChatOpen(true)}
            aria-label="Open RealSSA Assistant"
            aria-expanded={chatOpen}
            data-active={chatOpen}
          >
            <motion.span
              className="mobile-bottom-nav__assistant-icon"
              aria-hidden="true"
              animate={{
                scale: chatOpen ? 0.9 : 1,
              }}
              whileTap={{ scale: 0.82 }}
              transition={spring}
            >
              <Bot size={20} strokeWidth={2.1} />
            </motion.span>
            <span className="mobile-bottom-nav__label">Assistant</span>
          </button>

          {renderTab(tabs[2])}
          {renderTab(tabs[3])}
          {renderTab(tabs[4])}
        </div>
      </nav>
    </>,
    document.body
  );
};

export default MobileBottomNav;
