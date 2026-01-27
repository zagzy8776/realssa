import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/nigeria", label: "Nigeria" },
  { href: "/ai-gallery", label: "AI Gallery" },
  { href: "/culture", label: "Culture" },
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
  };

  // Filter navLinks to show only appropriate links for current user
  const visibleNavLinks = navLinks.filter(link =>
    isAdmin || (!link.adminOnly && link.href !== "/post-news")
  );

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center">
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
              <span className="text-gradient-gold">ENTERTAINMENT</span>
              <span className="text-foreground">GHC</span>
            </h1>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300",
            isMenuOpen ? "max-h-96 pb-4" : "max-h-0"
          )}
        >
          <div className="flex flex-col gap-3">
            {visibleNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}

            {/* Admin Logout Button - Mobile */}
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            )}

            {/* Library Section */}
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Library</p>
              <div className="flex flex-col gap-2">
                {libraryLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
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