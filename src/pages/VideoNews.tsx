
import { useState, useEffect, useRef } from "react";
import { Play, ExternalLink, Youtube, Radio, Tv, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReadProgressBar from "@/components/ReadProgressBar";
import { SkeletonGrid } from "@/components/SkeletonCard";
import { HlsPlayer } from "@/components/HlsPlayer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SandboxedIframe } from "@/components/SandboxedIframe";

interface LiveStream {
  id: number;
  match_id: string;
  match_title: string;
  home_team: string;
  away_team: string;
  league: string;
  stream_url: string;
  stream_type: 'hls' | 'iframe';
  quality: string;
  language: string;
}

interface VideoChannel {
  id: string;
  title: string;
  embedUrl: string;
  thumbnail: string;
  category: string;
  country: string;
  source: string;
  type: 'youtube' | 'iframe';
}

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
}

const VIDEO_CHANNELS: VideoChannel[] = [
  // 🔴 LIVE MATCH — Featured at top
  {
    id: 'fifa-wc-arg-egy',
    title: '🔴 LIVE | Argentina vs Egypt | FIFA World Cup 2026™ Round of 16',
    embedUrl: 'https://www.youtube.com/embed/RHV6tEOgFu0',
    thumbnail: 'https://img.youtube.com/vi/RHV6tEOgFu0/mqdefault.jpg',
    category: 'sports',
    country: 'Pan-African',
    source: 'SportyTV NG',
    type: 'youtube'
  },
  // Nigeria
  {
    id: 'tvc-news',
    title: 'TVC News International Livestream',
    embedUrl: 'https://www.youtube.com/embed/Mv14aabg4mA',
    thumbnail: 'https://img.youtube.com/vi/Mv14aabg4mA/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'TVC News',
    type: 'youtube'
  },
  {
    id: 'nta-live',
    title: 'NTA News Live',
    embedUrl: 'https://www.youtube.com/embed/v78S_4N2KCs',
    thumbnail: 'https://img.youtube.com/vi/v78S_4N2KCs/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'NTA',
    type: 'youtube'
  },
  {
    id: 'trust-tv',
    title: 'TRUST TV LIVE',
    embedUrl: 'https://www.youtube.com/embed/wY6rUgx2cY0',
    thumbnail: 'https://img.youtube.com/vi/wY6rUgx2cY0/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'TRUST TV',
    type: 'youtube'
  },
  {
    id: 'silverbird-tv',
    title: 'Silverbird TV Live',
    embedUrl: 'https://www.youtube.com/embed/6hBTFGSMBxo',
    thumbnail: 'https://img.youtube.com/vi/6hBTFGSMBxo/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'Silverbird TV',
    type: 'youtube'
  },
  {
    id: 'channels-tv',
    title: 'CHANNELS TELEVISION | LIVE',
    embedUrl: 'https://www.youtube.com/embed/W8nThq62Vb4',
    thumbnail: 'https://img.youtube.com/vi/W8nThq62Vb4/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'Channels TV',
    type: 'youtube'
  },
  {
    id: 'arise-news',
    title: 'Arise News Live',
    embedUrl: 'https://www.youtube.com/embed/x4wL-fWyhI0',
    thumbnail: 'https://img.youtube.com/vi/x4wL-fWyhI0/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'Arise News',
    type: 'youtube'
  },
  
  // Pan-African
  {
    id: 'africanews',
    title: 'Africanews Live Timeline',
    embedUrl: '//www.africanews.com/embed/timeline',
    thumbnail: 'https://www.africanews.com/assets/images/logo.png',
    category: 'africa',
    country: 'Pan-African',
    source: 'Africanews',
    type: 'iframe'
  },
  {
    id: 'al-jazeera',
    title: '🔴 Al Jazeera English | Live',
    embedUrl: 'https://www.youtube.com/embed/gCNeDWCI0vo',
    thumbnail: 'https://img.youtube.com/vi/gCNeDWCI0vo/mqdefault.jpg',
    category: 'africa',
    country: 'Qatar',
    source: 'Al Jazeera',
    type: 'youtube'
  },
  {
    id: 'african-news-playlist',
    title: 'African News Playlist',
    embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLL92dfFL9ZdLBqPubKZR8VFNU7K7QCW_m',
    thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400',
    category: 'africa',
    country: 'Pan-African',
    source: 'YouTube Playlist',
    type: 'youtube'
  },

  {
    id: 'africanews-english-live',
    title: 'Africanews English Live',
    embedUrl: 'https://www.youtube.com/embed/NQjabLGdP5g',
    thumbnail: 'https://img.youtube.com/vi/NQjabLGdP5g/mqdefault.jpg',
    category: 'africa',
    country: 'Pan-African',
    source: 'Africanews',
    type: 'youtube'
  },
  {
    id: 'news-central-live',
    title: '🔴LIVE: News Central TV Live',
    embedUrl: 'https://www.youtube.com/embed/R2YPW8eY1O0',
    thumbnail: 'https://img.youtube.com/vi/R2YPW8eY1O0/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'News Central TV',
    type: 'youtube'
  },

  {
    id: 'sportyshow-defender',
    title: 'Heated argument on SportyShow - Defining a world-class defender',
    embedUrl: 'https://www.youtube.com/embed/14hmPROVAis',
    thumbnail: 'https://img.youtube.com/vi/14hmPROVAis/mqdefault.jpg',
    category: 'sports',
    country: 'Nigeria',
    source: 'SportyShow',
    type: 'youtube'
  },
  
  // Rumble Videos
  {
    id: 'rumble-1',
    title: 'Rumble Video 1',
    embedUrl: 'https://rumble.com/embed/v72sjgw/?pub=4',
    thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400',
    category: 'africa',
    country: 'Pan-African',
    source: 'Rumble',
    type: 'iframe'
  },
  {
    id: 'rumble-2',
    title: 'Rumble Video 2',
    embedUrl: 'https://rumble.com/embed/v73du0y/?pub=4',
    thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400',
    category: 'africa',
    country: 'Pan-African',
    source: 'Rumble',
    type: 'iframe'
  },
  {
    id: 'rumble-3',
    title: 'Rumble Video 3',
    embedUrl: 'https://rumble.com/embed/v73tf3y/?pub=4',
    thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400',
    category: 'africa',
    country: 'Pan-African',
    source: 'Rumble',
    type: 'iframe'
  },
  {
    id: 'rumble-4',
    title: 'Rumble Video 4',
    embedUrl: 'https://rumble.com/embed/v5xwnen/?pub=4',
    thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400',
    category: 'africa',
    country: 'Pan-African',
    source: 'Rumble',
    type: 'iframe'
  },
  
  // RT Live
  {
    id: 'rt-live',
    title: 'RT Live',
    embedUrl: 'https://www.rt.com/on-air/embed/',
    thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400',
    category: 'africa',
    country: 'Russia',
    source: 'RT',
    type: 'iframe'
  },

  
  // Ghana




  {
    id: 'joynews',
    title: 'JoyNews Live',
    embedUrl: 'https://www.youtube.com/embed/n4ThGAoXtyE',
    thumbnail: 'https://img.youtube.com/vi/n4ThGAoXtyE/mqdefault.jpg',
    category: 'ghana',
    country: 'Ghana',
    source: 'JoyNews',
    type: 'youtube'
  },
  {
    id: 'adom-tv',
    title: 'ADOM TV LIVE',
    embedUrl: 'https://www.youtube.com/embed/aUCB1AWfubU',
    thumbnail: 'https://img.youtube.com/vi/aUCB1AWfubU/mqdefault.jpg',
    category: 'ghana',
    country: 'Ghana',
    source: 'ADOM TV',
    type: 'youtube'
  },
  
  // Japan
  {
    id: 'teleasahi',
    title: 'テレ朝NEWS24 - Japan News 24H LIVE',
    embedUrl: 'https://www.youtube.com/embed/coYw-eVU0Ks',
    thumbnail: 'https://img.youtube.com/vi/coYw-eVU0Ks/mqdefault.jpg',
    category: 'japan',
    country: 'Japan',
    source: 'TV Asahi',
    type: 'youtube'
  },
  {
    id: 'kbc-news',
    title: 'KBC NEWS LIVE 24 - Fukuoka/Saga News',
    embedUrl: 'https://www.youtube.com/embed/4hpUbFP13-M',
    thumbnail: 'https://img.youtube.com/vi/4hpUbFP13-M/mqdefault.jpg',
    category: 'japan',
    country: 'Japan',
    source: 'KBC News',
    type: 'youtube'
  },
  {
    id: 'nhk-world',
    title: 'NHK World-Japan Live',
    embedUrl: 'https://www.youtube.com/embed/oKNZPqNMCKo',
    thumbnail: 'https://img.youtube.com/vi/oKNZPqNMCKo/mqdefault.jpg',
    category: 'japan',
    country: 'Japan',
    source: 'NHK World',
    type: 'youtube'
  },
  
  // Australia
  {
    id: 'abc-australia',
    title: 'ABC NEWS Australia Live',
    embedUrl: 'https://www.youtube.com/embed/vOTiJkg1voo',
    thumbnail: 'https://img.youtube.com/vi/vOTiJkg1voo/mqdefault.jpg',
    category: 'australia',
    country: 'Australia',
    source: 'ABC News',
    type: 'youtube'
  },
  
  // UK
  {
    id: 'sky-news',
    title: 'Watch Sky News',
    embedUrl: 'https://www.youtube.com/embed/YDvsBbKfLPA',
    thumbnail: 'https://img.youtube.com/vi/YDvsBbKfLPA/mqdefault.jpg',
    category: 'uk',
    country: 'UK',
    source: 'Sky News',
    type: 'youtube'
  },
  {
    id: 'bbc-news-live',
    title: 'BBC News Live',
    embedUrl: 'https://www.youtube.com/embed/w_Ma8oQLmSM',
    thumbnail: 'https://img.youtube.com/vi/w_Ma8oQLmSM/mqdefault.jpg',
    category: 'uk',
    country: 'UK',
    source: 'BBC News',
    type: 'youtube'
  },
  
  // USA
  {
    id: 'komo4',
    title: 'LIVE: KOMO 4 News',
    embedUrl: 'https://www.youtube.com/embed/RwfByXYpHNc',
    thumbnail: 'https://img.youtube.com/vi/RwfByXYpHNc/mqdefault.jpg',
    category: 'usa',
    country: 'USA',
    source: 'KOMO 4',
    type: 'youtube'
  },
  
  // Business/Finance
  {
    id: 'bloomberg',
    title: 'Bloomberg Originals Live',
    embedUrl: 'https://www.youtube.com/embed/DxmDPrfinXY',
    thumbnail: 'https://img.youtube.com/vi/DxmDPrfinXY/mqdefault.jpg',
    category: 'business',
    country: 'USA',
    source: 'Bloomberg',
    type: 'youtube'
  },
  {
    id: 'cnbc',
    title: 'CNBC Marathon - Documentaries 24/7',
    embedUrl: 'https://www.youtube.com/embed/9NyxcX3rhQs',
    thumbnail: 'https://img.youtube.com/vi/9NyxcX3rhQs/mqdefault.jpg',
    category: 'business',
    country: 'USA',
    source: 'CNBC',
    type: 'youtube'
  },
  
  // Religious/Christian
  {
    id: '3abn-kids',
    title: '3ABN Kids Network Live',
    embedUrl: 'https://www.youtube.com/embed/NJVAFt8RlU4',
    thumbnail: 'https://img.youtube.com/vi/NJVAFt8RlU4/mqdefault.jpg',
    category: 'religious',
    country: 'USA',
    source: '3ABN',
    type: 'youtube'
  },
  {
    id: 'cbn-news',
    title: 'CBN News - Because Truth Matters',
    embedUrl: 'https://www.youtube.com/embed/OviZBygJBOQ',
    thumbnail: 'https://img.youtube.com/vi/OviZBygJBOQ/mqdefault.jpg',
    category: 'religious',
    country: 'USA',
    source: 'CBN',
    type: 'youtube'
  },
  
  // Sports
  {
    id: 'a-spor',
    title: 'A Spor Canlı Yayın',
    embedUrl: 'https://www.youtube.com/embed/mgeW8Qm8-SY',
    thumbnail: 'https://img.youtube.com/vi/mgeW8Qm8-SY/mqdefault.jpg',
    category: 'sports',
    country: 'Turkey',
    source: 'A Spor',
    type: 'youtube'
  },

  {
    id: 'espn-fc',
    title: 'ESPN FC Daily Football News',
    embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLmqTCwMnxImkJzFHBuMFBMFMSGMFBMFM',
    thumbnail: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=250&fit=crop',
    category: 'sports',
    country: 'USA',
    source: 'ESPN FC',
    type: 'youtube'
  },
  {
    id: 'bein-sports',
    title: 'beIN SPORTS HABER Canlı Yayını',
    embedUrl: 'https://www.youtube.com/embed/9xVXWLwT0vA',
    thumbnail: 'https://img.youtube.com/vi/9xVXWLwT0vA/mqdefault.jpg',
    category: 'sports',
    country: 'Turkey',
    source: 'beIN SPORTS',
    type: 'youtube'
  },
  {
    id: 'sportyshow',
    title: 'SportyShow Africa — Football Talk',
    embedUrl: 'https://www.youtube.com/embed/14hmPROVAis',
    thumbnail: 'https://img.youtube.com/vi/14hmPROVAis/mqdefault.jpg',
    category: 'sports',
    country: 'Nigeria',
    source: 'SportyShow',
    type: 'youtube'
  },
  {
    id: 'sky-sports-news',
    title: 'Sky Sports News Live',
    embedUrl: 'https://www.youtube.com/embed/YDvsBbKfLPA',
    thumbnail: 'https://img.youtube.com/vi/YDvsBbKfLPA/mqdefault.jpg',
    category: 'sports',
    country: 'UK',
    source: 'Sky Sports',
    type: 'youtube'
  },
  // Breaking News - US/Iran
  {
    id: 'us-iran-attack-live',
    title: '🔴 America Attack On Iran LIVE | US launches strikes on Iran | Trump',
    embedUrl: 'https://www.youtube.com/embed/dCtOYnYFHaE',
    thumbnail: 'https://img.youtube.com/vi/dCtOYnYFHaE/mqdefault.jpg',
    category: 'breaking',
    country: 'USA',
    source: 'Breaking News',
    type: 'youtube'
  },
  {
    id: 'cnn-live-24-7',
    title: 'CNN Headlines: 24/7 Live News',
    embedUrl: 'https://www.youtube.com/embed/GotlA1KKWoo',
    thumbnail: 'https://img.youtube.com/vi/GotlA1KKWoo/mqdefault.jpg',
    category: 'usa',
    country: 'USA',
    source: 'CNN',
    type: 'youtube'
  },
  {
    id: 'trump-emergency-alert',
    title: '🔴 US News LIVE: Trump Issues Emergency Alert | Donald Trump LIVE',
    embedUrl: 'https://www.youtube.com/embed/OWe9e12T25A',
    thumbnail: 'https://img.youtube.com/vi/OWe9e12T25A/mqdefault.jpg',
    category: 'breaking',
    country: 'USA',
    source: 'US News Live',
    type: 'youtube'
  },
  {
    id: 'trump-ceasefire-iran',
    title: '🔴 BIG BREAKING | Trump Declares Ceasefire With Iran Is Over | Iran US War Live',
    embedUrl: 'https://www.youtube.com/embed/M-37rXzJpcc',
    thumbnail: 'https://img.youtube.com/vi/M-37rXzJpcc/mqdefault.jpg',
    category: 'breaking',
    country: 'USA',
    source: 'Breaking News',
    type: 'youtube'
  },
  {
    id: 'iran-nuclear-live',
    title: '🔴 IRAN NEWS LIVE | Nuclear Attack | Araghchi final warning | Trump Iran war',
    embedUrl: 'https://www.youtube.com/embed/Rj27ScFkph4',
    thumbnail: 'https://img.youtube.com/vi/Rj27ScFkph4/mqdefault.jpg',
    category: 'breaking',
    country: 'USA',
    source: 'Iran News Live',
    type: 'youtube'
  },
  {
    id: 'cbs-news-live',
    title: 'LIVE: Breaking News and Top Stories on CBS News 24/7',
    embedUrl: 'https://www.youtube.com/embed/rFmmjI-vM-c',
    thumbnail: 'https://img.youtube.com/vi/rFmmjI-vM-c/mqdefault.jpg',
    category: 'usa',
    country: 'USA',
    source: 'CBS News',
    type: 'youtube'
  },
  {
    id: 'nbc-news-live',
    title: 'LIVE: NBC News NOW',
    embedUrl: 'https://www.youtube.com/embed/S4oCC6hVf0Y',
    thumbnail: 'https://img.youtube.com/vi/S4oCC6hVf0Y/mqdefault.jpg',
    category: 'usa',
    country: 'USA',
    source: 'NBC News',
    type: 'youtube'
  },
  {
    id: 'arg-egy-wc2026',
    title: '🔴 LIVE | Argentina vs Egypt | FIFA World Cup 2026™ R16 | SportyTV NG',
    embedUrl: 'https://www.youtube.com/embed/RHV6tEOgFu0',
    thumbnail: 'https://img.youtube.com/vi/RHV6tEOgFu0/mqdefault.jpg',
    category: 'sports',
    country: 'Pan-African',
    source: 'SportyTV NG',
    type: 'youtube'
  },
  {
    id: 'caf-football',
    title: 'CAF — African Football Official',
    embedUrl: 'https://www.youtube.com/embed/videoseries?list=PLDz6LPCQH9oMFBMFMSGMFBMFMSGMFBMFM',
    thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=250&fit=crop',
    category: 'sports',
    country: 'Pan-African',
    source: 'CAF',
    type: 'youtube'
  }
];

const LazyIframe = ({ embedUrl, thumbnail, title, autoPlay = false }: { embedUrl: string, thumbnail: string, title: string, autoPlay?: boolean }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoPlay) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setIsLoaded(true);
            observer.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [autoPlay]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {!isLoaded ? (
        <div 
          className="absolute inset-0 cursor-pointer group bg-zinc-900"
          onClick={() => setIsLoaded(true)}
        >
          <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-80" loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/20 transition-colors">
            <div className="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)] group-hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
          </div>
        </div>
      ) : (
        <iframe
          src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      )}
    </div>
  );
};

const VideoNews = () => {
  const [activeChannel, setActiveChannel] = useState<VideoChannel>(() => {
    try {
      const saved = localStorage.getItem("realssa_last_channel_id");
      if (saved) {
        const found = VIDEO_CHANNELS.find(c => c.id === saved);
        if (found) return found;
      }
    } catch (e) {}
    return VIDEO_CHANNELS[0];
  });

  const changeChannel = (channel: VideoChannel) => {
    setActiveChannel(channel);
    try {
      localStorage.setItem("realssa_last_channel_id", channel.id);
    } catch (e) {}
  };

  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const mainPlayerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [category, setCategory] = useState<string>("all");
  
  const [dynamicVideos, setDynamicVideos] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'tv' | 'matches'>('tv');
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);

  const STATIC_LIVE_MATCHES: LiveStream[] = [
    {
      id: 9001,
      match_id: 'arg-egy-wc2026',
      match_title: '🔴 LIVE | Argentina vs Egypt | FIFA World Cup 2026™ Round of 16',
      home_team: 'Argentina',
      away_team: 'Egypt',
      league: 'FIFA World Cup 2026',
      stream_url: 'https://www.youtube.com/embed/RHV6tEOgFu0',
      stream_type: 'iframe',
      quality: 'HD',
      language: 'English',
    }
  ];

  // Fetch live streams
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await fetchWithRetry(apiUrl('/api/streams/live'));
        if (res && res.ok) {
          const data = await res.json();
          const merged = [...STATIC_LIVE_MATCHES, ...(data || [])];
          setLiveStreams(merged);
          setActiveStream(merged[0]);
        } else {
          setLiveStreams(STATIC_LIVE_MATCHES);
          setActiveStream(STATIC_LIVE_MATCHES[0]);
        }
      } catch (err) {
        console.error("Error fetching live streams:", err);
        setLiveStreams(STATIC_LIVE_MATCHES);
        setActiveStream(STATIC_LIVE_MATCHES[0]);
      }
    };
    fetchStreams();
  }, []);

  // Fetch dynamic videos from backend
  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = category === 'all' 
          ? apiUrl('/api/videos') 
          : apiUrl(`/api/videos?category=${category}`);
        
        const response = await fetchWithRetry(url);
        if (response) {
          const data = await response.json();
          setDynamicVideos(Array.isArray(data) ? data : (data.articles || []));
        } else {
          setError("Could not load videos.");
        }
      } catch (err) {
        console.error("Error fetching videos:", err);
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setCategory(searchTerm.trim().toLowerCase());
    } else {
      setCategory("all");
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMiniPlayer(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0.1 }
    );
    
    if (mainPlayerRef.current) {
      observer.observe(mainPlayerRef.current);
    }
    
    return () => observer.disconnect();
  }, [activeChannel]);

  const [channelCategory, setChannelCategory] = useState<string>('all');
  const CHANNEL_CATS = ['all', 'breaking', 'nigeria', 'africa', 'usa', 'uk', 'sports', 'business', 'ghana', 'japan', 'australia', 'religious'];
  const featuredChannels = channelCategory === 'all'
    ? VIDEO_CHANNELS
    : VIDEO_CHANNELS.filter(c => c.category === channelCategory);

  return (
    <div className="min-h-screen bg-background">
      <ReadProgressBar />
      <Header />
      
      {/* Featured Live TV / Matches Section */}
      <div className="bg-zinc-950 text-white pt-8 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-2">
              <Radio className="h-6 w-6 text-red-500 animate-pulse" />
              <h1 className="text-2xl md:text-3xl font-bold">
                {activeTab === 'tv' ? 'Featured Live TV' : 'Live Matches'}
              </h1>
            </div>
            
            <div className="flex p-1 bg-zinc-900 rounded-lg">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tv' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                onClick={() => setActiveTab('tv')}
              >
                Live TV
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'matches' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                onClick={() => setActiveTab('matches')}
              >
                Live Matches {liveStreams.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{liveStreams.length}</span>}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Player */}
            <div className="lg:col-span-2" ref={mainPlayerRef}>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
                <ErrorBoundary name="VideoNewsMainPlayer">
                  {activeTab === 'tv' ? (
                    <LazyIframe 
                      key={activeChannel.id}
                      embedUrl={activeChannel.embedUrl}
                      thumbnail={activeChannel.thumbnail}
                      title={activeChannel.title}
                      autoPlay={true}
                    />
                  ) : activeStream ? (
                    activeStream.stream_type === 'hls' ? (
                      <HlsPlayer src={activeStream.stream_url} autoPlay controls />
                    ) : (
                      <SandboxedIframe src={activeStream.stream_url} />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                      No live streams currently available.
                    </div>
                  )}
                </ErrorBoundary>
              </div>
              <div className="mt-4">
                <h2 className="text-2xl font-bold">
                  {activeTab === 'tv' ? activeChannel.title : activeStream?.match_title || "No Live Matches"}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Tv className="h-4 w-4"/> 
                    {activeTab === 'tv' ? activeChannel.source : (activeStream?.league || "Sports")}
                  </span>
                  {activeTab === 'matches' && activeStream && (
                    <span className="flex items-center gap-1 capitalize px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">
                      {activeStream.quality} • {activeStream.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1"><Radio className="h-4 w-4 text-red-500"/> LIVE</span>
                </div>
              </div>
            </div>
            
            {/* Channel List */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 h-fit max-h-[600px] overflow-y-auto custom-scrollbar">
              <h3 className="font-semibold text-lg mb-3 text-zinc-200">
                {activeTab === 'tv' ? `All Channels (${featuredChannels.length})` : 'Live Match Streams'}
              </h3>
              {/* Category filter tabs */}
              {activeTab === 'tv' && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {CHANNEL_CATS.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setChannelCategory(cat)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize transition-colors ${
                        channelCategory === cat
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat === 'all' ? `All (${VIDEO_CHANNELS.length})` : cat}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                {activeTab === 'tv' ? featuredChannels.map(channel => (
                  <div 
                    key={channel.id}
                    onClick={() => changeChannel(channel)}
                    className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-all duration-300 ${activeChannel.id === channel.id ? 'bg-primary/20 border border-primary/50' : 'hover:bg-zinc-800 border border-transparent'}`}
                  >
                    <div className="relative w-24 aspect-video rounded overflow-hidden shrink-0">
                      <img src={channel.thumbnail} alt={channel.title} className="object-cover w-full h-full" />
                      {activeChannel.id === channel.id && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-sm font-medium line-clamp-2 text-zinc-200">{channel.title}</h4>
                      <p className="text-xs text-zinc-500 mt-1">{channel.source}</p>
                    </div>
                  </div>
                )) : liveStreams.length > 0 ? liveStreams.map(stream => (
                  <div 
                    key={stream.id}
                    onClick={() => setActiveStream(stream)}
                    className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all duration-300 ${activeStream?.id === stream.id ? 'bg-red-500/10 border border-red-500/50' : 'hover:bg-zinc-800 border border-transparent bg-zinc-900/80'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold line-clamp-2 text-zinc-100">{stream.match_title}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                          {stream.stream_type === 'hls' ? 'PREMIUM' : 'WEB'}
                        </span>
                        <span className="text-xs text-zinc-400">{stream.league}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    No live matches found right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Dynamic Video Database Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Youtube className="h-8 w-8 text-red-600" />
              Global Video Network
            </h2>
            <p className="text-muted-foreground mt-1">Explore on-demand news clips from 200+ countries.</p>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search country (e.g. Algeria)" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
            {category !== 'all' && (
              <Button type="button" variant="outline" onClick={() => { setCategory('all'); setSearchTerm(''); }}>
                Clear
              </Button>
            )}
          </form>
        </div>
        
        {loading ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="text-center py-12 border rounded-xl bg-card">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => setCategory(category)} variant="outline">Try Again</Button>
          </div>
        ) : dynamicVideos.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-card">
            <Youtube className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium mb-2">No videos found</h3>
            <p className="text-muted-foreground">Try searching for a different country or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dynamicVideos.map((video) => (
              <a 
                key={video.id} 
                href={video.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col bg-card rounded-xl border shadow-sm hover:shadow-md overflow-hidden transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img 
                    src={video.image || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop'} 
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300"></div>
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
                    <Play className="h-3 w-3" />
                    <span>Watch</span>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full capitalize">
                      {video.category}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{video.author}</span>
                  </div>
                  <h3 className="font-semibold text-base line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                    {video.title}
                  </h3>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50">
                    <span>{new Date(video.date).toLocaleDateString()}</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      
      <Footer />

      {/* Sticky Mini Player */}
      {isMiniPlayer && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-8 w-64 md:w-80 aspect-video z-50 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-black animate-fade-in group">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-1 right-1 z-50 h-7 w-7 bg-black/60 hover:bg-black/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsMiniPlayer(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="absolute top-1 left-2 z-50 bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold text-red-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Radio className="h-3 w-3" /> PLAYING
          </div>
          <iframe
            src={`${activeChannel.embedUrl}${activeChannel.embedUrl.includes('?') ? '&' : '?'}autoplay=1&mute=1`}
            className="w-full h-full pointer-events-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
    </div>
  );
};

export default VideoNews;
