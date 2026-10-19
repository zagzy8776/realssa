import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import { apiUrl } from '@/lib/api-base';
import { X, Tv, Shield, RefreshCw, Signal, AlertTriangle, Clock, MapPin, Radio } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// RealSSA Own Sports Player
// Plays DIRECT HLS (.m3u8) streams natively — no foreign sites,
// no heavy ads, full control. Iframe servers remain as fallback.
//
// IMPORTANT — why the hls.js budgets below look inconsistent:
// the IPTV CDNs we source from are genuinely slow, but only at the SEGMENT
// stage. Measured on prod sources: first frame lands in 17–46s and the first
// segment alone can be 5.5MB — so fragment budgets stay generous.
// The MANIFEST stage is the opposite: a host that cannot answer a manifest in
// a few seconds is gone (roughly a third of community IPTV hosts are dead at
// any moment). The original single 75s watchdog was applied to every stage, so
// each dead source cost 75s — plus another 75s when the CORS retry re-armed it,
// i.e. 150s per source and ~35 minutes to walk a 14-source ladder. That is the
// "connecting forever, then it switches" behaviour. Two rules:
//   1. Segment budgets must clear the slowest measured source with room.
//   2. The watchdog must RE-ARM on progress, never be a one-shot deadline —
//      a slow-but-alive stream must be allowed to finish.
//   3. Pre-playback budgets must be SHORT, because waiting longer on a host
//      that has not sent a single byte never turns into a playable stream.
// ─────────────────────────────────────────────────────────────

export interface DirectSource {
  url: string;
  quality?: string;
  label?: string;
}

interface SportsPlayerProps {
  channelId: string | number;
  title: string;
  onClose: () => void;
  // Native playback inputs
  directSources?: DirectSource[];
  home?: string | null;
  away?: string | null;
  homeCrest?: string | null;
  awayCrest?: string | null;
  isLive?: boolean;
  sport?: string | null;
  league?: string | null;
  // How confident we are that the source is showing THIS fixture:
  //   'match'   → a team/broadcast channel for this exact fixture
  //   'channel' → the right broadcaster for the league, but not team-specific
  //   'generic' → a live sports channel (never a dead end)
  liveConfidence?: { level: 'match' | 'channel' | 'generic' | 'none'; exact?: boolean; label?: string | null } | null;
  kickoff?: string | number | null;
  // Exact per-match embed id (Streamed). When present, the "★ Exact Match"
  // tab plays THE fixture the user clicked — an IPTV channel airs whatever
  // the broadcaster scheduled, this embed is bound to one single game.
  streamId?: string | number | null;
  venue?: string | null;
  // One-tap switch to another fixture from the "Others live now" rail.
  onSwitchMatch?: (m: LiveSwitchMatch) => void;
}

// Slim fixture descriptor handed to onSwitchMatch (backend `othersLive` items).
export interface LiveSwitchMatch {
  event?: string;
  home?: string | null;
  away?: string | null;
  homeCrest?: string | null;
  awayCrest?: string | null;
  league?: string | null;
  sport?: string | null;
  kickoff?: string | number | null;
  venue?: string | null;
  score?: string | null;
  liveDetail?: string | null;
  streamId?: string | null;
  directSources?: DirectSource[];
  liveConfidence?: { level: 'match' | 'channel' | 'generic' | 'none'; exact?: boolean; label?: string | null } | null;
}

// Iframe fallback servers (used when no direct HLS is available)
const IFRAME_SERVERS = [
  {
    label: 'Server 1',
    key: 'streamed',
    buildUrl: (id: string | number) => `https://streamed.st/embed/${id}`,
    homepage: 'https://streamed.st',
  },
  {
    label: 'Server 2',
    key: 'superabbit',
    buildUrl: () => `https://site04.superabbit77hd.skin/`,
    homepage: 'https://site04.superabbit77hd.skin/',
  },
  {
    label: 'Server 3',
    key: 'strikeout',
    buildUrl: (id: string | number) => `https://strikeout.im/embed/${id}`,
    homepage: 'https://strikeout.im',
  },
];

// Browse-only channel ids open a provider homepage. Match ids are opaque
// strings (`db:558576`, Streamed slugs…) and category tiles are league slugs
// ('football', 'la-liga', 'nba'…). The old check ("anything non-numeric is a
// category") misclassified EVERY real fixture as a browse channel, forced the
// third-party iframe and skipped source lookup entirely — the reason a live
// match opened streamed.st instead of our player. Keep this an explicit list.
const BROWSE_CHANNEL_IDS = new Set([
  // provider homepages
  'superabbit', 'strikeout', 'streamed',
  // CinemaHub category tiles
  'football', 'premier-league', 'la-liga', 'champions-league', 'serie-a',
  'bundesliga', 'ligue-1', 'afcon', 'nba', 'boxing', 'ufc', 'wrestling',
  'rugby', 'cricket', 'f1', 'tennis',
]);

// Internal fixture ids (`db:…`, `match:…`) belong to OUR database, not to a
// third-party embed provider, so they must never be interpolated into a
// streamed.st embed URL (that just renders the provider's own site).
const isInternalFixtureId = (id: string | number) =>
  typeof id === 'string' && /^(db|match)[:_-]/i.test(id.trim());


// a streamId the first tab is guaranteed to be the clicked match. An IPTV
// channel is not — it airs whatever the broadcaster scheduled today.
function serversFor(exactId: string | null) {
  if (!exactId) return IFRAME_SERVERS;
  return [
    {
      label: '★ Exact Match',
      key: 'exact',
      buildUrl: () => `https://streamed.st/embed/${exactId}`,
      homepage: `https://streamed.st/embed/${exactId}`,
    },
    ...IFRAME_SERVERS,
  ];
}

// Kickoff clock for the "not live yet" banner (epoch-ms or ISO in, HH:MM out).
function fmtKickoff(k: string | number | null | undefined): string {
  if (k == null || k === '') return '';
  try {
    const d = new Date(typeof k === 'number' ? (k > 1e12 ? k : k * 1000) : k);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function parseTeamsFromTitle(title: string): { home: string | null; away: string | null } {
  const delimiters = [' vs ', ' VS ', ' - ', ' @ '];
  for (const d of delimiters) {
    if (title.includes(d)) {
      const parts = title.split(d);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return { home: parts[0].trim(), away: parts[1].trim().replace(/\s*\(.*?\)\s*$/, '').trim() };
      }
    }
  }
  return { home: null, away: null };
}

// Proxy HLS streams through backend to bypass CORS / mixed-content.
//
// Two reasons a source MUST be proxied, not played directly:
//   1. CORS  — most IPTV CDNs send no Access-Control-Allow-Origin.
//   2. Mixed content — ~54% of the channel library (beIN Sports 1/2/3,
//      Arena Sport…) is plain `http://`. On our https:// page the browser
//      blocks those outright; an `http` source that "should work" silently
//      never loads otherwise.
// The backend proxy also rewrites child .m3u8/.ts URLs so fragments resolve.
function proxyStreamUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  // Already proxied.
  if (originalUrl.includes('/api/sports/proxy-stream')) return originalUrl;
  // Only absolute web URLs are proxied; data:/blob: pass through.
  if (!/^https?:\/\//i.test(originalUrl)) return originalUrl;
  return apiUrl(`/api/sports/proxy-stream?url=${encodeURIComponent(originalUrl)}`);
}

// ─────────────────────────── Fast source preflight ───────────────────────────
// The IPTV ladder is real but noisy: a 14-source match routinely leads with
// eight 404s. Walking it with hls.js costs ~25s per dead source (15s manifest
// deadline + 10s CORS retry), so the user sat on "Connecting…" for minutes and
// gave up — which is why the player used to dump them into a third-party
// iframe. Reading the manifest ourselves is a few KB: probe sources IN
// PARALLEL, put the ones that answer first, and let hls.js start on a live feed
// within seconds. Results are cached briefly because the same broadcaster URLs
// are reused across fixtures.
type ProbeResult = 'alive' | 'dead' | 'unknown';
const MANIFEST_CACHE = new Map<string, { result: ProbeResult; at: number }>();
const MANIFEST_TTL_MS = 5 * 60 * 1000;
const MANIFEST_PROBE_TIMEOUT_MS = 7000;

function isHlsUrl(url: string) {
  return /\.m3u8(?:$|[?#])/i.test(url);
}

async function probeManifest(url: string): Promise<ProbeResult> {
  // Non-HLS sources (mp4/ts) are not preflighted — an #EXTM3U check would
  // misclassify them as dead. Keep their original position instead.
  if (!isHlsUrl(url)) return 'unknown';

  const cached = MANIFEST_CACHE.get(url);
  if (cached && Date.now() - cached.at < MANIFEST_TTL_MS) return cached.result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_PROBE_TIMEOUT_MS);
  let result: ProbeResult = 'dead';
  try {
    // Go through our proxy: these CDNs send no CORS headers, so a direct
    // browser fetch would fail even when the stream is perfectly healthy.
    const res = await fetch(proxyStreamUrl(url), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: '*/*' },
    });
    if (res.ok) {
      const body = await res.text();
      result = body.trimStart().startsWith('#EXTM3U') ? 'alive' : 'dead';
    }
  } catch {
    result = 'dead';
  } finally {
    clearTimeout(timer);
  }
  MANIFEST_CACHE.set(url, { result, at: Date.now() });
  return result;
}


export default function SportsPlayer({
  channelId,
  title,
  onClose,
  directSources,
  home,
  away,
  homeCrest,
  awayCrest,
  isLive,
  sport,
  league,
  liveConfidence,
  kickoff,
  streamId,
  venue,
  onSwitchMatch,
}: SportsPlayerProps) {
  // Category browsing → iframe homepage mode. Only genuine browse tiles are
  // categories; opaque fixture ids (`db:…`) are real matches and must go
  // through the native player / source lookup below.
  const isCategory = typeof channelId === 'string' && BROWSE_CHANNEL_IDS.has(channelId.trim().toLowerCase());

  // Resolve teams for on-demand source lookup
  const parsed = useMemo(() => parseTeamsFromTitle(title), [title]);
  const teamHome = home || parsed.home;
  const teamAway = away || parsed.away;

  // Honesty badge: tell the user whether this feed IS the match, the right
  // broadcaster for it, or just live sport — instead of implying all three
  // are the same thing.
  const [fetchedConfidence, setFetchedConfidence] = useState<SportsPlayerProps['liveConfidence']>(null);
  const activeConfidence = liveConfidence || fetchedConfidence;
  const confidenceLevel = activeConfidence?.level || 'none';
  const confidenceTitle = confidenceLevel === 'match'
    ? `Team/broadcast channel for this fixture${activeConfidence?.label ? `: ${activeConfidence.label}` : ''}`
    : confidenceLevel === 'channel'
      ? `${league || 'League'} broadcaster${activeConfidence?.label ? `: ${activeConfidence.label}` : ''} — showing this league`
      : 'A live sports channel — not necessarily this exact fixture';

  // Playback mode: native if we have direct sources, otherwise iframe
  const [sources, setSources] = useState<DirectSource[]>(directSources || []);
  const [mode, setMode] = useState<'native' | 'iframe'>(directSources?.length ? 'native' : 'iframe');
  const [srcIdx, setSrcIdx] = useState(0);
  const [serverIdx, setServerIdx] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [autoSwitched, setAutoSwitched] = useState(0);
  const [sourcesNote, setSourcesNote] = useState<string | null>(null);
  // Preflight state: true while we probe manifests, so the HLS engine does not
  // start on a source we already know is dead. `allSourcesDead` is the honest
  // dead end — we show it inside OUR player instead of silently opening a
  // third-party iframe.
  const [preflighting, setPreflighting] = useState(false);
  const [allSourcesDead, setAllSourcesDead] = useState(false);
  const [preflightNonce, setPreflightNonce] = useState(0);
  const preflightSigRef = useRef('');
  const preflightRunRef = useRef(0);
  // Set when the current CDN rejects CORS-mode requests; we then re-attach the
  // same stream without crossOrigin so a CORS-only failure isn't treated as a
  // dead source.
  const [corsBypass, setCorsBypass] = useState(false);
  // Seconds spent on the current attempt — surfaced in the loader so the user
  // can see progress during the long first-segment buffer instead of staring
  // at a static spinner.
  const [elapsed, setElapsed] = useState(0);

  // Exact-match context from /api/sports/match-sources: per-match embed id,
  // venue, whether THIS fixture is live, and what else is live right now.
  const [ctx, setCtx] = useState<{
    exactStreamId: string | null;
    venue: string | null;
    matchLive: boolean | null;
    othersLive: LiveSwitchMatch[];
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exactId = (streamId != null && streamId !== '' ? String(streamId) : null) || ctx?.exactStreamId || null;
  const servers = useMemo(() => serversFor(exactId), [exactId]);
  const serversRef = useRef(servers);
  serversRef.current = servers;

  const activeSource = sources[srcIdx] || null;
  const iframeServer = servers[Math.min(serverIdx, servers.length - 1)];
  const effectiveVenue = ctx?.venue || venue || null;

  // A new match reuses the same broadcaster URLs, so the source array changes
  // identity without changing its URLs. Keep the index valid (otherwise
  // activeSource becomes null and the player renders a blank stage).
  useEffect(() => {
    setSrcIdx(i => (i < sources.length ? i : 0));
  }, [sources]);

  // ── Parallel manifest preflight ──────────────────────────────────────────
  // Skip dead hosts BEFORE handing the ladder to hls.js. Same-signature guard
  // keeps the reorder from re-triggering itself, and `preflightNonce` lets the
  // user force a fresh probe after a transient outage.
  useEffect(() => {
    if (mode !== 'native' || sources.length === 0) {
      setPreflighting(false);
      return;
    }
    const signature = `${preflightNonce}|${sources.map(s => s.url).sort().join('|')}`;
    if (preflightSigRef.current === signature) return;
    preflightSigRef.current = signature;

    // Nothing HLS to probe (mp4/ts only) — let the native engine decide.
    if (!sources.some(s => isHlsUrl(s.url))) {
      setPreflighting(false);
      return;
    }

    let cancelled = false;
    const runId = ++preflightRunRef.current;
    setPreflighting(true);
    setAllSourcesDead(false);
    setSrcIdx(0);
    setStatus('loading');

    (async () => {
      const results = await Promise.all(sources.map(s => probeManifest(s.url)));
      if (cancelled || preflightRunRef.current !== runId) return;

      const alive = sources.filter((_, i) => results[i] !== 'dead');
      const dead = sources.filter((_, i) => results[i] === 'dead');

      if (alive.length === 0) {
        setAllSourcesDead(true);
        setPreflighting(false);
        setStatus('error');
        setSourcesNote('Every direct feed for this match is offline right now. Retry in a moment or use external servers.');
        return;
      }

      const ordered = [...alive, ...dead];
      const changed = ordered.map(s => s.url).join('|') !== sources.map(s => s.url).join('|');
      if (changed) setSources(ordered);
      setPreflighting(false);
      setSourcesNote(dead.length
        ? `${dead.length} of ${sources.length} direct feeds are offline — moved them behind the working feed.`
        : null);
    })();

    return () => { cancelled = true; };
  }, [mode, sources, preflightNonce]);


  // On-demand source fetch when we don't have direct sources for a real fixture
  useEffect(() => {
    // Keep native mode when direct sources were provided, but STILL fetch —
    // the response now also carries the exact-match context (per-match embed
    // id, venue, matchLive, othersLive) that powers the exactness features.
    if (directSources?.length) {
      setSources(directSources);
      setMode('native');
      setAllSourcesDead(false);
      setSrcIdx(0);
      setStatus('loading');
    }
    if (isCategory) { setMode('iframe'); return; }
    if (!teamHome || !teamAway) { if (!directSources?.length) setMode('iframe'); return; }

    let cancelled = false;
    // Pass crests + league/sport so the backend can pick the right broadcaster
    // (Sky/beIN for Premier League, ESPN for NBA…) and never leave us empty.
    const params = new URLSearchParams({
      home: teamHome, away: teamAway,
      ...(homeCrest ? { homeCrest } : {}),
      ...(awayCrest ? { awayCrest } : {}),
      ...(sport ? { sport } : {}),
      ...(league ? { league } : {}),
      ...(title ? { event: title } : {}),
      ...(kickoff ? { kickoff: String(kickoff) } : {}),
    });
    fetch(apiUrl(`/api/sports/match-sources?${params.toString()}`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const list: DirectSource[] = Array.isArray(data?.directSources) ? data.directSources : [];
        if (data?.liveConfidence) setFetchedConfidence(data.liveConfidence);
        setCtx({
          exactStreamId: data?.exactStreamId || null,
          venue: data?.venue || null,
          matchLive: typeof data?.matchLive === 'boolean' ? data.matchLive : null,
          othersLive: Array.isArray(data?.othersLive) ? data.othersLive : [],
        });
        if (list.length) {
          // MERGE, never replace: the feed's own directSources and the
          // match-sources ladder often contain DIFFERENT broadcasters (e.g. the
          // feed has the team channel that is geo-blocked while the ladder has
          // a working beIN feed). The preflight ranks whichever actually answer.
          const seen = new Set<string>();
          const merged: DirectSource[] = [];
          for (const s of [...(directSources || []), ...list]) {
            if (!s?.url || seen.has(s.url)) continue;
            seen.add(s.url);
            merged.push(s);
          }
          setSources(merged);
          setMode('native');
          // A different fixture can reuse the same broadcaster URLs, so the
          // ladder's identity may be unchanged. Always restart cleanly.
          setAllSourcesDead(false);
          setSrcIdx(0);
          setStatus('loading');
        } else if (!directSources?.length) {
          // Only tear playback down when nothing native was supplied: a failed
          // or empty lookup must never discard direct feeds we already hold.
          setSources([]);
          setMode('iframe');
          setSourcesNote('No direct stream found for this match yet — using fallback servers.');
        }
      })
      .catch(() => { if (!cancelled && !directSources?.length) setMode('iframe'); });
    return () => { cancelled = true; };
  }, [directSources, isCategory, teamHome, teamAway, homeCrest, awayCrest, sport, league, title]);

  // EXACTNESS DEFAULT: when a per-match embed exists and the IPTV ladder is
  // only league-broadcaster/generic confidence, LEAD with the exact embed.
  // The user clicked THIS match — "the right channel for the league" can be
  // airing a different game, which is exactly the complaint we are fixing.
  //
  // EXCEPT when the caller already handed us direct HLS feeds: those play in
  // OUR player with no ads, so they always win. The exact embed stays one tap
  // away as the "★ Exact Match" server tab instead of hijacking playback.
  const exactDefaultDone = useRef(false);
  useEffect(() => {
    if (!exactId || exactDefaultDone.current) return;
    exactDefaultDone.current = true;
    if (confidenceLevel === 'match') return;   // team channel found — already exact
    if (directSources?.length) return;         // native feed available — keep it
    setMode('iframe');
    setServerIdx(0);                            // exact entry is servers[0]
  }, [exactId, confidenceLevel, directSources]);

  // Keep serverIdx inside bounds when the exact entry appears/disappears.
  useEffect(() => {
    setServerIdx(i => Math.min(i, servers.length - 1));
  }, [servers.length]);

  // ── Native HLS engine with watchdog + auto source-fallback ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== 'native' || preflighting || allSourcesDead || !activeSource?.url) return;

    setStatus('loading');
    let hls: Hls | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;
    let corsRetried = false;
    let startedPlaying = false;
    // True once the manifest parsed. Before that we are waiting on the source
    // host for the FIRST byte; a host that cannot answer a manifest within
    // MANIFEST_DEADLINE is gone, and holding a "Connecting…" spinner on it for
    // 75s is what made the whole ladder feel broken.
    let manifestSeen = false;

    const clearWatchdog = () => {
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    };
    // Re-arm the stall timer. Called on every sign of life so a slow-but-alive
    // source is never killed mid-buffer; only a genuine stall trips it.
    //
    // Three tiers, because the three stages have wildly different honest
    // latencies and the old single 75s budget was applied to all of them:
    //   no manifest yet   -> 15s   (host is dead or geo-blocked)
    //   CORS retry pass   -> 10s   (second opinion on the same URL)
    //   frames flowing    -> 75s   (a live stream may stall on a long play)
    const armWatchdog = () => {
      clearWatchdog();
      const ms = startedPlaying ? 75000 : manifestSeen ? 30000 : (corsBypass ? 10000 : 15000);
      if (startedPlaying) {
        // Already rendering frames: don't tear the source down for a hiccup,
        // just let hls.js keep retrying and re-check later.
        watchdogRef.current = setTimeout(() => {
          if (video.readyState >= 2 && !video.paused) { armWatchdog(); return; }
          failover();
        }, ms);
      } else {
        watchdogRef.current = setTimeout(failover, ms);
      }
    };
    const failover = () => {
      clearWatchdog();
      if (hls) { hls.destroy(); hls = null; hlsRef.current = null; }
      // Some IPTV CDNs send CORS headers on the manifest but not on child
      // playlists/segments. With crossOrigin="anonymous" the browser then
      // blocks them and the source looks dead. Before discarding it, retry
      // the SAME source once without CORS mode.
      if (!corsRetried && !corsBypass) {
        corsRetried = true;
        networkRetries = 0;
        mediaRetries = 0;
        // State change re-runs this effect with crossOrigin dropped. The
        // re-armed watchdog for this pass is only 10s (see armWatchdog), so a
        // genuinely dead host costs 15s + 10s instead of 150s.
        setCorsBypass(true);
        setStatus('loading');
        return;
      }
      const nextIdx = srcIdx + 1;
      if (nextIdx < sources.length) {
        setSrcIdx(nextIdx);
        setAutoSwitched(p => p + 1);
        return;
      }
      // Every direct source exhausted. DO NOT jump into a third-party iframe:
      // that is the exact behaviour users complained about ("it takes us to
      // the third party websites"). Stay in OUR player, say the feeds are down,
      // and let the user explicitly choose Retry or External servers.
      setSourcesNote('All direct feeds for this match are offline right now.');
      setAllSourcesDead(true);
      setStatus('error');
      setSrcIdx(0);
    };
    // Watchdog only trips on a genuine stall. Re-armed by every progress event
    // below, so total time may far exceed this as long as data keeps flowing.
    armWatchdog();

    const isHlsUrl = /\.m3u8(?:$|[?#])/i.test(activeSource.url);
    if (!isHlsUrl) {
      // Proxy non-HLS URLs as well
      video.src = proxyStreamUrl(activeSource.url);
      const onCan = () => { setStatus('playing'); armWatchdog(); };
      const onErr = () => failover();
      video.addEventListener('loadeddata', onCan);
      video.addEventListener('progress', onCan);
      video.addEventListener('error', onErr);
      video.play().catch(() => {});
      return () => {
        clearWatchdog();
        video.removeEventListener('loadeddata', onCan);
        video.removeEventListener('progress', onCan);
        video.removeEventListener('error', onErr);
        video.removeAttribute('src'); video.load();
      };
    }

    if (Hls.isSupported()) {
      // These IPTV CDNs serve very large, slow segments (0.8–1.2MB, often
      // 6–16s each). hls.js defaults give up long before the first frame is
      // decodable, which is what produced the endless "Connecting…" churn.
      // Budgets below are deliberately generous for SEGMENTS (a live stream
      // really can take 40s to decode a 5MB first frame) but tight for the
      // MANIFEST, because a manifest that has not answered in a few seconds
      // means the host is dead and the watchdog wants to move on.
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        // Manifest: 4s per try, 2 tries → dead in ~12s, inside the 15s tier.
        manifestLoadingTimeOut: 4000,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 800,
        // Variant/level playlists: host is known-good by now, be patient.
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        // Segments: the genuinely slow part of these CDNs. Keep the big budget.
        fragLoadingTimeOut: 60000,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 1000,
        // Start at a mid rung: the top rung is often the slowest to buffer in.
        startLevel: -1,
        // Play as soon as anything is decodable instead of waiting for a full buffer.
        maxStarvationDelay: 4,
        maxLoadingDelay: 6,
        appendErrorMaxRetry: 5,
      });
      hlsRef.current = hls;
      // Proxy the stream URL through backend to bypass CORS
      const proxiedUrl = proxyStreamUrl(activeSource.url);
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);

      // Any real forward progress (manifest, fragment, decode) proves the stream
      // is alive → push the stall deadline out rather than cancelling it, so a
      // slow CDN is allowed to finish buffering however long it needs.
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // The host answered and the variant list is valid: it is alive. Only
        // now may we relax the watchdog from the 15s manifest deadline.
        manifestSeen = true;
        armWatchdog();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.FRAG_LOADED, () => armWatchdog());
      hls.on(Hls.Events.LEVEL_LOADED, () => armWatchdog());
      const onLoadedMeta = () => armWatchdog();
      const onCanPlay = () => { startedPlaying = true; setStatus('playing'); armWatchdog(); video.play().catch(() => {}); };
      const onPlaying = () => { startedPlaying = true; setStatus('playing'); armWatchdog(); };
      // `progress` fires as bytes arrive — the earliest possible liveness signal.
      const onProgress = () => armWatchdog();
      video.addEventListener('loadedmetadata', onLoadedMeta);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('playing', onPlaying);
      video.addEventListener('progress', onProgress);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Retry the network layer a couple of times; only then move on.
          if (networkRetries < 2) {
            networkRetries++;
            setStatus('loading');
            hls?.startLoad();
            return;
          }
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRetries < 2) {
            mediaRetries++;
            setStatus('loading');
            hls?.recoverMediaError();
            return;
          }
        }
        failover();
      });

      return () => {
        clearWatchdog();
        video.removeEventListener('loadedmetadata', onLoadedMeta);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('progress', onProgress);
        if (hls) { hls.destroy(); hlsRef.current = null; }
        video.removeAttribute('src');
        video.load();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari) - also proxy the URL
      video.src = proxyStreamUrl(activeSource.url);
      const onCan = () => { setStatus('playing'); armWatchdog(); };
      const onErr = () => failover();
      const onProg = () => armWatchdog();
      video.addEventListener('loadeddata', onCan);
      video.addEventListener('error', onErr);
      video.addEventListener('progress', onProg);
      video.play().catch(() => {});
      return () => {
        clearWatchdog();
        video.removeEventListener('loadeddata', onCan);
        video.removeEventListener('error', onErr);
        video.removeEventListener('progress', onProg);
        video.removeAttribute('src'); video.load();
      };
    } else {
      setMode('iframe');
      setSourcesNote('This browser cannot play direct streams — using fallback servers.');
      clearWatchdog();
      return () => clearWatchdog();
    }
  }, [mode, activeSource?.url, sources.length, srcIdx, serverIdx, corsBypass, preflighting, allSourcesDead]);

  // Iframe mode watchdog (blank embeds are common)
  useEffect(() => {
    if (mode !== 'iframe') return;
    setStatus('loading');
    const t = setTimeout(() => setStatus(s => (s === 'loading' ? 'playing' : s)), 12000);
    return () => clearTimeout(t);
  }, [mode, serverIdx, channelId]);

  // Auto-switch to corresponding server if channelId matches a provider key
  useEffect(() => {
    if (channelId === 'superabbit') setServerIdx(1);
    else if (channelId === 'strikeout') setServerIdx(2);
    else if (channelId === 'streamed') setServerIdx(0);
  }, [channelId]);

  // Reset the CORS bypass when we move to a different source, so each new
  // source gets a clean CORS-mode attempt first.
  useEffect(() => { setCorsBypass(false); }, [srcIdx, activeSource?.url]);

  // Elapsed-seconds ticker for the loader; resets on every new attempt.
  useEffect(() => {
    if (status !== 'loading') return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status, srcIdx, serverIdx, corsBypass]);

  // Never build an embed URL from an internal fixture id (`db:…`): no provider
  // can resolve it, so the iframe just renders the provider's own website.
  // Without an exact embed id we show that homepage honestly instead.
  const streamUrl = isCategory || (isInternalFixtureId(channelId) && !exactId)
    ? iframeServer.homepage
    : iframeServer.buildUrl(channelId);

  const handleSwitchServer = (idx: number) => {
    setServerIdx(idx);
    localStorage.setItem('realssa_sports_server', IFRAME_SERVERS[idx].key);
  };

  // Restore saved iframe server preference (only when there is no exact
  // match tab — exactness outranks a remembered generic server).
  useEffect(() => {
    if (exactId) return;
    const saved = localStorage.getItem('realssa_sports_server');
    const found = IFRAME_SERVERS.findIndex(s => s.key === saved);
    if (found >= 0 && !isCategory) setServerIdx(found + (servers.length - IFRAME_SERVERS.length));
  }, [isCategory, exactId, servers.length]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Redirect-hijack protection
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      const msg = 'Stay on RealSSA to continue watching?';
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  const manualNextSource = () => {
    if (mode === 'native' && sources.length > 1) {
      setAllSourcesDead(false);
      setSrcIdx(p => (p + 1) % sources.length);
      setAutoSwitched(p => p + 1);
    } else if (mode === 'iframe') {
      setServerIdx(p => (p + 1) % serversRef.current.length);
    }
  };

  // Force a fresh probe of every source (drops the 5-minute manifest cache) and
  // restart playback from the top of the ladder — all without leaving the page.
  const retryDirectFeeds = () => {
    const urls = sources.map(s => s.url);
    urls.forEach(u => MANIFEST_CACHE.delete(u));
    setAllSourcesDead(false);
    setPreflighting(false);
    setSrcIdx(0);
    setCorsBypass(false);
    setStatus('loading');
    setMode('native');
    setPreflightNonce(n => n + 1);
    setAutoSwitched(0);
  };

  const activeLabel = mode === 'native'
    ? (activeSource?.label || `Direct Stream ${srcIdx + 1}`)
    : iframeServer.label;

  return (
    <div className="fixed inset-0 h-[100dvh] z-[9999] bg-gradient-to-b from-zinc-950 via-black to-zinc-950 flex flex-col font-sans select-none animate-in fade-in duration-300">

      {/* ── TOP BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-zinc-950/85 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {(homeCrest || awayCrest) && mode === 'native' && (
            <div className="flex -space-x-1.5 shrink-0">
              {homeCrest && <img src={homeCrest} alt="" className="w-6 h-6 rounded-full bg-white/10 border border-white/20 object-contain p-0.5" />}
              {awayCrest && <img src={awayCrest} alt="" className="w-6 h-6 rounded-full bg-white/10 border border-white/20 object-contain p-0.5" />}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-black tracking-widest text-amber-500 flex items-center gap-1.5">
              {isLive || mode === 'native' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              ) : (
                <Signal size={10} />
              )}
              {mode === 'native' ? 'RealSSA Direct Stream' : 'Live Sports Stream'}
            </span>
            {/* Be honest about what the feed actually is — an exact team
                channel vs the right broadcaster vs merely live sport. */}
            {confidenceLevel !== 'none' && (
              <span
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                  confidenceLevel === 'match'
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : confidenceLevel === 'channel'
                      ? 'text-sky-400 border-sky-500/30 bg-sky-500/10'
                      : 'text-zinc-400 border-white/10 bg-white/5'
                }`}
                title={confidenceTitle}
              >
                {confidenceLevel === 'match' ? '✓ This match' : confidenceLevel === 'channel' ? 'Right channel' : 'Live sport'}
              </span>
            )}
            <h3 className="text-white text-xs sm:text-sm font-black truncate max-w-[280px] sm:max-w-md mt-0.5 flex items-center gap-2">
              <Tv size={14} className="text-zinc-400 shrink-0" />
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {mode === 'native' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              <Shield size={11} />
              Ad-Light Direct Feed
            </div>
          )}

          <button
            onClick={manualNextSource}
            title={mode === 'native' ? 'Try next direct source' : 'Try next server'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 rounded-full text-zinc-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all border border-white/5 active:scale-90"
          >
            <RefreshCw size={11} />
            {mode === 'native' ? `Source ${srcIdx + 1}/${sources.length}` : 'Switch Server'}
          </button>

          {!isCategory && (
            <button
              onClick={() => setMode(m => (m === 'native' && sources.length ? 'iframe' : (sources.length ? 'native' : 'iframe')))}
              title={mode === 'native' ? 'Switch to fallback servers' : 'Switch back to direct stream'}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border active:scale-90 ${
                mode === 'iframe' && sources.length
                  ? 'bg-amber-500 text-black border-amber-600'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              {mode === 'native' ? 'Servers' : 'Direct'}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 bg-zinc-900/60 hover:bg-red-600 rounded-full text-zinc-400 hover:text-white transition-all border border-white/5 ml-1 active:scale-90"
            title="Close Player"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Source / Server tab bar ── */}
      {mode === 'native' && sources.length > 0 ? (
        <div className="flex gap-2 px-4 py-2.5 bg-zinc-950 border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
          {sources.map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              onClick={() => setSrcIdx(i)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                i === srcIdx
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black shadow-md shadow-emerald-500/25 scale-105'
                  : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
              }`}
            >
              {s.label || `Source ${i + 1}`}
            </button>
          ))}
        </div>
      ) : !isCategory ? (
        <div className="flex gap-2 px-4 py-2.5 bg-zinc-950 border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
          {servers.map((srv, i) => (
            <button
              key={srv.key}
              onClick={() => handleSwitchServer(i)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                i === serverIdx
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/25 scale-105'
                  : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
              }`}
            >
              {srv.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ── NOT-LIVE-YET banner — the honest answer to "why is this not my match" ── */}
      {ctx?.matchLive === false && (
        <div className="px-4 py-2 bg-sky-950/40 border-b border-sky-900/40 flex items-center gap-2 shrink-0">
          <Clock size={12} className="text-sky-400 shrink-0" />
          <p className="text-[10px] text-sky-200 font-bold leading-snug">
            {title} has NOT kicked off yet{kickoff ? ` — starts ${fmtKickoff(kickoff)}` : ''}{effectiveVenue ? ` at ${effectiveVenue}` : ''}. The exact feed goes live at kickoff — or jump to a match below that IS live.
          </p>
        </div>
      )}
      {ctx?.matchLive !== false && effectiveVenue && (
        <div className="px-4 py-1.5 bg-zinc-950/80 border-b border-white/5 flex items-center gap-2 shrink-0">
          <MapPin size={10} className="text-zinc-500 shrink-0" />
          <span className="text-[9px] text-zinc-500 font-bold truncate">
            {effectiveVenue}{kickoff ? ` · ${fmtKickoff(kickoff)}` : ''}
          </span>
        </div>
      )}

      {/* ── STREAM WINDOW — full-bleed, fills all free height ── */}
      <div className="flex-1 min-h-0 w-full h-full bg-black relative overflow-hidden">
        {mode === 'native' && activeSource ? (
          <div className="absolute inset-0 bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full bg-black"
              controls
              playsInline
              autoPlay
              muted
              crossOrigin={corsBypass ? undefined : 'anonymous'}
            />
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 pointer-events-none">
                <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
                  {preflighting ? 'Finding a working feed…' : `Connecting to ${activeLabel}…`}
                </p>
                {preflighting ? (
                  <p className="text-[10px] text-zinc-500 font-bold">
                    Checking {sources.length} direct feeds — skipping offline channels.
                  </p>
                ) : elapsed >= 4 && (
                  <p className="text-[10px] text-zinc-500 font-bold tabular-nums">
                    {elapsed < 20
                      ? `Buffering ${elapsed}s — these feeds open slowly`
                      : `Still buffering (${elapsed}s) — slow feed, hang tight`}
                  </p>
                )}
                {autoSwitched > 0 && (
                  <p className="text-[10px] text-amber-400 font-bold">Auto-switched {autoSwitched}×</p>
                )}
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center">
                <AlertTriangle size={22} className="text-amber-500" />
                <p className="text-xs font-black text-zinc-200">
                  {allSourcesDead ? 'No direct feed is answering right now' : 'This source went down'}
                </p>
                <p className="text-[10px] text-zinc-400 font-bold max-w-sm leading-snug">
                  {sourcesNote || 'The broadcaster feed stopped responding. You are still inside RealSSA — nothing opened in a new tab.'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={retryDirectFeeds} className="px-4 py-1.5 bg-emerald-500 text-black text-[10px] font-black uppercase rounded-full">
                    Retry direct feeds
                  </button>
                  {sources.length > 1 && (
                    <button onClick={manualNextSource} className="px-4 py-1.5 bg-zinc-800 text-zinc-200 text-[10px] font-black uppercase rounded-full border border-white/10">
                      Try next source
                    </button>
                  )}
                  {!isCategory && (
                    <button onClick={() => setMode('iframe')} className="px-4 py-1.5 bg-zinc-900 text-zinc-400 text-[10px] font-black uppercase rounded-full border border-white/10">
                      External servers
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 bg-zinc-950">
            {/* Warning overlay for iframe fallback mode */}
            {!isCategory && iframeServer.key === 'exact' && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-emerald-500/10 backdrop-blur-md border border-emerald-500/30 rounded-xl px-4 py-2.5 max-w-md mx-auto">
                <div className="flex items-start gap-2">
                  <Shield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-emerald-200 text-xs font-bold leading-snug">
                      Exact match feed — this stream IS {title}
                    </p>
                    <p className="text-emerald-300/70 text-[10px] mt-1 leading-snug">
                      One embed per fixture: no channel roulette. If it says "starting soon", the match has not kicked off yet.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!isCategory && iframeServer.key !== 'exact' && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-amber-500/10 backdrop-blur-md border border-amber-500/30 rounded-xl px-4 py-2.5 max-w-md mx-auto">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-200 text-xs font-bold leading-snug">
                      Direct stream unavailable — using external source
                    </p>
                    <p className="text-amber-300/70 text-[10px] mt-1 leading-snug">
                      Browse the external site below to find your match. If redirected by ads, press Back or close pop-ups.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Escape hatch back to OUR player: tapping "External servers" must
                not be a one-way trip. Re-probes and restarts the ladder. */}
            {!isCategory && sources.length > 0 && (
              <button
                onClick={retryDirectFeeds}
                className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase rounded-full shadow-lg transition-colors"
              >
                Back to direct stream
              </button>
            )}
            <iframe
              key={`iframe-${serverIdx}-${channelId}`}
              src={streamUrl}
              className="absolute inset-0 block w-full h-full min-h-full border-0 bg-black"
              style={{ height: '100%', minHeight: '100%' }}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer"
              title="RealSSA Sports Stream"
              onLoad={() => setStatus('playing')}
            />
          </div>
        )}
      </div>

      {/* ── OTHERS LIVE NOW — one-tap switch to a fixture that IS live ── */}
      {onSwitchMatch && !!ctx?.othersLive?.length && (
        <div className="px-4 py-2 bg-zinc-950 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Radio size={11} className="text-red-500 shrink-0" />
            <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500">
              Others live right now
            </span>
            {ctx?.matchLive === false && (
              <span className="text-[9px] text-sky-400 font-bold">· your match starts soon</span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {ctx!.othersLive.map((m, i) => (
              <button
                key={`${m.event}-${i}`}
                onClick={() => onSwitchMatch(m)}
                title={m.event}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900/70 hover:bg-zinc-800 border border-white/5 hover:border-red-500/40 rounded-full text-[9px] font-bold text-zinc-300 hover:text-white whitespace-nowrap shrink-0 transition-all active:scale-95"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="uppercase tracking-wider text-zinc-500">{(m.league || m.sport || 'Live').slice(0, 16)}</span>
                <span className="max-w-[150px] truncate">{m.event}</span>
                {m.liveDetail ? <span className="text-amber-400">{m.liveDetail}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── BOTTOM HINT ── */}
      <div className="px-4 py-2.5 bg-zinc-950 border-t border-white/10 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'native' ? (
            <>
              <Shield size={10} className="text-emerald-500 shrink-0" />
              <span className="truncate">Native RealSSA player — direct feed, no pop-ups.</span>
            </>
          ) : (
            <>
              <Shield size={10} className="text-amber-500 shrink-0" />
              <span className="truncate">
                {sourcesNote || 'If an ad redirects you, press Back or Stay.'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 shrink-0">
          <span>{mode === 'native' ? 'Blank? Try Next Source' : 'Blank? Switch server above'}</span>
        </div>
      </div>

    </div>
  );
}
