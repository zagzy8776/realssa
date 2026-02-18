import { Twitter, Send, Youtube } from "lucide-react";

const socialLinks = [
  {
    href: "#",
    icon: Twitter,
    label: "Follow us on X (Twitter)",
    className: "bg-[hsl(200,100%,50%)] hover:bg-[hsl(200,100%,45%)]",
  },
  {
    href: "#",
    icon: Send,
    label: "Join our Telegram Channel",
    className: "bg-[hsl(200,85%,55%)] hover:bg-[hsl(200,85%,50%)]",
  },
  {
    href: "#",
    icon: Youtube,
    label: "Subscribe on YouTube",
    className: "bg-secondary hover:bg-secondary/90",
  },
];

const SocialButtons = () => {
  return (
    <div className="bg-muted/50 py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-3">
          {socialLinks.map((link, index) => (
            <a
              key={index}
              href={link.href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-primary-foreground transition-all duration-200 hover:scale-105 ${link.className}`}
            >
              <link.icon size={16} />
              <span className="hidden sm:inline">{link.label}</span>
              <span className="sm:hidden">{link.label.split(" ")[0]}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SocialButtons;