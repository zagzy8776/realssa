/**
 * HighlightsPanel — in-app highlights experience for FINISHED matches.
 * Direct MP4 clips (ESPN) play inline in a native <video>; YouTube clips
 * open in a new tab; a YouTube deep-search fallback keeps the tab useful
 * even when both providers come up empty for a fixture.
 *
 * Used three ways:
 *   - <HighlightsPanel .../> inside the Sports hub match modal (tab)
 *   - <HighlightsModal .../> standalone overlay from CinemaHub cards
 *   - <HighlightsModal .../> from the homepage LiveScores widget
 */
import { useEffect, useState } from 'react';
import { Play, X, Youtube, Clapperboard, ExternalLink, Loader2 } from 'lucide-react';
import { fetchHighlights, youTubeSearchUrl, fmtDuration } from '@/lib/sportsHighlights';
import type { HighlightClip, HighlightsResult } from '@/lib/sportsHighlights';

export interface HighlightsSource {
  id?: string;
  home: string;
  away: string;
  kickoff?: string | null;
  competition?: string | null;
  matchUrl?: string | null;
}

const HighlightsPanel = ({ source, compact }: { source: HighlightsSource; compact?: boolean }) => {
  const [data, setData] = useState<HighlightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<HighlightClip | null>(null);

  const key = `${source.id || ''}|${source.home}|${source.away}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    setPlaying(null);
    fetchHighlights({
      id: source.id,
      home: source.home,
      away: source.away,
      kickoff: source.kickoff,
      competition: source.competition,
      matchUrl: source.matchUrl,
    })
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '36px 0', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
        <Loader2 size={16} className="animate-spin" /> Finding highlights…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 12px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Couldn't load highlights</p>
        <button
          onClick={() => window.open(youTubeSearchUrl(source.home, source.away), '_blank')}
          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)', color: '#eab308', fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
        >
          <Youtube size={14} /> Search on YouTube
        </button>
      </div>
    );
  }

  // ── Inline MP4 playback ──
  if (playing && playing.kind === 'mp4') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '78%' }}>{playing.title}</span>
          <button onClick={() => setPlaying(null)} style={{ background: 'rgba(51,65,85,0.4)', border: 'none', color: '#94a3b8', borderRadius: 8, padding: 4, cursor: 'pointer' }}><X size={14} /></button>
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={playing.url}
          poster={playing.thumb || undefined}
          controls
          autoPlay
          playsInline
          style={{ width: '100%', borderRadius: 12, background: '#000', aspectRatio: '16/9' }}
        />
        <p style={{ fontSize: 10, color: '#475569', marginTop: 6, fontWeight: 600 }}>Source: {playing.provider || 'ESPN'} · official clip</p>
      </div>
    );
  }

  const clips = data?.clips || [];

  if (clips.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '26px 12px' }}>
        <Clapperboard size={26} style={{ margin: '0 auto 8px', color: '#64748b' }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>No highlights published yet</p>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Official clips usually appear within an hour of the final whistle.</p>
        <button
          onClick={() => window.open(data?.youtubeSearch || youTubeSearchUrl(source.home, source.away), '_blank')}
          style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)', color: '#eab308', fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
        >
          <Youtube size={14} /> Search highlights on YouTube
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {clips.map(clip => (
          <button
            key={clip.id}
            onClick={() => (clip.kind === 'mp4' ? setPlaying(clip) : window.open(clip.url, '_blank', 'noopener'))}
            style={{ position: 'relative', textAlign: 'left', background: '#131b2a', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', padding: 0 }}
          >
            <div style={{ position: 'relative', aspectRatio: '16/9', background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}>
              {clip.thumb ? (
                <img src={clip.thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : null}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {clip.kind === 'youtube' ? <Youtube size={16} color="#fff" /> : <Play size={14} color="#fff" />}
                </div>
              </div>
              {fmtDuration(clip.duration) && (
                <span style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '1px 6px' }}>{fmtDuration(clip.duration)}</span>
              )}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{clip.title}</p>
              <p style={{ fontSize: 9.5, color: '#64748b', marginTop: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{clip.provider || 'Highlight'}</p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => window.open(data?.youtubeSearch || youTubeSearchUrl(source.home, source.away), '_blank', 'noopener')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
      >
        <ExternalLink size={13} /> More highlights on YouTube
      </button>
    </div>
  );
};

export default HighlightsPanel;

// ── Standalone overlay wrapper (CinemaHub cards, homepage widget) ─────────
export const HighlightsModal = ({ source, onClose }: { source: HighlightsSource | null; onClose: () => void }) => {
  if (!source) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: '#0d1520', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 20, padding: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Clapperboard size={15} style={{ color: '#eab308', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {source.home} vs {source.away}
              </p>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Highlights</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'rgba(51,65,85,0.4)', color: '#94a3b8', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <HighlightsPanel source={source} compact />
      </div>
    </div>
  );
};