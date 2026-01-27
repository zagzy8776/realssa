import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const libraryLinks = [
  { href: "/library/nigerian-manual", label: "📖 THE NIGERIAN MANUAL", id: "nigerian-manual" },
  { href: "/library/media-decode", label: "📰 MEDIA DECODE", id: "media-decode" },
  { href: "/library/policy-brief", label: "📝 POLICY BRIEF", id: "policy-brief" },
  { href: "/library/societal-architecture", label: "🏛️ SOCIETAL ARCHITECTURE", id: "societal-architecture" },
];

const categoryLinks = [
  { href: "/nigeria", label: "🇳🇬 Nigeria News" },
  { href: "/culture", label: "🎭 Culture" },
  { href: "/ai-gallery", label: "🤖 AI Gallery" },
];

interface LibrarySidebarProps {
  currentPage?: string;
}

const LibrarySidebar = ({ currentPage }: LibrarySidebarProps) => {
  return (
    <aside className="space-y-8">
      {/* Library Navigation */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="font-display font-bold text-lg mb-4 text-foreground">Explore Our Library</h3>
        <ul className="space-y-3">
          {libraryLinks.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                className={`block transition-colors ${
                  currentPage === link.id
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Related Categories */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="font-display font-bold text-lg mb-4 text-foreground">Related Categories</h3>
        <ul className="space-y-3">
          {categoryLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-muted-foreground hover:text-primary transition-colors">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Newsletter */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="font-display font-bold text-lg mb-4 text-foreground">Stay Informed</h3>
        <form className="space-y-3">
          <Input type="email" placeholder="Your email address" required />
          <Button type="submit" className="w-full">
            Subscribe to Updates
          </Button>
        </form>
      </div>
    </aside>
  );
};

export default LibrarySidebar;
