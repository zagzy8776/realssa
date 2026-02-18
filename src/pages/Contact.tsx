import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

const contactCards = [
  {
    emoji: "📧",
    title: "Editorial Inquiries",
    description: "For story submissions, press releases, and editorial questions:",
    email: "editorial@entertainmentghc.com",
  },
  {
    emoji: "🎤",
    title: "Artist & Talent",
    description: "For artists, musicians, and creators who want to be featured:",
    email: "talent@entertainmentghc.com",
  },
  {
    emoji: "💼",
    title: "Business & Partnerships",
    description: "For advertising, sponsorships, and business opportunities:",
    email: "partnerships@entertainmentghc.com",
  },
  {
    emoji: "📝",
    title: "General Inquiries",
    description: "For all other questions and feedback:",
    email: "hello@entertainmentghc.com",
  },
];

const socialLinks = [
  { name: "Facebook", icon: Facebook, color: "bg-[#3b5998]" },
  { name: "Twitter", icon: Twitter, color: "bg-black" },
  { name: "Instagram", icon: Instagram, color: "bg-[#e4405f]" },
  { name: "YouTube", icon: Youtube, color: "bg-[#ff0000]" },
];

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "Thank you for reaching out. We'll get back to you soon.",
    });
    setFormData({ name: "", email: "", subject: "general", message: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Page Header */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            Contact <span className="text-gradient-gold">EntertainmentGHC</span>
          </h1>
          <div className="w-24 h-1 bg-primary mx-auto" />
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Get In Touch */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">Get In Touch</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We'd love to hear from you! Whether you have a story tip, want to collaborate, or just have feedback about our coverage, please don't hesitate to reach out.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contactCards.map((card) => (
                <div key={card.title} className="bg-card p-6 rounded-xl border border-border">
                  <h3 className="text-primary font-semibold mb-2">
                    {card.emoji} {card.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-3">{card.description}</p>
                  <a href={`mailto:${card.email}`} className="text-primary font-semibold hover:underline">
                    {card.email}
                  </a>
                </div>
              ))}
            </div>
          </article>

          {/* Contact Form */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Contact Form</h2>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select value={formData.subject} onValueChange={(value) => setFormData({ ...formData, subject: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="story-tip">Story Tip</SelectItem>
                    <SelectItem value="collaboration">Collaboration Request</SelectItem>
                    <SelectItem value="advertising">Advertising Inquiry</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="message">Your Message</Label>
                <Textarea
                  id="message"
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <Button type="submit" className="w-full md:w-auto">
                Send Message
              </Button>
            </form>
          </article>

          {/* Office */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Our Office</h2>
            <div className="bg-card p-6 rounded-xl border border-border mb-6">
              <h3 className="text-primary font-semibold mb-4">📍 Accra, Ghana</h3>
              <p className="text-muted-foreground mb-1">EntertainmentGHC Headquarters</p>
              <p className="text-muted-foreground mb-1">No. 12 Liberation Road, Accra</p>
              <p className="text-muted-foreground mb-1">Greater Accra Region, Ghana</p>
              <p className="text-muted-foreground mb-1">📞 Phone: +233 24 123 4567</p>
              <p className="text-muted-foreground">⏰ Office Hours: Mon-Fri, 9:00 AM - 5:00 PM GMT</p>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-4">🌍 Connect With Us</h3>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href="#"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold ${social.color} hover:opacity-90 transition-opacity`}
                >
                  <social.icon size={18} />
                  {social.name}
                </a>
              ))}
            </div>
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
