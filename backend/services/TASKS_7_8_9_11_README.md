# Tasks 7, 8, 9, 11 - Implementation Guide

## Overview
This document covers the implementation of sports ingestion refactoring and click session automation.

---

## Task 7: Stream Discovery with Network Interception

### Purpose
Replace fragile iframe parsing with robust headless browser network interception for discovering HLS/DASH streams.

### How It Works — Layer 1: fixture discovery (`sportsBot.js`)
1. **discoverStreamsForFixture()**: Launches Playwright Chromium, navigates to source URL, intercepts network responses for `.m3u8` and `.mpd` files
2. **validateStreamCandidate()**: Fetches stream URL with proper referer, validates #EXTM3U header, checks for segments
3. **scoreStream()**: Scores streams based on resolution (40%), bitrate (30%), uptime (30%), latency (10%)
4. **discoverAndValidateStreams()**: Orchestrates discovery, validation, scoring, and database storage
5. **triggerStreamDiscovery()**: Fire-and-forget hook called from the live poll loop

### How It Works — Layer 2: embed interception (`embedInterceptor.js`)
Turns a third-party embed/iframe URL into a direct `.m3u8`/`.mpd` URL so our own
HLS player can play it without loading the third-party page.

1. **interceptEmbed(url)**: Opens the embed in headless Chromium, intercepts network
   requests, returns the first manifest URL found (Redis-cached 240s).
2. **interceptMany(urls)**: Bounded-concurrency variant (default 3 at a time).
3. **isAvailable() / getStats()**: Feature detection + telemetry.

Wired into `sportsStreamService.js` via `enrichServersWithDirectStreams()`, which
adds a `streamUrl` field to each resolved embed mirror when `EMBED_INTERCEPT_ENABLED=true`.

### Usage
```javascript
const { discoverAndValidateStreams } = require('./services/sportsBot');
const streams = await discoverAndValidateStreams(fixtureId, ['https://example.com/stream'], pool);

const embedInterceptor = require('./services/embedInterceptor');
const hit = await embedInterceptor.interceptEmbed('https://embed.example/abc');
if (hit) console.log(hit.streamUrl); // direct .m3u8
```

### Routes
- `GET  /api/embed-interceptor/stats` — availability + counters
- `POST /api/embed-interceptor/intercept` — `{ url, referer? }` → intercepted manifest

### Environment
| Variable | Default | Purpose |
| --- | --- | --- |
| `PLAYWRIGHT_AVAILABLE` | *(unset)* | `true` enables Playwright discovery/interception |
| `EMBED_INTERCEPT_ENABLED` | *(unset)* | `true` enables embed interception in `sportsStreamService` |
| `EMBED_INTERCEPT_MAX_CONCURRENT` | `3` | Max simultaneous browser sessions |
| `EMBED_INTERCEPT_TIMEOUT_MS` | `12000` | Per-embed timeout |

---

## Task 9: Fixture Coverage Hardening

### Purpose
Ensure fixture-driven coverage rather than source-driven, with automatic expiry.

### Functions
1. **ensureFixtureCoverage()**: Fetch fixtures 7 days ahead from football-data.org API
2. **probeSourcesForFixtures()**: Probe for valid sources at T-60 minutes before kickoff
3. **expireFinishedFixtures()**: Delete fixtures 30 minutes after full-time

### Cron Schedule (in server.js)
- `ensureFixtureCoverage`: Every 10 minutes
- `probeSourcesForFixtures`: Every 5 minutes
- `expireFinishedFixtures`: Every 5 minutes

---

## Task 11: Click Sessions

### Purpose
Automate realistic Google search → click → dwell sessions using Playwright and residential proxies.

### Session Flow
1. Open Google → 2. Type query → 3. Scroll SERP → 4. Click target domain
5. Dwell 45-180s → 6. Scroll page → 7. Click internal link → 8. Dwell again → 9. Exit

### Routes
- **POST /api/click-sessions/run**: Run batch of sessions
- **GET /api/click-sessions/stats**: Get session statistics

### Request Format
```json
POST /api/click-sessions/run
{
  "sessions": [{
    "proxy": {"server": "http://proxy:8080", "username": "u", "password": "p"},
    "geo": "NG",
    "query": "premier league live",
    "targetDomain": "realssanews.com.ng"
  }]
}
```

### Configuration
- Max sessions per IP per day: 3
- Concurrent sessions: 20-60
- Ramp up time: 10 minutes

---

## Database Migration

Run one of:

```bash
# Node runner (reads DATABASE_URL, or pass a connection string / --check)
node backend/run-migration.js "postgres://user:pass@host:5432/db?sslmode=require"
node backend/run-migration.js --check "postgres://..."   # connectivity only

# or psql directly
psql "$DATABASE_URL" -f backend/migrations/004_add_sports_and_click_tables.sql
```

### Tables created by `004_add_sports_and_click_tables.sql`

| Table | Owner | Purpose |
| --- | --- | --- |
| `fixtures` | `sportsBot.js` (Task 9) | Fixture-driven coverage window + expiry |
| `live_streams` | `server.js` / `sportsBot.js` (Task 7) | Discovered streams + scoring metadata (`referer`, `resolution`, `bitrate`, `score`, `status`, `fixture_id`) |
| `click_sessions` | `clickSessions.js` (Task 11) | Per-session telemetry |
| `stream_health_checks` | `sportsBot.js` (Task 7) | Per-stream health history (feeds 7-day uptime) |
| `indexing_dead_letter` | `googleIndexing.js` | Permanent Google Indexing API failures |
| `rising_queries` | `keywordRadar.js` | Rising search queries + scores |
| `thin_pages` | `countryIntel.js` | Thin-content country pages flagged noindex |

Also created: view `stream_uptime_7d` and function `cleanup_stream_health()`.

The migration is **idempotent** — every statement is `IF NOT EXISTS` / `CREATE OR REPLACE`,
so it is safe to re-run. The three SEO tables are also created inline by their owning
services, so the app works even if the migration has not been run; the migration exists to
provision a fresh database in one step.

---

## Dependencies
`playwright`, `playwright-extra` and `puppeteer-extra-plugin-stealth` are listed in
`package.json`. After installing, download the Chromium build once:

```bash
npm install
npx playwright install --with-deps chromium
```

Both the discovery layer and the interception layer fall back gracefully when the
browser is missing — the API keeps working, it just doesn't attempt interception.

## Environment Variables
```bash
PLAYWRIGHT_AVAILABLE=true            # enable Playwright discovery + interception
EMBED_INTERCEPT_ENABLED=true         # enable embed interception in sportsStreamService
EMBED_INTERCEPT_MAX_CONCURRENT=3     # optional
EMBED_INTERCEPT_TIMEOUT_MS=12000     # optional
FOOTBALL_DATA_API_KEY=your_key
API_SPORTS_KEY=your_key
```

## Task 8: Manifest Edge Proxy

### Purpose
Proxy HLS manifests and segments to handle CORS, rewrite relative URLs, and cache responses.

### Routes
- **GET /api/proxy/manifest?url=...&referer=...**: Proxy manifest (.m3u8)
- **GET /api/proxy/segment?url=...&referer=...**: Proxy segment (.ts)

### Features
- Rewrites Referer and Origin headers to source page
- Rewrites relative segment URLs to absolute proxy URLs
- Cache: manifests 5s, segments 60s

### Usage
```javascript
const manifestUrl = `/api/proxy/manifest?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(sourcePage)}`;
hls.loadSource(manifestUrl);
```