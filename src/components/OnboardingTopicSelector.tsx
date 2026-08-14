import { useState, useEffect } from 'react';
import { Check, Sparkles, ArrowRight, Flame, Trophy, TrendingUp, Cpu, Film, Briefcase, Globe, Landmark, Coins } from 'lucide-react';

const TOPIC_KEY = 'realssa_user_selected_topics';
const ONBOARDED_KEY = 'realssa_onboarding_completed';

interface TopicItem {
  id: string;
  name: string;
  subtitle: string;
  icon: any;
  image: string;
  color: string;
}

const TOPICS: TopicItem[] = [
  {
    id: 'nigeria',
    name: 'Nigeria News',
    subtitle: 'Local politics, metro & breaking',
    icon: Flame,
    image: 'https://images.unsplash.com/photo-1618828665011-0abd973f7ad8?auto=format&fit=crop&w=600&q=80',
    color: 'from-emerald-900/90 to-black/90'
  },
  {
    id: 'sports',
    name: 'Football & Sports',
    subtitle: 'Premier League, Super Eagles & Live',
    icon: Trophy,
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80',
    color: 'from-amber-900/90 to-black/90'
  },
  {
    id: 'business',
    name: 'Business & Markets',
    subtitle: 'Naira rates, inflation & stocks',
    icon: TrendingUp,
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
    color: 'from-blue-900/90 to-black/90'
  },
  {
    id: 'tech',
    name: 'Tech & AI',
    subtitle: 'Gadgets, startups & innovation',
    icon: Cpu,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    color: 'from-purple-900/90 to-black/90'
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    subtitle: 'Nollywood, Afrobeats & Cinema',
    icon: Film,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    color: 'from-pink-900/90 to-black/90'
  },
  {
    id: 'jobs',
    name: 'Jobs & Career',
    subtitle: 'Hiring alerts & remote roles',
    icon: Briefcase,
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    color: 'from-cyan-900/90 to-black/90'
  },
  {
    id: 'world',
    name: 'World & Politics',
    subtitle: 'Global events & geopolitics',
    icon: Globe,
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    color: 'from-indigo-900/90 to-black/90'
  },
  {
    id: 'crypto',
    name: 'Crypto & FX',
    subtitle: 'Bitcoin, P2P & Forex rates',
    icon: Coins,
    image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=600&q=80',
    color: 'from-yellow-900/90 to-black/90'
  }
];

export default function OnboardingTopicSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(['nigeria', 'sports', 'business']);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDED_KEY);
    if (!done) {
      setIsOpen(true);
    }
  }, []);

  const toggleTopic = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    localStorage.setItem(TOPIC_KEY, JSON.stringify(selected));
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setIsOpen(false);
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-card-foreground my-auto relative overflow-hidden">
        
        {/* Header section with Pinterest style badge & counter */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold uppercase tracking-widest border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" /> Welcome to RealSSA
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif">
            What interests you?
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Select 2 or more topics to build your personalized feed.
          </p>

          {/* Selection indicator pill */}
          <div className="pt-1">
            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-muted text-foreground">
              <span className="text-primary font-bold">{selected.length}</span> {selected.length === 1 ? 'topic' : 'topics'} selected
            </span>
          </div>
        </div>

        {/* Pinterest Visual Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto p-1 custom-scrollbar">
          {TOPICS.map(topic => {
            const isSelected = selected.includes(topic.id);
            const Icon = topic.icon;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                className={`relative group h-32 rounded-2xl overflow-hidden text-left transition-all duration-300 transform active:scale-95 focus:outline-none border-2 ${
                  isSelected
                    ? 'border-primary ring-4 ring-primary/20 scale-[1.02] shadow-xl'
                    : 'border-border/50 hover:border-border hover:scale-[1.01]'
                }`}
              >
                {/* Background Image */}
                <img
                  src={topic.image}
                  alt={topic.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${
                    isSelected ? 'filter brightness-90' : 'filter brightness-75'
                  }`}
                  loading="lazy"
                />

                {/* Dark Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${topic.color}`} />

                {/* Selection Checkmark Badge */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-lg scale-100 rotate-0'
                        : 'bg-black/40 backdrop-blur-md text-white/70 border border-white/20 scale-90'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="absolute bottom-0 inset-x-0 p-3 z-10 flex flex-col justify-end">
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 drop-shadow-sm">
                    {topic.name}
                  </h3>
                  <p className="text-[11px] text-white/80 line-clamp-1 font-normal">
                    {topic.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={selected.length === 0}
            className="w-full py-3.5 px-6 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 group"
          >
            <span>Start Reading Now</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

      </div>
    </div>
  );
}
