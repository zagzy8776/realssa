import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

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

    // TODO: Send to backend
    // fetch(`/api/articles/${articleId}/react`, { method: 'POST', body: JSON.stringify({ emoji: emojiObj.id }) })
  };

  return (
    <div className="py-6 border-t border-border mt-8 relative">
      <h3 className="text-lg font-bold text-center mb-4">How does this make you feel?</h3>
      
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
