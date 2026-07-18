import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Globe, Users, FileText, Share2, ArrowLeft, Twitter, Info, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { useToast } from "@/hooks/use-toast";
import NewsCard from '@/components/NewsCard';

interface PublisherMetadata {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  bio: string;
  wikipedia_url: string;
  follower_metrics: {
    followers?: string;
    platform_handles?: {
      twitter?: string;
      facebook?: string;
    };
  };
}

interface SocialPost {
  id: number;
  platform: string;
  post_text: string;
  media_url?: string;
  post_url?: string;
  published_at: string;
}

interface Article {
  id: string;
  story_hash: string;
  title: string;
  summary: string;
  link: string;
  image_url: string;
  source: string;
  published_at: string;
  category: string;
}

export const PublisherHub: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [publisher, setPublisher] = useState<PublisherMetadata | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'articles' | 'social'>('articles');

  useEffect(() => {
    const fetchPublisherData = async () => {
      try {
        setLoading(true);
        // 1. Fetch metadata
        const pubRes = await axios.get(`/api/publishers/${slug}`);
        setPublisher(pubRes.data);

        // 2. Fetch articles and posts concurrently
        const [artRes, postsRes] = await Promise.all([
          axios.get(`/api/publishers/${slug}/articles`),
          axios.get(`/api/publishers/${slug}/posts`),
        ]);

        setArticles(artRes.data);
        setPosts(postsRes.data);
      } catch (err: any) {
        console.error('Error fetching publisher details:', err);
        toast({
          title: "Error Loading Profile",
          description: "Could not fetch publisher profile details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPublisherData();
    }
  }, [slug, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-3 bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Loading publisher profile...</p>
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-background px-4 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive animate-bounce" />
        <h2 className="text-xl font-bold">Publisher Profile Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">We couldn't locate this publisher in our news index database.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline mt-2">
          <ArrowLeft className="w-4 h-4" /> Back to Home Feed
        </Link>
      </div>
    );
  }

  const twitterHandle = publisher.follower_metrics?.platform_handles?.twitter || slug;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* 1. Glassmorphism Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-teal-950 text-white py-8 px-4 border-b border-border shadow-md">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Link to="/" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition duration-200">
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <span className="text-sm font-semibold tracking-wider uppercase text-purple-200">Publisher Profile Hub</span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Publisher Logo */}
            {publisher.logo_url ? (
              <img
                src={publisher.logo_url}
                alt={publisher.name}
                className="w-20 h-20 rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl border-2 border-white/20 bg-white/10 flex items-center justify-center shadow-lg text-2xl font-bold">
                {publisher.name.charAt(0)}
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{publisher.name}</h1>
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  <Globe className="w-3.5 h-3.5" /> Verified Publisher
                </span>
              </div>

              {publisher.bio && (
                <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                  {publisher.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-4 mt-4 text-xs font-medium text-slate-300">
                {publisher.follower_metrics?.followers && (
                  <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                    <Users className="w-3.5 h-3.5 text-purple-300" />
                    <span>{publisher.follower_metrics.followers} Followers</span>
                  </div>
                )}
                {publisher.wikipedia_url && (
                  <a
                    href={publisher.wikipedia_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:bg-white/10 hover:text-white transition duration-200"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-300" />
                    <span>About on Wikipedia</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tabs Switcher */}
      <div className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex">
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex-1 py-4 text-center font-bold text-sm border-b-2 transition duration-300 flex items-center justify-center gap-2 ${
              activeTab === 'articles'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Articles ({articles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex-1 py-4 text-center font-bold text-sm border-b-2 transition duration-300 flex items-center justify-center gap-2 ${
              activeTab === 'social'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Twitter className="w-4 h-4" />
            <span>X (Twitter) Feed</span>
          </button>
        </div>
      </div>

      {/* 3. Tab Workspace */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {activeTab === 'articles' ? (
          articles.length > 0 ? (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {articles.map((art) => (
                <NewsCard
                  key={art.id}
                  id={art.id}
                  title={art.title}
                  excerpt={art.summary}
                  category={art.category as any}
                  image={art.image_url}
                  readTime="3 min"
                  date={new Date(art.published_at).toLocaleDateString()}
                  sourceName={art.source}
                  externalLink={art.link}
                  showBookmark={true}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <FileText className="w-12 h-12 text-muted-foreground/30" />
              <h3 className="font-semibold text-lg text-muted-foreground">No articles indexed</h3>
              <p className="text-sm text-muted-foreground max-w-xs">We haven't parsed any RSS articles for {publisher.name} in the last 14 days.</p>
            </div>
          )
        ) : (
          posts.length > 0 ? (
            <div className="flex flex-col gap-4 max-w-xl mx-auto">
              {posts.map((post) => (
                <div key={post.id} className="bg-card rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3 transition hover:shadow-md duration-200">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span className="font-semibold flex items-center gap-1">
                      <Twitter className="w-3.5 h-3.5 text-sky-400" /> @{twitterHandle}
                    </span>
                    <span>{new Date(post.published_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{post.post_text}</p>
                  {post.media_url && (
                    <img src={post.media_url} alt="Media" className="rounded-lg max-h-60 w-full object-cover mt-1" />
                  )}
                  {post.post_url && (
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-500 font-semibold hover:underline flex items-center gap-1 self-start mt-2"
                    >
                      View on X (Twitter)
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center max-w-md mx-auto flex flex-col items-center justify-center gap-4 bg-card rounded-2xl p-6 border border-border shadow-sm">
              <Twitter className="w-12 h-12 text-sky-400 animate-pulse" />
              <h3 className="font-bold text-lg">No Twitter Feed Loaded</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Due to rate limits or connection disruptions, the X feed scraper was unable to refresh updates for this publisher profile.
              </p>
              <a
                href={`https://twitter.com/${twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm px-5 py-2.5 rounded-full transition shadow-md hover:scale-[1.02]"
              >
                View Updates Directly on X <Share2 className="w-4 h-4" />
              </a>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PublisherHub;
