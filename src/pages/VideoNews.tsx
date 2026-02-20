/**
 * Video News Page
 * Displays LIVE news channels from RSS/Embed feeds - No API required
 */

import { useState } from "react";
import { Play, ExternalLink, Youtube, Radio, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReadProgressBar from "@/components/ReadProgressBar";

// Hardcoded video channels - RSS/Embed based (No API)
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

const VIDEO_CHANNELS: VideoChannel[] = [
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
    id: 'news-central',
    title: 'News Central TV Live',
    embedUrl: 'https://www.youtube.com/embed/YTn335B-vsw',
    thumbnail: 'https://img.youtube.com/vi/YTn335B-vsw/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'News Central',
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
    id: 'kagoshima',
    title: '鹿児島ニュース24 - Kagoshima News',
    embedUrl: 'https://www.youtube.com/embed/zmPSSDDuKKk',
    thumbnail: 'https://img.youtube.com/vi/zmPSSDDuKKk/mqdefault.jpg',
    category: 'japan',
    country: 'Japan',
    source: 'Kagoshima News',
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
    id: 'gb-news',
    title: 'GB News Live: Watch GB News 24/7',
    embedUrl: 'https://www.youtube.com/embed/QliL4CGc7iY',
    thumbnail: 'https://img.youtube.com/vi/QliL4CGc7iY/mqdefault.jpg',
    category: 'uk',
    country: 'UK',
    source: 'GB News',
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
    id: 'nigerian-senate',
    title: 'Senate Condemns Attack in Benue and Plateau State',
    embedUrl: 'https://www.youtube.com/embed/plgnnqhG_og',
    thumbnail: 'https://img.youtube.com/vi/plgnnqhG_og/mqdefault.jpg',
    category: 'nigeria',
    country: 'Nigeria',
    source: 'Nigerian Senate',
    type: 'youtube'
  },
  {
    id: 'premier-league-mvp',
    title: 'Our Premier League Players Reveal The Best Player From Their Country',
    embedUrl: 'https://www.youtube.com/embed/58s4Nn9Qr2Q',
    thumbnail: 'https://img.youtube.com/vi/58s4Nn9Qr2Q/mqdefault.jpg',
    category: 'sports',
    country: 'UK',
    source: 'Premier League',
    type: 'youtube'
  },
  {
    id: 'snooker-live',
    title: 'LIVE | The Player Championship - Day 1 | World Snooker Tour | SportyTV',
    embedUrl: 'https://www.youtube.com/embed/52JK2IerlO8',
    thumbnail: 'https://img.youtube.com/vi/52JK2IerlO8/mqdefault.jpg',
    category: 'sports',
    country: 'UK',
    source: 'World Snooker Tour',
    type: 'youtube'
  },
  {
    id: 'mvp-podcast',
    title: 'The MVP Podcast | Champions League Play-Off Preview | Episode 7',
    embedUrl: 'https://www.youtube.com/embed/VT0gUSfQESc',
    thumbnail: 'https://img.youtube.com/vi/VT0gUSfQESc/mqdefault.jpg',
    category: 'sports',
    country: 'UK',
    source: 'MVP Podcast',
    type: 'youtube'
  },
  {
    id: 'liv-golf',
    title: 'LIV Golf Adelaide: Full Tournament Highlights | Golf on FOX',
    embedUrl: 'https://www.youtube.com/embed/RZdRQApaeV4',
    thumbnail: 'https://img.youtube.com/vi/RZdRQApaeV4/mqdefault.jpg',
    category: 'sports',
    country: 'Australia',
    source: 'LIV Golf',
    type: 'youtube'
  },
  {
    id: 'wcw-live',
    title: 'LIVE: WCW Watch Party | Full PPVs, Classic episodes of Nitro & Thunder, Full Matches and MORE',
    embedUrl: 'https://www.youtube.com/embed/lD8PpHHJvms',
    thumbnail: 'https://img.youtube.com/vi/lD8PpHHJvms/mqdefault.jpg',
    category: 'sports',
    country: 'USA',
    source: 'WCW',
    type: 'youtube'
  },
  {
    id: 'streaming-top-calcio',
    title: 'STREAMING TOP CALCIO 24 HD',
    embedUrl: 'https://www.youtube.com/embed/smcQvzsh5Qo',
    thumbnail: 'https://img.youtube.com/vi/smcQvzsh5Qo/mqdefault.jpg',
    category: 'sports',
    country: 'Italy',
    source: 'Top Calcio',
    type: 'youtube'
  },
  {
    id: 'canli-5-gollu',
    title: '#CANLI | 5 Gollü galibiyetin şifreleri ne?',
    embedUrl: 'https://www.youtube.com/embed/ih2KAtA50I4',
    thumbnail: 'https://img.youtube.com/vi/ih2KAtA50I4/mqdefault.jpg',
    category: 'sports',
    country: 'Turkey',
    source: 'Turkish Sports',
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
  }
];

const CATEGORIES = [
  { id: 'all', label: '🌍 All Channels', icon: '🌐' },
  { id: 'nigeria', label: '🇳🇬 Nigeria', icon: '🇳🇬' },
  { id: 'ghana', label: '🇬🇭 Ghana', icon: '🇬🇭' },
  { id: 'africa', label: '🌍 Pan-African', icon: '🌍' },
  { id: 'uk', label: '🇬🇧 UK', icon: '🇬🇧' },
  { id: 'usa', label: '🇺🇸 USA', icon: '🇺🇸' },
  { id: 'japan', label: '🇯🇵 Japan', icon: '🇯🇵' },
  { id: 'australia', label: '🇦🇺 Australia', icon: '🇦🇺' },
  { id: 'business', label: '💼 Business', icon: '💼' },
  { id: 'religious', label: '✝️ Religious', icon: '✝️' },
  { id: 'sports', label: '⚽ Sports', icon: '⚽' },
];

const VideoNews = () => {
  const [selectedChannel, setSelectedChannel] = useState<VideoChannel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Filter channels by category
  const filteredChannels = selectedCategory === 'all' 
    ? VIDEO_CHANNELS 
    : VIDEO_CHANNELS.filter(ch => ch.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#F4F1DE] dark:bg-[#1A1A2E]">
      <ReadProgressBar />
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <Youtube className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1A1A2E] dark:text-white">
                <span className="text-[#E63946]">VIDEO</span> NEWS
              </h1>
              <p className="text-muted-foreground">Live TV Channels from Around the World</p>
            </div>
          </div>
        </div>

        {/* Live Badge */}
        <div className="mb-6 bg-[#1A1A2E] dark:bg-[#0F0F1A] rounded-xl overflow-hidden">
          <div className="flex items-center">
            <div className="bg-red-600 px-4 py-2 flex items-center gap-2 font-bold text-white">
              <span className="animate-pulse">●</span> LIVE TV
            </div>
            <div className="flex-1 py-3 overflow-hidden">
              <div className="flex animate-marquee whitespace-nowrap">
                {filteredChannels.slice(0, 5).map((ch, i) => (
                  <span key={i} className="mx-6 text-white/80 text-sm">
                    {ch.source} • {ch.country} • {ch.title.substring(0, 50)}...
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 ${
                selectedCategory === cat.id ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-8 bg-red-600 rounded-full" />
          <h2 className="font-display text-2xl font-bold text-[#1A1A2E] dark:text-white">
            📺 {selectedCategory === 'all' ? 'All Live Channels' : CATEGORIES.find(c => c.id === selectedCategory)?.label}
          </h2>
          <span className="ml-auto text-xs bg-red-600 text-white px-3 py-1 rounded-full font-bold">
            {filteredChannels.length} Channels
          </span>
        </div>

        {/* Live Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredChannels.map((channel) => (
            <Card
              key={channel.id}
              className="group cursor-pointer overflow-hidden hover:shadow-2xl transition-all bg-white dark:bg-[#16213E] border-2 border-transparent hover:border-red-600"
              onClick={() => setSelectedChannel(channel)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-900">
                <img
                  src={channel.thumbnail}
                  alt={channel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400";
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-8 h-8 text-white fill-current ml-1" />
                  </div>
                </div>
                <div className="absolute top-2 left-2 flex gap-2">
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold flex items-center gap-1">
                    <Radio className="w-3 h-3" /> LIVE
                  </span>
                  <span className="bg-[#1A1A2E]/80 text-white text-xs px-2 py-1 rounded">
                    {channel.country}
                  </span>
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="font-bold line-clamp-2 mb-2 text-[#1A1A2E] dark:text-white group-hover:text-[#E63946] transition-colors">
                  {channel.title}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tv className="w-4 h-4" />
                    <span>{channel.source}</span>
                  </div>
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">
                    {channel.type === 'youtube' ? 'YouTube' : 'Stream'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Channels Found */}
        {filteredChannels.length === 0 && (
          <div className="text-center py-12">
            <Youtube className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No channels found</h3>
            <p className="text-muted-foreground">Try selecting a different category</p>
          </div>
        )}
      </main>

      {/* Video Modal */}
      {selectedChannel && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1A2E] rounded-2xl max-w-5xl w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-lg text-[#1A1A2E] dark:text-white line-clamp-1">
                  {selectedChannel.title}
                </h2>
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Radio className="w-3 h-3" /> LIVE
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChannel(null)}
                className="text-[#1A1A2E] dark:text-white"
              >
                ✕
              </Button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={selectedChannel.embedUrl}
                title={selectedChannel.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                loading="lazy"
              />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-[#0F0F1A]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#1A1A2E] dark:text-white">
                    {selectedChannel.source}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedChannel.country} • RSS/Embed Stream
                  </p>
                </div>
                <a
                  href={selectedChannel.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default VideoNews;
