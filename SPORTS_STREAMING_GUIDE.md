# RealSSA Sports Streaming Guide

## Overview

The RealSSA Live Sports feature provides two streaming modes to ensure users can always watch their matches:

### 1. **Direct Stream Mode (Preferred)**
When available, matches play directly in our native video player using HLS (`.m3u8`) streams from IPTV sources. This provides:
- ✅ No external websites or heavy ads
- ✅ Clean, native video player experience
- ✅ Fast switching between multiple source options
- ✅ Full control over playback

### 2. **External Source Mode (Fallback)**
When direct streams aren't available, the player shows external sports streaming sites where users can browse to find their match. This includes:
- Server 1: stream.st
- Server 2: superrabbit77
- Server 3: strikeout.im

## How It Works

### For Direct Streams:

1. **Backend Service** (`backend/services/sportsStreamService.js`):
   - Fetches live match fixtures from Streamed API and other sources
   - Matches fixtures with IPTV channel library (375+ sports channels)
   - Uses smart matching based on:
     - Team names and aliases (PSG ↔ Paris Saint-Germain)
     - Club crests/logos
     - League/broadcaster affinity (Premier League → Sky Sports, beIN)
     - Sport type (NBA → ESPN, Formula 1 → Sky Sports F1)
   - Returns matches with `directSources` array containing HLS stream URLs

2. **Frontend Player** (`src/components/SportsPlayer.tsx`):
   - Receives match with `directSources` array
   - Plays HLS streams using `hls.js` library
   - Proxies streams through backend (`/api/sports/proxy-stream`) to handle:
     - CORS restrictions from IPTV CDNs
     - Mixed content (http → https)
   - Auto-switches between sources if one fails
   - Shows loading progress during buffering (IPTV CDNs can be slow)

### For External Sources:

When `directSources` is empty or unavailable:
- Player switches to iframe mode
- Embeds external sports streaming sites
- Shows warning overlay explaining the situation
- Users browse the external site to find their match
- Multiple server options available via server switcher

## User Experience Flow

### Scenario A: Direct Stream Available
```
User clicks match → Player opens → Direct stream loads → Video plays immediately
Status: "● Direct stream available" → Button: "Watch Now"
```

### Scenario B: No Direct Stream
```
User clicks match → Player opens → Shows external site → User browses to find match
Status: "External source" → Button: "Find Stream"
Warning overlay: "Direct stream unavailable — using external source. Browse the external site below..."
```

## Technical Implementation

### Match Data Structure:
```javascript
{
  id: "12345",
  event: "Liverpool vs Manchester City",
  sport: "Football",
  league: "Premier League",
  isLive: true,
  kickoff: "2024-03-15T15:00:00Z",
  home: "Liverpool",
  away: "Manchester City",
  homeCrest: "https://crests.football-data.org/64.png",
  awayCrest: "https://crests.football-data.org/65.png",
  directSources: [
    {
      url: "http://example.com/stream.m3u8",
      label: "Sky Sports Premier League HD",
      quality: "Auto",
      sourceTier: "broadcaster", // or "team" or "generic"
      matchScore: 8
    }
  ],
  liveConfidence: {
    level: "channel", // or "match" or "generic"
    exact: false,
    label: "Sky Sports Premier League HD"
  }
}
```

### Source Tiers:
- **team** (score 9-12): Exact team channel (e.g., "Liverpool FC TV")
- **broadcaster** (score 2-6): League broadcaster (e.g., "Sky Sports" for Premier League)
- **generic** (score 1): Generic sports channel (e.g., "ESPN")

### Live Confidence Levels:
- **match**: This channel is showing THIS exact fixture
- **channel**: Right broadcaster for the league, but not team-specific
- **generic**: A live sports channel, not necessarily this match
- **none**: No direct source available

## Common Issues & Solutions

### Issue: "Why am I seeing entire websites instead of just video?"

**Cause**: The match doesn't have `directSources` in the API response, so the player falls back to iframe mode.

**Solution**: 
1. Check if backend is running and accessible
2. Verify IPTV channel library is loaded (check backend logs)
3. Test the `/api/sports/matches` endpoint directly
4. Check if Redis is working (channels are cached there)

### Issue: "Direct streams take too long to load"

**Cause**: IPTV CDNs can be legitimately slow (first frame can take 17-46 seconds).

**Solution**: 
- This is expected behavior for some IPTV sources
- The player shows loading progress with elapsed time
- Auto-switches to next source if it times out
- hls.js configured with generous timeouts (45-60 seconds)

### Issue: "Some matches have no direct streams"

**Cause**: IPTV library doesn't cover all leagues/teams equally.

**Solution**:
- Fallback to external sources is intentional
- Consider expanding IPTV playlist sources
- Add more broadcaster hints for niche leagues

## Configuration

### IPTV Playlists (`sportsStreamService.js`):
```javascript
const IPTV_PLAYLISTS = [
  ['sports', 'https://iptv-org.github.io/iptv/categories/sports.m3u'],
  ['asia', 'https://iptv-org.github.io/iptv/regions/asia.m3u'],
  ['spa', 'https://iptv-org.github.io/iptv/languages/spa.m3u'],
  ['por', 'https://iptv-org.github.io/iptv/languages/por.m3u'],
];
```

### Caching:
- **Match fixtures**: 2 minutes TTL, 30 minutes stale-on-error
- **IPTV channels**: 6 hours TTL
- **Per-match sources**: 5 minutes TTL

### HLS Player Timeouts:
```javascript
manifestLoadingTimeOut: 30000,  // 30s
fragLoadingTimeOut: 60000,      // 60s
watchdog: 75000                 // 75s stall detector
```

## Testing

### Test Direct Streams:
1. Go to Live Sports tab
2. Click any match with "● Direct stream available"
3. Should play video directly without showing external sites

### Test External Sources:
1. Click match with "External source" status
2. Should see warning overlay
3. Should show iframe with external site
4. Can switch between Server 1, 2, 3

### Test Backend:
```bash
# Check if matches have direct sources
curl https://api.realssanews.com.ng/api/sports/matches | jq '.matches[0].directSources'

# Should return array of stream objects, not empty array
```

## Future Improvements

1. **Expand IPTV Coverage**: Add more regional playlists for better global coverage
2. **Smarter Matching**: Improve team name normalization for non-English leagues
3. **Quality Selection**: Let users choose stream quality when multiple available
4. **Source Rating**: Track which sources work best, prioritize them
5. **Crest Recognition**: Use image similarity for better logo matching

## User Communication

### UI Text Updates Applied:

1. **Header**: "Watch live sports in our native player with direct streams when available. Some matches use external sources — you may need to browse to find your match."

2. **Match Cards**: 
   - With direct streams: "● Direct stream available" / "Watch Now"
   - Without: "External source" / "Find Stream"

3. **Category Browse**: "How it works: When you click a match, we try to play it directly in our player. If no direct stream is found, you'll be shown external sports sites where you can browse to find your match."

4. **Player Warning** (iframe mode): "Direct stream unavailable — using external source. Browse the external site below to find your match. If redirected by ads, press Back or close pop-ups."

These updates set proper expectations so users understand they may need to browse external sites for some matches.
