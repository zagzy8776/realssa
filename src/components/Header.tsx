import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, LogOut, Home, Newspaper, Radio, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import DarkModeToggle from "./DarkModeToggle";
import PushNotificationManager from "./PushNotificationManager";


const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/news", label: "📰 News", icon: Newspaper },
  { href: "/nigeria", label: "🇳🇬 Nigeria" },
  { href: "/ghana", label: "🇬🇭 Ghana" },
  { href: "/culture", label: "Culture" },
  { href: "/nigerian-news", label: "Nigerian News" },
  { href: "/world-news", label: "🌍 World News" },
  { href: "/kenya", label: "🇰🇪 Kenya" },
  { href: "/south-africa", label: "🇿🇦 South Africa" },
  { href: "/uk", label: "🇬🇧 UK" },
  { href: "/usa", label: "🇺🇸 USA" },
  { href: "/crypto", label: "₿ Crypto" },
  { href: "/sports", label: "⚽ Sports" },
  { href: "/videos", label: "📺 Video News", icon: Radio },

  { href: "/post-news", label: "Post News" },
  { href: "/admin-dashboard", label: "Dashboard", adminOnly: true },
];


const libraryLinks = [
  { href: "/library/nigerian-manual", label: "THE NIGERIAN MANUAL" },
  { href: "/library/media-decode", label: "MEDIA DECODE" },
  { href: "/library/policy-brief", label: "POLICY BRIEF" },
  { href: "/library/societal-architecture", label: "SOCIETAL ARCHITECTURE" },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

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
    isAdmin || (!link.adminOnly && link.href !== "/post-news")
  );

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between h-14 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center">
            <h1 className="text-lg md:text-2xl font-display font-bold tracking-tight">
              <span className="text-gradient-gold">ENTERTAINMENT</span>
              <span className="text-foreground">GHC</span>
            </h1>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {visibleNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                {link.label}
              </a>
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
            
            {/* Push Notifications */}
            <PushNotificationManager />
            
            {/* Dark Mode Toggle */}
            <DarkModeToggle />

            
            {/* Library Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
                Library <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {libraryLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <a href={link.href} className="cursor-pointer">
                      {link.label}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile: Notification & Dark Mode - Top of Header */}
          <div className="hidden md:flex items-center gap-1">
            <PushNotificationManager />
            <DarkModeToggle />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

        </div>

        {/* Mobile Navigation - Slide-out style */}
        <nav
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            isMenuOpen ? "max-h-[800px] pb-4 opacity-100" : "max-h-0 opacity-0"
          )}
        >

          <div className="flex flex-col gap-1">
            {/* Main Navigation Links - Larger touch targets */}
            {visibleNavLinks.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200",
                  "text-muted-foreground hover:text-primary hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                {link.icon && <link.icon size={18} />}
                <span>{link.label}</span>
              </a>
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
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
                      "text-muted-foreground hover:text-primary hover:bg-muted",
                      "active:scale-[0.98] active:bg-muted/80"
                    )}
                  >
                    <Globe size={16} />
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </nav>

      </div>
    </header>
  );
};

export default Header;
