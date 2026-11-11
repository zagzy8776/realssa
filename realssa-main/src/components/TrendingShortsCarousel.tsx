import React, { useState } from 'react';
import { Play, X, Share2, Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { shareContent } from "@/lib/share";

interface ShortVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok';
  sourceName: string;
  embedUrl: string;
  likes: string;
  comments: string;
}

const TRENDING_VIDEOS: ShortVideo[] = [
  {
    id: 'v1',
    title: 'The family of late Mary Habila demands release of her body for burial',
    thumbnail: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500&auto=format&fit=crop&q=60',
    duration: '1:30',
    platform: 'facebook',
    sourceName: 'NTA Network',
    embedUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ffacebook%2Fvideos%2F10153236257262077%2F&show_text=0',
    likes: '12K',
    comments: '1.4K'
  },
  {
    id: 'v2',
    title: 'Mary Habila\'s death has raised many questions, and details are emerging',
    thumbnail: 'https://images.unsplash.com/photo-1585829365294-06d3b0c5a3a7?w=500&auto=format&fit=crop&q=60',
    duration: '0:41',
    platform: 'facebook',
    sourceName: 'Hilda Dokubo',
    embedUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ffacebook%2Fvideos%2F10153236257262077%2F&show_text=0',
    likes: '8.4K',
    comments: '920'
  },
  {
    id: 'v3',
    title: 'Mary Habilah\'s death requires deep investigation — Evans Ufeli',
    thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=60',
    duration: '1:44',
    platform: 'youtube',
    sourceName: 'News Central TV',
    embedUrl: 'https://www.youtube.com/embed/R2YPW8eY1O0?autoplay=1&modestbranding=1',
    likes: '18K',
    comments: '2.1K'
  },
  {
    id: 'v4',
    title: 'Hilda Dokubo on Instagram: "Mary Habila\'s death has raised many questions..."',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    duration: '2:50',
    platform: 'instagram',
    sourceName: 'Hilda Dokubo',
    embedUrl: 'https://www.instagram.com/p/DFd214SygJp/embed/',
    likes: '22K',
    comments: '3.5K'
  },
  {
    id: 'v5',
    title: 'How Exactly Did Mary Habila Die At David Umahi\'s Residence?',
    thumbnail: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=500&auto=format&fit=crop&q=60',
    duration: '2:52',
    platform: 'facebook',
    sourceName: 'Sahara Reporters',
    embedUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ffacebook%2Fvideos%2F10153236257262077%2F&show_text=0',
    likes: '14K',
    comments: '1.8K'
  },
  {
    id: 'v6',
    title: 'The family of late Mary Habila has appealed to the government for justice',
    thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=60',
    duration: '1:32',
    platform: 'instagram',
    sourceName: 'Channels TV',
    embedUrl: 'https://www.instagram.com/p/DFd214SygJp/embed/',
    likes: '9.8K',
    comments: '880'
  }
];

export default function TrendingShortsCarousel() {
  const { toast } = useToast();
  const [selectedVideo, setSelectedVideo] = useState<ShortVideo | null>(null);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <span className="text-red-500 font-extrabold text-xs">🔴</span>;
      case 'facebook':
        return <span className="text-blue-500 font-extrabold text-xs">🔵</span>;
      case 'instagram':
        return <span className="text-pink-500 font-extrabold text-xs">🟣</span>;
      default:
        return <span className="text-amber-500 font-extrabold text-xs">⚡</span>;
    }
  };

  const handleShare = async (video: ShortVideo, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const shareUrl = window.location.origin + `?video=${video.id}`;
      const shared = await shareContent({
        title: video.title,
        text: `Watch: ${video.title} on RealSSA News`,
        url: shareUrl
      });
      if (!shared) {
        toast({ title: "Link copied to clipboard!" });
      }
    } catch (err) {
      console.warn("Share failed", err);
    }
  };

  return (
    <section className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
        <h2 className="text-xl md:text-2xl font-display font-extrabold flex items-center gap-2">
          <span className="text-amber-500 animate-pulse">⚡</span> Trending Videos
        </h2>
        <span className="text-xs text-muted-foreground">Swipe to explore</span>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
        {TRENDING_VIDEOS.map((video) => (
          <div
            key={video.id}
            onClick={() => setSelectedVideo(video)}
            className="flex-shrink-0 w-44 md:w-52 aspect-[3/4] bg-card rounded-2xl border border-border/80 overflow-hidden shadow-lg hover:shadow-xl hover:border-border transition-all duration-300 snap-start cursor-pointer group relative"
          >
            {/* Thumbnail Image */}
            <div className="w-full h-full relative">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-3 bg-black/60 backdrop-blur-md text-white rounded-full group-hover:bg-amber-500 group-hover:text-black group-hover:scale-110 transition-all duration-300">
                <Play size={20} className="fill-current" />
              </div>
            </div>

            {/* Duration Badge */}
            <div className="absolute bottom-20 left-3 bg-black/70 backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded text-white/95">
              {video.duration}
            </div>

            {/* Title & Platform Branding */}
            <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end">
              <h3 className="text-white text-xs font-semibold leading-snug line-clamp-2 mb-1.5 drop-shadow">
                {video.title}
              </h3>
              
              <div className="flex items-center justify-between text-[10px] text-white/70">
                <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                  {getPlatformIcon(video.platform)}
                  <span className="font-bold">{video.sourceName}</span>
                </span>
                
                <button
                  onClick={(e) => handleShare(video, e)}
                  className="p-1 bg-black/50 hover:bg-amber-500 hover:text-black rounded-full transition-colors"
                >
                  <Share2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md aspect-[9/16] bg-zinc-950 rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header controls */}
            <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                {getPlatformIcon(selectedVideo.platform)}
                <span className="text-white text-xs font-bold">{selectedVideo.sourceName}</span>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="p-2 bg-black/50 hover:bg-red-600 rounded-full text-white backdrop-blur-md transition-colors shadow-md border border-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Embed Video Frame */}
            <div className="flex-1 w-full h-full relative bg-black">
              <iframe
                src={selectedVideo.embedUrl}
                title={selectedVideo.title}
                className="w-full h-full border-0"
                allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Title Overlay in Player */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/80 to-transparent border-t border-white/5">
              <h3 className="text-white text-sm font-bold leading-normal mb-3">
                {selectedVideo.title}
              </h3>
              
              <div className="flex items-center justify-between text-xs text-white/60">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5">
                    <Heart size={14} className="text-rose-500 fill-rose-500" /> {selectedVideo.likes}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-sky-400" /> {selectedVideo.comments}
                  </span>
                </div>
                <button
                  onClick={(e) => handleShare(selectedVideo, e)}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-amber-500 hover:text-black px-3 py-1.5 rounded-full transition-colors text-white font-semibold text-[11px]"
                >
                  <Share2 size={12} /> Share
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
