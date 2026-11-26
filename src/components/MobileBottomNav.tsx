import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, Sparkles, TrendingUp, User } from 'lucide-react';
import RealSSAChat from './RealSSAChat';

interface NavTab {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  path: string;
  badge?: number;
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

// Routes where bottom nav should be hidden
const HIDDEN_ROUTES = [
  '/admin',
  '/browser',
  '/reels',
  '/wire',
  '/search',
  '/article',
  '/edit-news',
  '/admin-dashboard',
  '/internal',
  '/post-news',
  '/verify-email',
  '/publisher',
  '/entity',
  '/market',
  '/events',
  '/widget',
  '/library',
  '/country',
  '/state',
  '/city',
  '/local-government',
  '/ads',
  '/download',
  '/login',
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const isHidden = HIDDEN_ROUTES.some(route => pathname.startsWith(route));
  const activeTab = tabs.find(tab => tab.path === '/'
    ? pathname === '/'
    : tab.matchPaths?.some(path => pathname === path || pathname.startsWith(`${path}/`)));

  useEffect(() => {
    setChatOpen(false);
  }, [pathname]);

  if (isHidden) return null;

  const renderTab = (tab: NavTab) => {
    const isActive = activeTab?.path === tab.path;
    return (
      <button
        key={tab.path}
        type="button"
        className="mobile-bottom-nav__item"
        onClick={() => navigate(tab.path)}
        aria-current={isActive ? 'page' : undefined}
        data-active={isActive}
      >
        <span className="mobile-bottom-nav__icon" aria-hidden="true">
          <tab.icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
        </span>
        <span className="mobile-bottom-nav__label">{tab.label}</span>
      </button>
    );
  };

  // Keep fixed navigation outside application scroll and animation containers.
  return createPortal(
    <>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav__items">
          {tabs.slice(0, 2).map(renderTab)}
          <button
            type="button"
            className="mobile-bottom-nav__item mobile-bottom-nav__assistant"
            onClick={() => setChatOpen(true)}
            aria-label="Open RealSSA Assistant"
            aria-expanded={chatOpen}
          >
            <span className="mobile-bottom-nav__icon" aria-hidden="true">
              <Sparkles size={22} strokeWidth={2} />
            </span>
            <span className="mobile-bottom-nav__label">Assistant</span>
          </button>
          {tabs.slice(2).map(renderTab)}
        </div>
      </nav>
    </>,
    document.body
  );
};

export default MobileBottomNav;
