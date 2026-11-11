import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { apiUrl } from '@/lib/api-base';

interface EmojiOption {
  id: string;
  emoji: string;
  label: string;
}

const EMOJIS: EmojiOption[] = [
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'angry', emoji: '😡', label: 'Angry' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'clap', emoji: '👏', label: 'Clap' },
  { id: 'shock', emoji: '😱', label: 'Wow' },
];

export default function LiveReacts({ articleId }: { articleId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number, emoji: string }[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`${apiUrl(`/api/articles/${articleId}/reactions`)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.counts) {
          const counts: Record<string, number> = {};
          data.counts.forEach((row: any) => { counts[row.emoji] = row.count; });
          setReactionCounts(counts);
        }
      })
      .catch(() => {});
  }, [articleId]);

  const handleReact = async (emojiObj: EmojiOption) => {
    setSelected(emojiObj.id);
    
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }

    // Add to floating animation array
    const newEmoji = { id: Date.now(), emoji: emojiObj.emoji };
    setFloatingEmojis(prev => [...prev, newEmoji]);

    // Remove from array after animation completes
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
    }, 2000);

    // Persist reaction to backend
    try {
      await fetch(`/api/articles/${articleId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: emojiObj.id }),
      }).catch(() => {});

      // Optimistically update count
      setReactionCounts(prev => ({
        ...prev,
        [emojiObj.id]: (prev[emojiObj.id] || 0) + 1,
      }));
    } catch (e) {
      // Silent fail
    }
  };

  return (
    <div className="py-6 border-t border-border mt-8 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-center">How does this make you feel?</h3>
      </div>
      
      <div className="flex justify-center items-center gap-2 sm:gap-4 relative">
        {EMOJIS.map((item) => (
          <button
            key={item.id}
            onClick={() => handleReact(item)}
            className={`flex flex-col items-center gap-1 transition-transform active:scale-90 ${
              selected === item.id ? 'scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
            }`}
          >
            <span className="text-3xl sm:text-4xl">{item.emoji}</span>
            {reactionCounts[item.id] && reactionCounts[item.id] > 0 && (
              <span className="text-[10px] font-bold bg-black/20 px-1.5 rounded-full">{reactionCounts[item.id]}</span>
            )}
          </button>
        ))}

        {/* Floating Animation Layer */}
        <AnimatePresence>
          {floatingEmojis.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
              animate={{ 
                opacity: 0, 
                y: -150, 
                x: (Math.random() - 0.5) * 100, // Random horizontal drift
                scale: 2 
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute text-5xl pointer-events-none"
              style={{ left: '50%', marginLeft: '-24px' }}
            >
              {e.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
