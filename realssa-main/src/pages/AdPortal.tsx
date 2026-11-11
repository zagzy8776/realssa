import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { 
  Megaphone, CheckCircle2, ShieldCheck, Sparkles, CreditCard, ArrowRight, Upload, 
  X, Layers, Eye, Calendar, Award, Building2
} from "lucide-react";

interface CategoryOption {
  id: string;
  name: string;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: "business", name: "Business & Finance", description: "Banking, fintech, investment, economy & corporate updates" },
  { id: "tech", name: "Technology & Startups", description: "SaaS, AI, gadgets, venture capital & innovation" },
  { id: "entertainment", name: "Entertainment & Nollywood", description: "Movies, celebrity updates, shows & events" },
  { id: "music", name: "Afrobeats & Music", description: "New releases, concerts, artists & music industry" },
  { id: "sports", name: "Sports & Football", description: "Premier League, NPFL, Super Eagles & global athletics" },
  { id: "real_estate", name: "Real Estate & Property", description: "Homes, land, commercial property & developments" },
  { id: "fashion", name: "Fashion & Lifestyle", description: "Style, beauty, luxury & contemporary trends" },
  { id: "automotive", name: "Automotive & Transport", description: "Vehicles, mobility, electric cars & logistics" },
  { id: "health", name: "Health & Wellness", description: "Medicine, fitness, wellness & healthcare services" },
  { id: "education", name: "Education & Careers", description: "Universities, courses, recruitment & skills" },
  { id: "politics", name: "Politics & Governance", description: "Public policy, government, civic updates & elections" },
  { id: "general", name: "General News & Media", description: "Broad national audience & major breaking stories" }
];

interface PlanTier {
  id: string;
  name: string;
  priceNaira: number;
  impressions: string;
  duration: string;
  features: string[];
  popular?: boolean;
}

const TIERS: PlanTier[] = [
  {
    id: "5000",
    name: "Starter Launch",
    priceNaira: 5000,
    impressions: "5,000+",
    duration: "3 Days",
    features: ["Discover Feed Placement", "Basic Click Analytics", "Mobile & Desktop Responsive"]
  },
  {
    id: "20000",
    name: "Growth Publisher",
    priceNaira: 20000,
    impressions: "25,000+",
    duration: "7 Days",
    popular: true,
    features: ["Discover & Category Feed Top Spots", "Social Media Broadcast (X/Facebook)", "Priority Ad Server Delivery"]
  },
  {
    id: "50000",
    name: "Pro Network",
    priceNaira: 50000,
    impressions: "75,000+",
    duration: "14 Days",
    features: ["Top Banner & Feed Placements", "WhatsApp Broadcast Push", "Buffer Social Media Multi-Post"]
  },
  {
    id: "100000",
    name: "Enterprise Domination",
    priceNaira: 100000,
    impressions: "200,000+",
    duration: "30 Days",
    features: ["Featured Sticky Placement", "Full Social Network Takeover", "Dedicated Campaign Manager", "Verified Press Release Package"]
  }
];

export default function AdPortal() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption>(CATEGORIES[0]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [targetLink, setTargetLink] = useState("");
  const [advertiserEmail, setAdvertiserEmail] = useState("");
  const [selectedTier, setSelectedTier] = useState<PlanTier>(TIERS[1]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdAd, setCreatedAd] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Check for Paystack redirect parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (reference) {
      setVerificationStatus('loading');
      fetch(apiUrl(`/api/payments/verify?reference=${reference}`))
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setVerificationStatus('success');
            toast({
              title: "Payment Verified!",
              description: "Your native ad campaign is now active.",
            });
          } else {
            setVerificationStatus('error');
          }
        })
        .catch(() => {
          setVerificationStatus('error');
        });
    }
  }, []);

  const handleInitializePayment = async () => {
    if (!createdAd) return;
    setPaying(true);
    try {
      const res = await fetch(apiUrl('/api/payments/initialize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: createdAd.id })
      });
      const data = await res.json();
      if (res.ok && data.success && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error(data.message || 'Failed to initialize payment');
      }
    } catch (err: any) {
      toast({
        title: "Payment Error",
        description: err.message || "Failed to contact payment gateway.",
        variant: "destructive"
      });
    } finally {
      setPaying(false);
    }
  };

  // File upload handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Image size must be under 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !headline || !description || !targetLink || !advertiserEmail) {
      toast({ title: "Missing Fields", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/ads/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          headline,
          description,
          category: selectedCategory.id,
          imageUrl: imagePreview || null,
          targetLink,
          advertiserEmail,
          budgetNaira: selectedTier.priceNaira
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCreatedAd(data.ad);
        setSubmitted(true);
        toast({
          title: "Campaign Reserved Successfully!",
          description: "Your ad campaign has been generated. Ready for activation.",
        });
      } else {
        throw new Error(data.message || 'Failed to initialize campaign');
      }
    } catch (err: any) {
      toast({
        title: "Submission Error",
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
        title="Advertise on RealSSA | Enterprise Native Ad Portal"
        description="Launch targeted native ad campaigns across RealSSA. Connect directly with high-intent digital audiences across Nigeria and Africa."
      />
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        {verificationStatus !== 'idle' ? (
          <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-lg mx-auto shadow-2xl space-y-6 my-12 animate-in fade-in duration-300">
            {verificationStatus === 'loading' && (
              <>
                <div className="inline-block w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <h2 className="text-2xl font-bold">Verifying Payment...</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We are confirming your payment transaction with Paystack. Please do not close or refresh this page.
                </p>
              </>
            )}

            {verificationStatus === 'success' && (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-2 animate-in zoom-in duration-300" />
                <h2 className="text-2xl font-bold text-green-500">Payment Verified!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your ad campaign has been successfully activated. It is now live in our Discover Feed and the social broadcast has been queued.
                </p>
                <button
                  onClick={() => {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setVerificationStatus('idle');
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition-all"
                >
                  Create Another Campaign
                </button>
              </>
            )}

            {verificationStatus === 'error' && (
              <>
                <X className="w-16 h-16 text-red-500 mx-auto mb-2 border-2 border-red-500 rounded-full p-2" />
                <h2 className="text-2xl font-bold text-red-500">Verification Failed</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We could not verify your payment at this moment. If you were debited, please contact our support team with your transaction reference.
                </p>
                <button
                  onClick={() => {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setVerificationStatus('idle');
                  }}
                  className="w-full bg-muted hover:bg-muted/80 text-foreground font-extrabold py-3.5 px-6 rounded-xl transition-all border border-border"
                >
                  Return to Portal
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Hero Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-amber-500/20 shadow-sm">
                <Megaphone className="w-4 h-4" /> RealSSA Native Publishing Network
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold font-display leading-tight mb-4">
                Amplify Your Brand to <span className="text-gradient-gold">High-Intent Audiences</span>
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                Place high-converting sponsored stories, product announcements, and brand features seamlessly inside RealSSA's digital ecosystem.
              </p>
            </div>

            {/* Tier Cards Estimator */}
            <div className="mb-12">
              <h2 className="text-lg font-bold text-center mb-6 flex items-center justify-center gap-2">
                <Award className="w-5 h-5 text-amber-500" /> Select Guaranteed Campaign Tier
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {TIERS.map(tier => (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTier(tier)}
                    className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                      selectedTier.id === tier.id
                        ? "bg-amber-500/10 border-amber-500 shadow-xl ring-2 ring-amber-500/40"
                        : "bg-card border-border hover:border-amber-500/40"
                    }`}
                  >
                    {tier.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                        MOST POPULAR
                      </span>
                    )}
                    <div>
                      <h3 className="font-bold text-base mb-1">{tier.name}</h3>
                      <div className="text-2xl font-black text-amber-500 mb-3">
                        ₦{tier.priceNaira.toLocaleString()}
                      </div>

                      <div className="space-y-2 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Eye className="w-3.5 h-3.5 text-amber-500" /> {tier.impressions} Guaranteed Views
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-500" /> {tier.duration} Placement
                        </div>
                      </div>

                      <ul className="space-y-1.5 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                        {tier.features.map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {submitted ? (
              <div className="bg-card border border-green-500/30 rounded-3xl p-8 text-center max-w-lg mx-auto shadow-2xl space-y-4">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-2 animate-bounce" />
                <h2 className="text-2xl font-bold">Campaign Order Generated</h2>
                <p className="text-muted-foreground text-sm">
                  Your campaign <span className="font-semibold text-foreground">"{headline}"</span> for <strong className="text-foreground">{companyName}</strong> is reserved. Total investment: <strong className="text-amber-500">₦{selectedTier.priceNaira.toLocaleString()}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleInitializePayment}
                  disabled={paying}
                  className="inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {paying ? (
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" /> Proceed to Secure Checkout
                    </>
                  )}
                </button>
                <button onClick={() => setSubmitted(false)} className="text-xs text-muted-foreground hover:underline block mx-auto mt-2">
                  Create another campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Form */}
                <form onSubmit={handleSubmit} className="lg:col-span-7 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                  <h3 className="text-lg font-bold border-b border-border pb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-500" /> Advertiser Details
                  </h3>

                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Company / Business Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Paystack Nigeria, Oando Energy, Flutterwave"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Ad Headline / Hook *</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="e.g. Launching Instant Cross-Border Payments Across West Africa"
                      value={headline}
                      onChange={e => setHeadline(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-muted-foreground block text-right mt-1">{headline.length}/100</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Campaign Highlights & Description *</label>
                    <textarea
                      required
                      rows={4}
                      maxLength={300}
                      placeholder="Describe your offer, key product value, or announcement details..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-muted-foreground block text-right mt-1">{description.length}/300</span>
                  </div>

                  {/* Target Category Selector Trigger */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Target Audience Category *</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="w-full bg-background border border-border hover:border-amber-500 rounded-xl px-4 py-3 text-sm flex items-center justify-between text-left transition-all"
                    >
                      <span className="font-semibold text-foreground">{selectedCategory.name}</span>
                      <Layers className="w-4 h-4 text-amber-500" />
                    </button>
                  </div>

                  {/* Image Upload Dropzone */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Banner / Product Image Upload *</label>
                    <div className="relative border-2 border-dashed border-border hover:border-amber-500/50 rounded-2xl p-6 text-center transition-all bg-background/50">
                      {imagePreview ? (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden group">
                          <img src={imagePreview} alt="Uploaded Banner" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImagePreview(null)}
                            className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block space-y-2">
                          <Upload className="w-8 h-8 text-amber-500 mx-auto" />
                          <span className="text-sm font-semibold block">Click to upload banner image</span>
                          <span className="text-xs text-muted-foreground block">Supports PNG, JPG, WEBP (Max 5MB)</span>
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Destination Link (Website or WhatsApp) *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://yourwebsite.com or https://wa.me/234..."
                      value={targetLink}
                      onChange={e => setTargetLink(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">Contact Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="marketing@yourcompany.com"
                      value={advertiserEmail}
                      onChange={e => setAdvertiserEmail(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      <>Submit Campaign Order <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>

                {/* Live Card Preview */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-card border border-border rounded-3xl p-6 shadow-xl sticky top-24">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Live Feed Placement Preview
                    </h3>

                    <div className="bg-background border border-amber-500/40 rounded-2xl p-4 shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-amber-500 text-black text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                          SPONSORED
                        </span>
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          {selectedCategory.name}
                        </span>
                      </div>

                      {imagePreview ? (
                        <div className="w-full h-36 rounded-xl overflow-hidden bg-muted">
                          <img src={imagePreview} alt="Ad Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-36 rounded-xl bg-muted/40 border border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground">
                          <span>Upload Banner Image Above</span>
                        </div>
                      )}

                      <div className="text-[11px] font-extrabold text-amber-500 tracking-wider uppercase">
                        {companyName || "COMPANY / BRAND NAME"}
                      </div>

                      <h4 className="font-bold text-base leading-snug line-clamp-2">
                        {headline || "Your High-Impact Campaign Headline"}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {description || "Your offer highlights and product announcements will appear inside RealSSA's Discover Feed."}
                      </p>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-amber-500 font-bold">
                        <span>Visit {companyName || "Website"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-6 space-y-2.5 text-xs text-muted-foreground border-t border-border pt-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Guaranteed {selectedTier.impressions} Targeted Impressions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Cross-Platform Social Media Broadcast Included</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Category Modal Selector */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-500" /> Select Target Category
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsCategoryModalOpen(false);
                    }}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all text-left ${
                      selectedCategory.id === cat.id
                        ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30"
                        : "bg-background border-border hover:border-amber-500/40"
                    }`}
                  >
                    <h4 className="font-bold text-sm text-foreground">{cat.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{cat.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
