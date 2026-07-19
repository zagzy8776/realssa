import { useEffect, useState, useRef } from 'react';
import { X, RefreshCw, ExternalLink, CheckCircle2, Users, FileText, Image as ImageIcon } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

interface SocialPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  externalLink: string;
  image?: string;
}

interface SocialFeedModalProps {
  open: boolean;
  onClose: () => void;
}

// Curated entity profiles — like Google's Knowledge Panel
const ENTITIES = [
  {
    handle: 'channelstv',
    name: 'Channels Television',
    bio: "Nigeria's leading 24-hour news television station. Breaking news, politics, business & more.",
    cover: 'https://pbs.twimg.com/profile_banners/19854920/1600000000/1500x500',
    avatar: 'https://pbs.twimg.com/profile_images/1234567890/channels_400x400.jpg',
    initials: 'CH',
    color: '#C0392B',
    verified: true,
    followers: '2.1M',
    category: 'News',
    flag: '🇳🇬',
  },
  {
    handle: 'PremiumTimesng',
    name: 'Premium Times',
    bio: 'Independent Nigerian newspaper. Investigative journalism, accountability & public interest reporting.',
    cover: '',
    avatar: '',
    initials: 'PT',
    color: '#1565C0',
    verified: true,
    followers: '890K',
    category: 'News',
    flag: '🇳🇬',
  },
  {
    handle: 'BBCAfrica',
    name: 'BBC Africa',
    bio: 'News, analysis and features from across the African continent by the BBC.',
    cover: '',
    avatar: '',
    initials: 'BB',
    color: '#B71C1C',
    verified: true,
    followers: '4.3M',
    category: 'News',
    flag: '🌍',
  },
  {
    handle: 'SuperSport',
    name: 'SuperSport',
    bio: "Africa's home of sport. Live scores, fixtures, results and breaking sports news.",
    cover: '',
    avatar: '',
    initials: 'SS',
    color: '#1B5E20',
    verified: true,
    followers: '1.8M',
    category: 'Sports',
    flag: '🌍',
  },
  {
    handle: 'AlJazeera',
    name: 'Al Jazeera English',
    bio: 'Breaking news, world news and video from Al Jazeera. Setting the news agenda.',
    cover: '',
    avatar: '',
    initials: 'AJ',
    color: '#E65100',
    verified: true,
    followers: '12.4M',
    category: 'News',
    flag: '🌍',
  },
  {
    handle: 'thenff',
    name: 'Nigeria Football Federation',
    bio: 'Official account of the Nigeria Football Federation. Home of the Super Eagles 🦅',
    cover: '',
    avatar: '',
    initials: 'NF',
    color: '#2E7D32',
    verified: true,
    followers: '340K',
    category: 'Sports',
    flag: '🇳🇬',
  },
];

type Tab = 'posts' | 'about';

function timeAgo(iso: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000 / 60);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  } catch { return ''; }
}

function cleanText(text: string) {
  return text.replace(/^RT @[\w]+:\s*/i, '').replace(/https?:\/\/\S+/g, '').trim();
}

const SocialFeedModal = ({ open, onClose }: SocialFeedModalProps) => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEntity, setActiveEntity] = useState(ENTITIES[0]);
  const [tab, setTab] = useState<Tab>('posts');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'News' | 'Sports'>('All');
  const overlayRef = useRef<HTMLDivElement>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/news/social?limit=60'));
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : data.articles || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) fetchPosts(); }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const visibleEntities = categoryFilter === 'All'
    ? ENTITIES
    : ENTITIES.filter(e => e.category === categoryFilter);

  // Posts for the active entity
  const entityPosts = posts.filter(p =>
    p.author?.toLowerCase().includes(activeEntity.handle.toLowerCase()) ||
    p.author?.toLowerCase().includes(activeEntity.name.toLowerCase().split(' ')[0])
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 780,
        maxHeight: '90vh',
        background: '#111118',
        borderRadius: 20,
        border: '1px solid #2a2535',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'panelIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid #2a2535',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* X logo */}
            <svg width="20" height="20" fill="#fff" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Social Profiles</span>
            <span style={{
              background: '#1DA1F2', color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em',
            }}>LIVE</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Category pills */}
            {(['All', 'News', 'Sports'] as const).map(c => (
              <button key={c} onClick={() => { setCategoryFilter(c); setActiveEntity(ENTITIES.find(e => c === 'All' || e.category === c) || ENTITIES[0]); }}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: categoryFilter === c ? '#2a2535' : 'transparent',
                  color: categoryFilter === c ? '#fff' : '#8C8494',
                }}
              >{c}</button>
            ))}
            <button onClick={fetchPosts} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C8494', display: 'flex', padding: 4 }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C8494', display: 'flex', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body: entity list + knowledge panel ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: entity list */}
          <div style={{
            width: 200, flexShrink: 0,
            borderRight: '1px solid #2a2535',
            overflowY: 'auto',
            padding: '8px 0',
          }}>
            {visibleEntities.map(entity => (
              <button
                key={entity.handle}
                onClick={() => { setActiveEntity(entity); setTab('posts'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: activeEntity.handle === entity.handle ? '#1e1a2a' : 'transparent',
                  borderLeft: activeEntity.handle === entity.handle ? '3px solid #1DA1F2' : '3px solid transparent',
                  transition: 'background 0.12s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: entity.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#fff',
                }}>
                  {entity.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                      {entity.name.split(' ')[0]}
                    </span>
                    {entity.verified && <CheckCircle2 size={11} color="#1DA1F2" fill="#1DA1F2" />}
                  </div>
                  <span style={{ color: '#8C8494', fontSize: 10 }}>{entity.flag} {entity.category}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Right: Knowledge Panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Cover photo */}
            <div style={{
              height: 90, flexShrink: 0, position: 'relative',
              background: `linear-gradient(135deg, ${activeEntity.color}cc 0%, #111118 100%)`,
              overflow: 'hidden',
            }}>
              {/* Decorative pattern */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.08,
                backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
                backgroundSize: '12px 12px',
              }} />
              <div style={{
                position: 'absolute', bottom: -18, left: 20,
                width: 56, height: 56, borderRadius: '50%',
                background: activeEntity.color,
                border: '3px solid #111118',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 900, color: '#fff',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                zIndex: 2,
              }}>
                {activeEntity.initials}
              </div>
            </div>

            {/* Profile info */}
            <div style={{ padding: '24px 20px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>{activeEntity.name}</span>
                    {activeEntity.verified && (
                      <CheckCircle2 size={16} color="#1DA1F2" fill="#1DA1F2" />
                    )}
                  </div>
                  <span style={{ color: '#8C8494', fontSize: 12 }}>@{activeEntity.handle}</span>
                </div>
                <a
                  href={`https://twitter.com/${activeEntity.handle}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 20,
                    background: '#fff', color: '#000',
                    fontSize: 12, fontWeight: 700, textDecoration: 'none',
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" fill="#000" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Follow
                </a>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={12} color="#8C8494" />
                  <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{activeEntity.followers}</span>
                  <span style={{ color: '#8C8494', fontSize: 11 }}>followers</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FileText size={12} color="#8C8494" />
                  <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{entityPosts.length}</span>
                  <span style={{ color: '#8C8494', fontSize: 11 }}>recent posts</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid #2a2535',
              padding: '0 20px', flexShrink: 0,
            }}>
              {(['posts', 'about'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                  color: tab === t ? '#fff' : '#8C8494',
                  borderBottom: tab === t ? '2px solid #1DA1F2' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                }}>{t}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

              {/* Posts tab */}
              {tab === 'posts' && (
                loading && entityPosts.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#8C8494' }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
                    <p style={{ fontSize: 13, margin: 0 }}>Loading posts...</p>
                  </div>
                ) : entityPosts.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#8C8494' }}>
                    <svg width="32" height="32" fill="#8C8494" viewBox="0 0 24 24" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <p style={{ fontSize: 13, margin: 0 }}>No recent posts from {activeEntity.name}</p>
                    <p style={{ fontSize: 11, color: '#5a5465', marginTop: 4 }}>Posts update every 10 minutes</p>
                  </div>
                ) : (
                  entityPosts.map(post => (
                    <a key={post.id} href={post.externalLink} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: 'none', display: 'block' }}>
                      <div
                        style={{ padding: '14px 20px', borderBottom: '1px solid #1e1a2a', transition: 'background 0.12s', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#16121f')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', gap: 12 }}>
                          {/* Avatar */}
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                            background: activeEntity.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 800, color: '#fff',
                          }}>
                            {activeEntity.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Name + time */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                              <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>{activeEntity.name}</span>
                              {activeEntity.verified && <CheckCircle2 size={12} color="#1DA1F2" fill="#1DA1F2" />}
                              <span style={{ color: '#5a5465', fontSize: 11 }}>@{activeEntity.handle}</span>
                              <span style={{ color: '#5a5465', fontSize: 11 }}>· {timeAgo(post.date)}</span>
                              <ExternalLink size={11} color="#5a5465" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                            </div>
                            {/* Tweet text */}
                            <p style={{ color: '#d1c9d8', fontSize: 14, lineHeight: 1.55, margin: 0, wordBreak: 'break-word' }}>
                              {cleanText(post.title)}
                            </p>
                            {/* Image */}
                            {post.image && !/(logo|icon|brand|placeholder|avatar|favicon)/i.test(post.image) && (
                              <img src={post.image} alt="" loading="lazy"
                                style={{ width: '100%', borderRadius: 12, marginTop: 10, maxHeight: 180, objectFit: 'cover', border: '1px solid #2a2535' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {/* Action row */}
                            <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                              {[['💬', ''], ['🔁', ''], ['❤️', ''], ['📤', '']].map(([icon, count], i) => (
                                <span key={i} style={{ color: '#5a5465', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {icon} {count}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))
                )
              )}

              {/* About tab */}
              {tab === 'about' && (
                <div style={{ padding: 24 }}>
                  {/* Bio card */}
                  <div style={{ background: '#1a1625', borderRadius: 14, padding: 18, marginBottom: 16, border: '1px solid #2a2535' }}>
                    <p style={{ color: '#8C8494', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>About</p>
                    <p style={{ color: '#d1c9d8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{activeEntity.bio}</p>
                  </div>
                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'Followers', value: activeEntity.followers, icon: '👥' },
                      { label: 'Category', value: activeEntity.category, icon: '🏷️' },
                      { label: 'Region', value: activeEntity.flag + ' Africa', icon: '🌍' },
                      { label: 'Verified', value: activeEntity.verified ? 'Yes ✓' : 'No', icon: '✅' },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: '#1a1625', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2535' }}>
                        <p style={{ color: '#8C8494', fontSize: 11, margin: '0 0 4px' }}>{stat.icon} {stat.label}</p>
                        <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  {/* External link */}
                  <a href={`https://twitter.com/${activeEntity.handle}`} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '12px', borderRadius: 12, background: '#1a1625',
                      border: '1px solid #2a2535', color: '#1DA1F2', fontSize: 13, fontWeight: 600,
                      textDecoration: 'none', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1e1a2a')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#1a1625')}
                  >
                    <svg width="14" height="14" fill="#1DA1F2" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    View full profile on X
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid #2a2535',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ color: '#5a5465', fontSize: 11 }}>
            {posts.length} posts indexed · updates every 10 min
          </span>
          <span style={{ color: '#5a5465', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            Powered by
            <svg width="11" height="11" fill="#5a5465" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Nitter RSS
          </span>
        </div>
      </div>

      <style>{`
        @keyframes panelIn {
          from { transform: scale(0.94) translateY(12px); opacity: 0; }
          to   { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SocialFeedModal;
