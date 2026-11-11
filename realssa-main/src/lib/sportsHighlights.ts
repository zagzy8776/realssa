/**
 * Sports Highlights — shared client helpers
 * =========================================
 * One fetcher used by the Sports hub modal, the CinemaHub finished-match
 * cards and the homepage LiveScores widget. The backend endpoint
 * (/api/sports/highlights) merges TheSportsDB + ESPN official clips and
 * always returns a YouTube deep-search fallback, so a tab is never empty.
 */
import { apiUrl } from './api-base';

export interface HighlightClip {
  id: string;
  title: string;
  thumb: string;
  url: string;
  kind: 'mp4' | 'youtube' | 'page';
  duration?: number | null;
  provider?: string;
}

export interface HighlightsResult {
  home: string;
  away: string;
  competition: string;
  clips: HighlightClip[];
  youtubeSearch: string;
  count: number;
  providers: string[];
  cached?: boolean;
}

export interface HighlightsQuery {
  id?: string;
  home: string;
  away: string;
  kickoff?: string | null;
  competition?: string | null;
  matchUrl?: string | null;
}

export function youTubeSearchUrl(home: string, away: string): string {
  const q = `${home} vs ${away} highlights`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export async function fetchHighlights(q: HighlightsQuery): Promise<HighlightsResult> {
  const p = new URLSearchParams();
  if (q.id) p.set('id', q.id);
  p.set('home', q.home || '');
  p.set('away', q.away || '');
  if (q.kickoff) p.set('kickoff', q.kickoff);
  if (q.competition) p.set('competition', q.competition);
  if (q.matchUrl) p.set('matchUrl', q.matchUrl);
  const res = await fetch(apiUrl(`/api/sports/highlights?${p.toString()}`));
  if (!res.ok) throw new Error(`highlights ${res.status}`);
  return res.json();
}

export function fmtDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
