import React from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { shareContent } from '@/lib/share';

interface InviteButtonProps {
  className?: string;
  variant?: 'icon' | 'full';
}

export default function InviteButton({ className, variant = 'full' }: InviteButtonProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const shareData = {
      title: 'RealSSA News',
      text: 'Using this news app now, design is insane 🔥',
      url: 'https://realssanews.com.ng/download',
    };

    const sharedNatively = await shareContent(shareData);
    if (!sharedNatively) {
      toast({
        title: "Link Copied!",
        description: "Invite link copied to your clipboard.",
      });
    }
  };

  if (variant === 'icon') {
    return (
      <button 
        onClick={handleShare}
        className={cn("p-2 text-muted-foreground hover:text-primary transition-colors", className)}
        aria-label="Invite Friends"
      >
        <Share2 size={24} />
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={cn(
        "flex items-center gap-2 bg-gradient-gold text-black px-4 py-2 rounded-full font-bold shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95",
        className
      )}
    >
      <Share2 size={16} />
      <span>Invite Friends</span>
    </button>
  );
}
