/**
 * YouTube API Service for Live News Channels
 * Fetches live stream status from African, European, USA & Canadian news channels
 * Uses backend proxy to bypass HTTP referrer restrictions
 */

// Fallback sample data when API fails or no key provided
const SAMPLE_LIVE_CHANNELS = [
  { id: 's1', title: 'Channels Television - LIVE', channelName: 'Channels Television', videoId: '5qap5aO4i9A', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '125K watching', country: 'Nigeria', category: 'africa' },
  { id: 's2', title: 'FRANCE 24 English - LIVE', channelName: 'FRANCE 24', videoId: '2x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '89K watching', country: 'France', category: 'europe' },
  { id: 's3', title: 'ABC News Live', channelName: 'ABC News', videoId: 'w_Ma8oQLmSM', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '256K watching', country: 'USA', category: 'usa' },
  { id: 's4', title: 'DW News - LIVE', channelName: 'DW News', videoId: 'DX68Dd9lD8w', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '45K watching', country: 'Germany', category: 'europe' },
  { id: 's5', title: 'CBC News - LIVE', channelName: 'CBC News', videoId: '5x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '32K watching', country: 'Canada', category: 'canada' },
  { id: 's6', title: 'Arise News - LIVE', channelName: 'Arise News', videoId: '6x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '18K watching', country: 'Pan-African', category: 'africa' },
  { id: 's7', title: 'SABC News - LIVE', channelName: 'SABC News', videoId: '7x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '22K watching', country: 'South Africa', category: 'africa' },
  { id: 's8', title: 'Euronews Live', channelName: 'Euronews', videoId: 'py5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '67K watching', country: 'Europe', category: 'europe' },
];

export interface LiveChannel {
  id: string;
  title: string;
  channelName: string;
  videoId: string;
  thumbnail: string;
  isLive: boolean;
  views: string;
  country: string;
  category: string;
  channelId?: string;
}

// Fetch all live channels for a region using backend proxy
export async function fetchLiveChannels(category: string): Promise<LiveChannel[]> {
  try {
    // Try to fetch from backend proxy first
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/youtube/live-channels?category=${category}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Fetched ${data.length} channels from backend proxy`);
      return data;
    } else {
      console.warn('Backend proxy failed, falling back to sample data');
      throw new Error('Backend proxy unavailable');
    }
  } catch (error) {
    console.error('Error fetching from backend proxy:', error);
    // Fallback to sample data
    console.log('Using sample data as fallback');
    return SAMPLE_LIVE_CHANNELS.filter(ch => ch.category === category || category === 'all');
  }
}

// Get all available categories
export function getCategories() {
  return [
    { id: 'all', label: '🌍 All Regions', icon: '🌐' },
    { id: 'africa', label: '🌍 Africa', icon: '🌍' },
    { id: 'asia', label: '🌏 Asia', icon: '🌏' },
    { id: 'middle_east', label: '☪️ Middle East', icon: '☪️' },
    { id: 'latin_america', label: '🌎 Latin America', icon: '🌎' },
    { id: 'europe', label: '🌐 Europe', icon: '🌐' },
    { id: 'usa', label: '🇺🇸 USA', icon: '🇺🇸' },
    { id: 'canada', label: '🇨🇦 Canada', icon: '🇨🇦' },
    { id: 'australia', label: '🇦🇺 Australia', icon: '🇦🇺' },
  ];
}

// Get trending news videos by search query
export async function getTrendingNewsVideos(searchQuery: string, maxResults: number = 5): Promise<LiveChannel[]> {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/youtube/trending?query=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Fetched ${data.length} trending videos from backend proxy`);
      return data;
    } else {
      console.warn('Backend proxy failed for trending videos, falling back to sample data');
      throw new Error('Backend proxy unavailable');
    }
  } catch (error) {
    console.error('Error fetching trending news videos:', error);
    // Return empty array as fallback
    return [];
  }
}

export { SAMPLE_LIVE_CHANNELS };
