import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, CheckCircle2, ShieldCheck, Sparkles, CreditCard, ArrowRight } from "lucide-react";

export default function AdPortal() {
  const { toast } = useToast();
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("business");
  const [imageUrl, setImageUrl] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [advertiserEmail, setAdvertiserEmail] = useState("");
  const [budgetTier, setBudgetTier] = useState("5000");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline || !description || !targetLink || !advertiserEmail) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/ads/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          description,
          category,
          imageUrl,
          targetLink,
          advertiserEmail,
          budgetNaira: parseInt(budgetTier, 10)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        toast({
          title: "Campaign Reserved!",
          description: "Your ad has been created. Proceeding to payment gateway...",
        });
      } else {
        throw new Error(data.message || 'Failed to submit campaign');
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not launch campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="Advertise on RealSSA | Native Self-Serve Ads Portal"
        description="Promote your business, startup, event, or brand to thousands of daily readers across Nigeria and Africa with Paystack Naira payments."
      />
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        {/* Header Hero Banner */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-amber-500/20">
            <Megaphone className="w-4 h-4" /> RealSSA Native Ad Exchange
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold font-display leading-tight mb-4">
            Promote Your Brand Across <span className="text-gradient-gold">RealSSA</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Reach thousands of daily readers across Nigeria & Africa. Pay easily in Naira via Paystack or Bank Transfer. Zero FX limits!
          </p>
        </div>

        {submitted ? (
          <div className="bg-card border border-green-500/30 rounded-3xl p-8 text-center max-w-lg mx-auto shadow-2xl">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold mb-2">Campaign Submitted!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your sponsored story <span className="font-semibold text-foreground">"{headline}"</span> has been created. Pay <strong>₦{parseInt(budgetTier).toLocaleString()}</strong> via Paystack to activate.
            </p>
            <a
              href={`https://paystack.com/pay/realssa-ads`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all"
            >
              <CreditCard className="w-5 h-5" /> Complete Payment in Naira (Paystack)
            </a>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 text-xs text-muted-foreground hover:underline"
            >
              Create another campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-7 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Campaign Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lagos Tech Startup Launches Instant FX Transfers"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Ad Description / Highlight *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Fast, reliable transfers for Nigerian businesses and freelancers."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Category Target</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="business">Business & Finance</option>
                    <option value="tech">Tech & Startups</option>
                    <option value="entertainment">Entertainment & Music</option>
                    <option value="sports">Sports</option>
                    <option value="general">General News</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Budget Tier (Naira) *</label>
                  <select
                    value={budgetTier}
                    onChange={e => setBudgetTier(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-amber-500"
                  >
                    <option value="5000">₦5,000 (~5,000 Views)</option>
                    <option value="20000">₦20,000 (~25,000 Views)</option>
                    <option value="50000">₦50,000 (~75,000 Views + Social Push)</option>
                    <option value="100000">₦100,000 (Featured Frontpage + WhatsApp Status)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Target Web or WhatsApp Link *</label>
                <input
                  type="url"
                  required
                  placeholder="https://yourwebsite.com or https://wa.me/234..."
                  value={targetLink}
                  onChange={e => setTargetLink(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Banner / Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://yourwebsite.com/logo.png"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Your Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="you@yourcompany.com"
                  value={advertiserEmail}
                  onChange={e => setAdvertiserEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-4 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base"
              >
                {submitting ? (
                  <span className="inline-block w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Launch Campaign in Naira <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>

            {/* Live Preview Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-card border border-border rounded-3xl p-6 shadow-xl sticky top-24">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Live Feed Preview
                </h3>

                <div className="bg-background border border-amber-500/40 rounded-2xl p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-amber-500 text-black text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                      SPONSORED
                    </span>
                    <span className="text-[11px] text-muted-foreground">{category}</span>
                  </div>

                  {imageUrl && (
                    <div className="w-full h-32 rounded-xl overflow-hidden bg-muted">
                      <img src={imageUrl} alt="Ad Preview" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <h4 className="font-bold text-base leading-snug line-clamp-2">
                    {headline || "Your High-Impact Headline Will Appear Here"}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {description || "Your campaign description and bullet points will show seamlessly inside RealSSA's Discover Feed."}
                  </p>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-amber-500 font-bold">
                    <span>Visit Advertiser Website</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                    <span>Instant Naira Payments via Paystack / Bank Transfer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                    <span>Automatic Google Search & Buffer Social Media Broadcast</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
