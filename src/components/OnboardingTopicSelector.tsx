import { useState, useEffect } from 'react';
import { Check, Sparkles } from 'lucide-react';

const TOPIC_KEY = 'realssa_user_selected_topics';
const ONBOARDED_KEY = 'realssa_onboarding_completed';

const TOPICS = [
  { id: 'nigeria', name: 'Nigeria News' },
  { id: 'sports', name: 'Football & Sports' },
  { id: 'business', name: 'Business & Naira Rates' },
  { id: 'tech', name: 'Tech & AI' },
  { id: 'entertainment', name: 'Entertainment & Movies' },
  { id: 'jobs', name: 'Jobs & Opportunities' },
];

export default function OnboardingTopicSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(['nigeria', 'sports']);

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
    // Reload window to instantly apply personalized feed filter
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-6 text-card-foreground">
        
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Welcome to RealSSA
          </div>
          <h2 className="text-xl font-bold tracking-tight">Customize Your Reading Feed</h2>
          <p className="text-sm text-muted-foreground">
            Featured stories based on your selected interests, plus stories You May Like.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {TOPICS.map(topic => {
            const isSelected = selected.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                <span>{topic.name}</span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={selected.length === 0}
          className="w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Start Reading Now
        </button>

      </div>
    </div>
  );
}
