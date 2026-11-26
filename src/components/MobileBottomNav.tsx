import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Film, Sparkles, TrendingUp, User, Bell, Bookmark, Menu, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
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

// Routes that should have the chat button instead of center FAB
const CHAT_CENTER_ROUTES = ['/for-you', '/wire'];

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('/');
  const navRef = useRef<HTMLNavElement>(null);

  // Check if bottom nav should be hidden
  const isHidden = HIDDEN_ROUTES.some(route => location.pathname.startsWith(route));

  // Check if we should show chat in center
  const showChatCenter = CHAT_CENTER_ROUTES.some(route => location.pathname.startsWith(route));

  // Determine active tab based on current path
  useEffect(() => {
    const matchedTab = tabs.find(tab => {
      if (tab.path === '/') return location.pathname === '/';
      return tab.matchPaths?.some(p => location.pathname.startsWith(p)) ?? location.pathname.startsWith(tab.path);
    });
    if (matchedTab) {
      setActiveTab(matchedTab.path);
    }
  }, [location.pathname]);

  // Handle tab press with haptic feedback
  const handleTabPress = (path: string) => {
    // Haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Close FAB if open
    if (fabOpen) setFabOpen(false);

    // Navigate with smooth transition
    navigate(path);
  };

  // Handle FAB actions
  const handleSearch = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    setFabOpen(false);
    navigate('/search');
  };

  const handleLiveWire = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    setFabOpen(false);
    navigate('/wire');
  };

  const handleChat = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    setChatOpen(true);
  };

  if (isHidden) return null;

  // Keep fixed navigation outside application scroll and animation containers.
  return createPortal(
    <>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      <AnimatePresence mode="wait">
        <motion.nav
          key={location.pathname}
          ref={navRef}
          className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-background/95 backdrop-blur-2xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="Mobile navigation"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="relative mx-auto grid h-[68px] max-w-[520px] grid-cols-5">
            {/* Left tabs */}
            {tabs.slice(0, 2).map((tab) => {
              const isActive = activeTab === tab.path;
              return (
                <motion.button
                  key={tab.path}
                  onClick={() => handleTabPress(tab.path)}
                  className={cn(
                    'relative flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-[0.04em]',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.02 }}
                  data-active={isActive}
                >
                  <motion.span
                    layoutId={`icon-${tab.path}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className={cn(isActive && 'text-primary')} />
                  </motion.span>
                  <span className="select-none">{tab.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="active-indicator"
                      data-active-indicator
                      className="absolute bottom-2 h-0.5 w-5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  {tab.badge && tab.badge > 0 && (
                    <motion.span
                      className="absolute -top-1 -right-1 min-w-[16px] h-5 rounded-full bg-red-500 px-1 text-[9px] font-black text-white flex items-center justify-center"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}

            {/* Center FAB / Chat */}
            <div className="relative flex items-center justify-center">
              {!showChatCenter ? (
                <>
                  {/* FAB Menu Items */}
                  <AnimatePresence>
                    {fabOpen && (
                      <>
                        <motion.button
                          onClick={handleSearch}
                          layoutId="fab-search"
                          className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-background px-4 py-2.5 text-sm font-bold text-foreground shadow-lg border border-border"
                          initial={{ opacity: 0, scale: 0.8, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 20 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Search"
                        >
                          <Search size={16} className="text-primary" />
                          <span>Search</span>
                        </motion.button>
                        <motion.button
                          onClick={handleLiveWire}
                          layoutId="fab-wire"
                          className="absolute bottom-56 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-background px-4 py-2.5 text-sm font-bold text-foreground shadow-lg border border-border"
                          initial={{ opacity: 0, scale: 0.8, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 20 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.1 }}
                          whileTap={{ scale: 0.95 }}
                          aria-label="Live Wire"
                        >
                          <span className="text-primary font-black">📢</span>
                          <span>Live Wire</span>
                          <motion.span
                            className="w-2 h-2 rounded-full bg-red-500"
                            animate={{ scale: [1, 1.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        </motion.button>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Main FAB Button */}
                  <motion.button
                    onClick={() => setFabOpen(!fabOpen)}
                    className="absolute -top-4 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.3)] border-2 border-background fab-main"
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    animate={{ rotate: fabOpen ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    aria-label={fabOpen ? 'Close quick actions' : 'Open quick actions'}
                    aria-expanded={fabOpen}
                  >
                    <Sparkles size={20} strokeWidth={2.5} />
                  </motion.button>
                  <span className="mt-8 text-[9px] font-bold tracking-[0.04em] text-primary">Assistant</span>
                </>
              ) : (
                <>
                  <motion.button
                    onClick={handleChat}
                    className="absolute -top-4 left-1/2 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.3)] border-2 border-background"
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    aria-label="Open RealSSA Assistant"
                  >
                    <Sparkles size={20} strokeWidth={2.5} />
                  </motion.button>
                  <span className="mt-8 text-[9px] font-bold tracking-[0.04em] text-primary">Assistant</span>
                </>
              )}
            </div>

            {/* Right tabs */}
            {tabs.slice(2).map((tab) => {
              const isActive = activeTab === tab.path;
              return (
                <motion.button
                  key={tab.path}
                  onClick={() => handleTabPress(tab.path)}
                  className={cn(
                    'relative flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold tracking-[0.04em]',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.02 }}
                  data-active={isActive}
                >
                  <motion.span
                    layoutId={`icon-${tab.path}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className={cn(isActive && 'text-primary')} />
                  </motion.span>
                  <span className="select-none">{tab.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="active-indicator"
                      data-active-indicator
                      className="absolute bottom-2 h-0.5 w-5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  {tab.badge && tab.badge > 0 && (
                    <motion.span
                      className="absolute -top-1 -right-1 min-w-[16px] h-5 rounded-full bg-red-500 px-1 text-[9px] font-black text-white flex items-center justify-center"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.nav>
      </AnimatePresence>
    </>,
    document.body
  );
};

export default MobileBottomNav;