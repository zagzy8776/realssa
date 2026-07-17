import { Facebook, Twitter, Instagram, Youtube, Rss } from "lucide-react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

const Footer = () => {
  const isNative = Capacitor.isNativePlatform();

  const footerLinks = [
    ...(!isNative ? [{ href: "/download", label: "Get the App" }] : []),
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ];

  const socialLinks = [
    { href: "https://www.facebook.com/RealSSANews", icon: Facebook, label: "Facebook" },
    { href: "https://twitter.com/RealSSANews", icon: Twitter, label: "Twitter" },
    { href: "https://www.instagram.com/RealSSANews", icon: Instagram, label: "Instagram" },
    { href: "https://www.youtube.com/@RealSSANews", icon: Youtube, label: "YouTube" },
    { href: "https://realssanews.com.ng/rss/all.xml", icon: Rss, label: "RSS Feed" },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="RealSSA Logo" className="h-8 w-auto" />
              <h3 className="font-display text-xl font-bold">
                <span className="text-foreground">Real</span>
                <span className="text-gradient-gold">SSA</span>
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your premier news hub for Nigeria, Africa, and the World. Get live updates on politics, entertainment, tech startups, sports, and business.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-1">
            <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Links */}
          <div className="md:col-span-1">
            <h4 className="font-semibold text-foreground mb-4">Follow Us</h4>
            <div className="flex gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                  aria-label={link.label}
                >
                  <link.icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-6 border-t border-border text-center flex flex-col sm:flex-row items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} RealSSA News. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground mt-2 sm:mt-0">
            Powered by the Pulse of Africa
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
