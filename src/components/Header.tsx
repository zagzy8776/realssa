import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, LogOut, Home, Newspaper, Radio, Globe, Moon, Sun, Bell, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import DarkModeToggle from "./DarkModeToggle";
import PushNotificationManager from "./PushNotificationManager";
import { useToast } from "@/hooks/use-toast";
import WeatherWidget from "./WeatherWidget";
import InviteButton from "./InviteButton";
import { useStreak } from "@/hooks/useStreak";


const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/news", label: "Breaking", icon: Newspaper },
  { href: "/sports", label: "⚽ Sports" },
  { href: "/reels", label: "🌍 World", icon: Globe },
  { href: "/videos", label: "📺 Videos", icon: Radio },
  { href: "/crypto", label: "₿ Crypto" },
  { href: "/admin-dashboard", label: "Dashboard", adminOnly: true },
];

const regionsLinks = [
  { href: "/nigeria", label: "🇳🇬 Nigeria" },
  { href: "/ghana", label: "🇬🇭 Ghana" },
  { href: "/kenya", label: "🇰🇪 Kenya" },
  { href: "/south-africa", label: "🇿🇦 South Africa" },
  { href: "/uk", label: "🇬🇧 UK" },
  { href: "/usa", label: "🇺🇸 USA" },
  { href: "/culture", label: "Culture" },
  { href: "/entertainment", label: "🎬 Entertainment" },
  { href: "/nigerian-news", label: "Nigerian News" },
  { href: "/jobs", label: "💼 Jobs" },
  { href: "/world-directory", label: "🗺️ World Directory" },
  { href: "/post-news", label: "Post News", adminOnly: true },
];


const libraryLinks = [
  { href: "/reading-list", label: "WISDOM LIBRARY (SAVED)" },
  { href: "/reading-history", label: "READING HISTORY" },
  { href: "/library/nigerian-manual", label: "THE NIGERIAN MANUAL" },
  { href: "/library/media-decode", label: "MEDIA DECODE" },
  { href: "/library/policy-brief", label: "POLICY BRIEF" },
  { href: "/library/societal-architecture", label: "SOCIETAL ARCHITECTURE" },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { streak, longestStreak } = useStreak();
  const [isStreakOpen, setIsStreakOpen] = useState(false);

  const categoryPills = [
    { name: "Breaking", path: "/news" },
    { name: "Nigeria", path: "/nigeria" },
    { name: "Sports", path: "/sports" },
    { name: "Entertainment", path: "/entertainment" },
    { name: "World", path: "/reels" },
    { name: "Crypto", path: "/crypto" },
    { name: "🎬 Reels", path: "/reels" },
    { name: "Culture", path: "/culture" },
  ];

  // Check admin status on component mount
  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminUsername");
    setIsAdmin(false);
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
      variant: "default",
    });
    navigate("/");
    setIsMenuOpen(false);
  };

  // Filter navLinks to show only appropriate links for current user
  const visibleNavLinks = navLinks.filter(link =>
    isAdmin || !link.adminOnly
  );
  const visibleRegionsLinks = regionsLinks.filter(link =>
    isAdmin || !link.adminOnly
  );

  const showBackButton = location.pathname !== "/";

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-[9999] pt-[env(safe-area-inset-top)] border-b border-border transition-colors",
      isMenuOpen ? "bg-background" : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    )}>
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between h-14 md:h-20">
          {/* Logo & Back Button Container */}
          <div className="flex items-center gap-1 md:gap-2">
            {showBackButton && (
              <button 
                onClick={handleBack} 
                className="p-1.5 mr-0.5 text-foreground/80 hover:text-foreground active:scale-95 transition-all rounded-full hover:bg-accent flex items-center justify-center"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            )}
            <Link to="/" className="flex items-center flex-shrink-0 gap-2">
              <img src="/logo.png" alt="RealSSA Logo" className="h-8 md:h-10 w-auto" />
              <h1 className="text-sm sm:text-lg md:text-2xl font-display font-bold tracking-tight whitespace-nowrap flex-shrink-0">
                <span className="text-foreground">Real</span>
                <span className="text-gradient-gold">SSA</span>
              </h1>
            </Link>
          </div>

          {/* Gamification Streak & Weather */}
          <div className="flex items-center gap-1 md:gap-2 animate-in fade-in zoom-in duration-500">
            <button
              onClick={() => setIsStreakOpen(true)}
              className={`flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 rounded-full active:scale-95 transition-all cursor-pointer ${
                streak > 0 ? 'bg-orange-100 dark:bg-orange-950/60 hover:bg-orange-200' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-250'
              }`}
            >
              <span className={`font-bold text-xs md:text-sm ${streak > 0 ? 'text-orange-500' : 'text-gray-400 animate-pulse'}`}>🔥 {streak}</span>
              <span className={`hidden sm:inline text-xs font-medium ${streak > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}`}>Streak</span>
            </button>
            <div>
              <WeatherWidget />
            </div>
          </div>

          {/* Reading Streak Calendar Modal */}
          {isStreakOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-sm bg-gradient-to-br from-card to-background border border-border rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-6 animate-in zoom-in-95 duration-250">
                
                {/* Background glow effects */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-1.5">
                    ⚡ Reading Streak
                  </h3>
                  <button 
                    onClick={() => setIsStreakOpen(false)}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center text-4xl shadow-inner relative group">
                    <span className="group-hover:scale-110 transition duration-300 transform inline-block">🔥</span>
                    <span className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping"></span>
                  </div>
                  
                  <div>
                    <div className="text-3xl font-extrabold tracking-tight text-foreground">{streak} Days</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Your current daily reading habit</p>
                  </div>
                </div>

                {/* Milestones / Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-2xl p-3 border border-border/50 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Longest Streak</div>
                    <div className="text-lg font-bold text-foreground mt-1">🏆 {longestStreak} days</div>
                  </div>
                  <div className="bg-muted/40 rounded-2xl p-3 border border-border/50 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Habit Level</div>
                    <div className="text-lg font-bold text-orange-500 mt-1">
                      {streak >= 30 ? '🔥 Expert' : streak >= 7 ? '⭐ Regular' : '🌱 Novice'}
                    </div>
                  </div>
                </div>

                {/* 7-Day Calendar Checklist */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 tracking-wider">Weekly Progress</h4>
                  <div className="flex justify-between gap-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                      const todayIdx = (new Date().getDay() + 6) % 7; // Map Mon-Sun to 0-6
                      const isActive = idx <= todayIdx;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                            idx === todayIdx
                              ? 'bg-orange-500 text-white border-orange-500 scale-[1.05] shadow-md shadow-orange-500/20'
                              : isActive
                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25'
                                : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {idx === todayIdx && streak > 0 ? '✓' : day}
                          </div>
                          <span className="text-[9px] font-semibold text-muted-foreground/60">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground px-4 leading-relaxed">
                  {streak > 0 
                    ? "Fantastic! You've read today's news to secure your streak. See you tomorrow!"
                    : "Read any summary article today to start your reading streak flame!"}
                </div>
              </div>
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}

            {/* Admin Logout Button - Desktop */}
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors duration-200 flex items-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            )}

            {/* Library Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
                Library <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {libraryLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link to={link.href} className="cursor-pointer">
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

            {/* Regions Dropdown — desktop */}
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
                  Regions <ChevronDown size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-[60vh] overflow-y-auto">
                  {visibleRegionsLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link to={link.href} className="cursor-pointer">
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop-only controls */}
            <div className="hidden lg:flex items-center gap-3 ml-4">
              <InviteButton />
              <div className="flex items-center gap-1 border-l border-border pl-3">
                <DarkModeToggle />
                <PushNotificationManager iconOnly={true} />
              </div>
            </div>

            {/* Mobile-only controls */}
            <div className="lg:hidden flex items-center gap-1 ml-1">
              <InviteButton variant="icon" />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2.5 text-foreground rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
        </div>

        {/* Mobile Swipeable Category Pill Bar */}
        <div className="md:hidden flex overflow-x-auto scrollbar-hide border-t border-border bg-background py-2 px-3 snap-x snap-mandatory touch-pan-x">
          <div className="flex gap-2 min-w-max">
            {categoryPills.map((pill, idx) => {
              const isActive = location.pathname === pill.path;
              return (
                <Link
                  key={`${pill.name}-${idx}`}
                  to={pill.path}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all snap-start whitespace-nowrap h-11 flex items-center justify-center",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm pill-active" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {pill.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile Navigation - Slide-out style */}
        <nav
          className={cn(
            "lg:hidden transition-all duration-300 ease-in-out fixed inset-x-0 bottom-0 top-[136px] md:top-[160px] bg-background z-[9999] opacity-100",
            isMenuOpen ? "max-h-[calc(100vh-136px)] overflow-y-auto pb-24 opacity-100 custom-scrollbar block" : "max-h-0 overflow-hidden opacity-0 hidden"
          )}
        >

          <div className="flex flex-col gap-1">
            {/* Main Navigation Links - Larger touch targets */}
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200",
                  "text-muted-foreground hover:text-primary hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                {link.icon && <link.icon size={18} />}
                <span>{link.label}</span>
              </Link>
            ))}

            {/* Admin Logout Button - Mobile */}
            {isAdmin && (
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200",
                  "text-muted-foreground hover:text-destructive hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            )}

            {/* Library Section */}
            <div className="px-4 py-2 mt-2 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Library</p>
              <div className="flex flex-col gap-1">
                {libraryLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
                      "text-muted-foreground hover:text-primary hover:bg-muted",
                      "active:scale-[0.98] active:bg-muted/80"
                    )}
                  >
                    <Globe size={16} />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Settings Section */}
            <div className="px-4 py-3 mt-1 border-t border-border/50 pb-8">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Appearance</span>
                  <DarkModeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Push Notifications</span>
                  <PushNotificationManager iconOnly={false} />
                </div>
              </div>
            </div>

          </div>
        </nav>

      </div>
    </header>
  );
};

export default Header;
