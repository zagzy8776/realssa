# RealSSA Entertainment Trigger-Response Engine

This document describes the entertainment growth engine that is **actually implemented**
in this repository, how it maps to the original "trigger-response" blueprint, and which
parts of that blueprint were deliberately **not** built because they violate platform
terms, advertising policy, or defamation law.

The short version:

- **Detect** entertainment stories that are accelerating, using permitted sources.
- **Plan** three grounded editorial angles per story, with a human review gate.
- **Distribute** through the existing feed, related-story rails, and consented push.
- **Monetize** through disclosed affiliate links and ad slots, never deceptive native ads.
- **Refuse** scraping X/TikTok/Instagram, AI-invented rumors, notification traps, and
  unlabeled sponsored storytelling.

---

## 1. What is already in the repo

Several pieces of the blueprint already existed and were left in place:

| Capability | Existing implementation |
|---|---|
| Infinite scroll / endless feed | `src/pages/Index.tsx`, `Trending.tsx`, `ForYou.tsx`, `CinemaHub.tsx` |
| Related stories in Reader Mode | `src/pages/ReaderMode.tsx` → `/api/news?category=…` |
| Push notifications | `backend/services/notificationService.js` (OneSignal) |
| AI notification copy | `backend/services/aiNotificationOptimizer.js` |
| Predictive social trends | `backend/services/socialPredictive.service.js` (Reddit/Telegram) |
| View velocity | `backend/services/velocity.service.js` |
| Native ads | `native_ads` table + server-side injection |
| AI trending synthesis | `backend/services/aiTrendingSynthesizer.js` (currently disabled) |
| Viral social posting | `backend/services/viralTrendBufferBot.js` (Buffer queue) |

## 2. What this change adds

| New file | Purpose |
|---|---|
| `backend/services/entertainmentTrigger.service.js` | Allowed-source trend detection, clustering, heat/velocity scoring |
| `backend/services/angleFactory.service.js` | Three grounded angles + evidence verification + reporting-brief fallback |
| `backend/services/articleText.service.js` | Minimal article-text extractor for angle generation |
| `backend/services/alertThrottle.service.js` | Push caps, cooldowns, quiet hours |
| `backend/routes/entertainmentEngine.js` | Express routes under `/api/ai/entertainment` |
| `api/entertainment-trends.js` | Public Vercel trend feed |
| `api/entertainment-angles.js` | Internal, `CRON_SECRET`-protected angle endpoint |
| `api/shopping-links.js` | Disclosed affiliate links from `AFFILIATE_LINKS` |
| `src/components/EntertainmentPulse.tsx` | "Entertainment Pulse" rail on `/culture` |
| `src/components/StoryCommerce.tsx` | Disclosed "Shop the story" rail |
| `src/components/SponsoredLabel.tsx` | Visible sponsored/paid-partnership label |
| `src/components/AdSlot.tsx` | Consent-aware, lazy-loaded display ad |

Wiring changes:

- `backend/server.js` mounts the router and starts the detector at boot.
- `backend/services/notificationService.js` checks the throttle before every breaking push.
- `src/pages/Culture.tsx` renders the pulse, commerce rail, and ad slot.
- `vercel.json` adds functions, rewrites, and the AdSense CSP entries.

## 3. Source policy

### Implemented (permitted)

- Publisher RSS/Atom: Variety, Deadline, The Hollywood Reporter, Billboard, Rolling Stone,
  Vanguard Entertainment, Premium Times.
- Google News RSS for US, UK, Nigeria, South Africa, Kenya, Ghana, Netherlands, Germany,
  France, India, Brazil.
- Google Trends daily RSS (`https://trends.google.com/trending/rss?geo=…`).
- Reddit public Atom feed (`/r/…/hot/.rss`) — best effort; Reddit rate-limits bursts, and the
  detector tolerates a 429 without failing the scan.
- YouTube Data API v3 when `YOUTUBE_API_KEY` is set (official API, category 24 = Entertainment).
- X API v2 recent search when `X_BEARER_TOKEN` is set. This requires a paid tier; the free tier
  does not include search.

### Not implemented (deliberately)

- **Scraping X, TikTok, or Instagram HTML/private endpoints.** Their terms prohibit it and
  their anti-bot systems block it. A scraper would be fragile, legally exposed, and could get
  the domain blocked.
- **TikTok trend search without Research API approval.** If RealSSA is approved for the TikTok
  Research API, add an adapter behind its own env flag; do not scrape.
- **Instagram trend search.** There is no public trend-search API. Instagram Graph API access is
  limited to owned business accounts and does not provide global trend discovery.

The public response includes `sourcePolicy.allowed` and `sourcePolicy.notAllowed` so the
constraint is visible to the newsroom and to future maintainers.

## 4. Detection and ranking

`entertainmentTrigger.service.js`:

1. Fetches all sources in parallel with a 9-second per-source timeout.
2. Normalizes titles/snippets, removes duplicates by URL and normalized title.
3. Filters Google Trends noise: a trend must contain a strong entertainment signal in the
   headline, or at least two weaker signals with no political/sports counter-signal.
4. Clusters near-duplicate stories with Jaccard similarity on meaningful tokens (threshold 0.42).
5. Scores each cluster:

```
heat = 100 × (0.38 × recency
            + 0.24 × engagement
            + 0.22 × corroboration
            + 0.16 × velocity)
```

- **recency** decays exponentially with a 10-hour scale.
- **engagement** is a log-scaled mix of Reddit/YouTube/X metrics and Google Trends volume.
- **corroboration** rewards independent source IDs covering the same cluster.
- **velocity** measures new mentions per hour versus the previous scan.

Each signal also carries `whyHot`, `signals`, `sourceCount`, `mentions`, `keywords`, and an
internal `coverage` list (only exposed to cron-authenticated requests).

## 5. The three angles

`angleFactory.service.js` produces:

1. **factual** — the confirmed development, attributed.
2. **context** — what it changes or sets up; analysis is labeled as analysis.
3. **curiosity** — the specific question readers will ask next; an open loop, never an
   unverified assertion.

Every key fact must include a verbatim `evidence` quote. The validator then:

- checks each quote against the source (normalized substring, or ≥80% token overlap with a
  source sentence);
- requires at least two grounded facts for `factual`, one for `context`/`curiosity`;
- rejects a headline/dek containing a number that does not appear in the source;
- flags legal, sensitive, rumor, and clickbait language for human review;
- sets `publishable: false` with an `editorial_note` when the source is thin.

If the AI is unavailable or the source is under 240 characters, the endpoint returns a
**reporting brief** (`ok: false`, `requires_ai` or `fallback_reason`) instead of invented copy.

## 6. API

### Public

```http
GET /api/entertainment/trends?limit=8&region=global
```

Returns `{ ok, trends, scannedAt, stats, sourcePolicy }`. Publisher names and coverage URLs are
stripped from the public response; each trend exposes an internal `searchUrl`.

### Internal (requires `CRON_SECRET`)

```http
POST /api/entertainment/angles
x-cron-secret: <CRON_SECRET>
Content-Type: application/json

{
  "trendId": "et-…",
  "sourceText": "optional; if omitted the server fetches the trend URL",
  "sourceUrl": "optional",
  "title": "optional override"
}
```

Returns the brief, the three angles, grounding scores, risk flags, and editorial metadata.
`/api/entertainment/angles` is never called by the public client.

```http
POST /api/ai/entertainment/scan
x-cron-secret: <CRON_SECRET>
```

Forces a refresh and returns feed health plus the top signals.

### Debug

Send a valid `x-cron-secret` header to `GET /api/ai/entertainment/trends` to include the
`coverage` array (source names + URLs). Without it, the response is public-safe.

### Commerce

```http
GET /api/shopping-links?category=entertainment&q=perfume&limit=4
```

Reads `AFFILIATE_LINKS`, validates URLs, applies `AFFILIATE_TAG` to Amazon links, and returns
a visible disclosure string. Returns an empty list when unconfigured.

## 7. Environment variables

| Variable | Required | Effect |
|---|---|---|
| `GEMINI_API_KEY` | for angles | Google Gemini key, or an `nvapi-…` NVIDIA key routed by `aiProvider` |
| `GEMINI_MODEL` | no | Overrides the shared AI helper's model; default `gemini-1.5-flash` |
| `CRON_SECRET` | for internal endpoints | Protects `/scan` and `/angles`; endpoints fail closed without it |
| `ENTERTAINMENT_TRIGGER_ENABLED` | no | `0` disables the background detector |
| `ENTERTAINMENT_TRENDS_PERSIST` | no | `1` persists signals to `entertainment_trends` |
| `YOUTUBE_API_KEY` | no | Adds YouTube most-popular entertainment videos |
| `YOUTUBE_TREND_REGIONS` | no | Comma-separated regions, default `US,NG,GB,ZA` |
| `X_BEARER_TOKEN` | no | Adds X recent search; requires a paid API tier |
| `AFFILIATE_LINKS` | no | JSON array of `{title,url,merchant,price,image,category,tags}` |
| `AFFILIATE_TAG` | no | Amazon associate tag; overrides any tag already in the URL |
| `VITE_ADSENSE_CLIENT` | no | Enables the display ad component |
| `VITE_ADSENSE_SLOT` | no | Default ad slot ID |
| `VITE_ADS_REQUIRE_CONSENT` | no | `0` allows implied consent; default strict opt-in |
| `ALERT_THROTTLE_ENABLED` | no | `1` enables push caps/quiet hours |
| `ALERT_GLOBAL_PER_DAY` | no | Default 8 |
| `ALERT_CATEGORY_PER_DAY` | no | Default 3 |
| `ALERT_MIN_GAP_MINUTES` | no | Default 45 |
| `ALERT_BREAKING_GAP_MINUTES` | no | Default 15 |
| `ALERT_QUIET_START` / `ALERT_QUIET_END` | no | Default 23 / 6 |
| `ALERT_TIMEZONE` | no | Default `Africa/Lagos` |

## 8. Monetization rules

### Affiliate commerce

`StoryCommerce` renders only when `AFFILIATE_LINKS` contains matching products. Every outbound
link uses `rel="sponsored nofollow noopener noreferrer"` and the module prints
"Paid links. RealSSA News may earn a commission from purchases."

This captures the "get the look" behavior from the original blueprint without turning a news
story into an undisclosed shopping mall.

### Display ads

`AdSlot` is consent-aware and lazy-loaded:

- renders nothing unless `VITE_ADSENSE_CLIENT` and a slot are configured;
- respects `localStorage.realssa_consent` when set to anything other than `granted`;
- waits until the slot is within 300px of the viewport;
- fires a `realssa:adslot` event so a Prebid wrapper can run a header-bidding auction.

**Reader Mode stays ad-free.** This preserves the product promise already stated in the
site's own AI assistant copy and avoids the "ad arbitrage" pattern that gets AdSense accounts
restricted.

### Sponsored content

`SponsoredLabel` is the required visible label for any paid placement. Do not publish a
sponsored card without it. Keep editorial and sponsored inventory visually distinct.

### What not to do

- Do not hide a sponsor behind a normal headline.
- Do not run interstitials on every article open.
- Do not buy low-quality traffic to inflate RPM; AdSense treats that as invalid traffic.
- Do not put ads inside Reader Mode.

## 9. Alerts without the trap

`alertThrottle.service.js` is integrated into `sendBreakingNews`:

- default caps: 8 pushes/day globally, 3 per category, 45-minute gap;
- hard breaking news (score ≥ 3) may bypass quiet hours but keeps a 15-minute gap;
- quiet hours default to 23:00–06:00 `Africa/Lagos`;
- the throttle is opt-in (`ALERT_THROTTLE_ENABLED=1`) so existing behavior is unchanged until
  the newsroom enables it.

OneSignal already targets `Subscribed Users`, which is consent-based. Do not add a fake
"breaking" prompt or a pre-checked opt-in.

## 10. What was deliberately not built

| Blueprint item | Why not |
|---|---|
| Scraping X/TikTok/Instagram | Platform terms + anti-bot controls; use official APIs where available |
| AI-generated "sensationalist" angle from a rumor | Defamation and misrepresentation risk; AdSense/Google News policy risk |
| "Notification trap" | Deceptive consent; violates push and app-store policies |
| Unlabeled sponsored storytelling | FTC/ASA disclosure rules and Google News policy |
| Ad arbitrage with low-quality traffic | Invalid-traffic enforcement; account termination risk |
| Manufactured controversy bots | The repo already has `aiHotTakesEngine`; it should stay disabled unless a human editor owns it |

The existing `aiHotTakesEngine` and synthetic live-viewer services are **not** part of this
engine. If they remain enabled, they should be reviewed separately for platform-policy and
brand risk.

## 11. KPIs

Track these before and after rollout:

- **Time-to-signal:** minutes from first publisher item to a ranked trend.
- **Time-to-brief:** minutes from trend to three grounded angles.
- **Trend precision:** share of surfaced signals an editor marks relevant.
- **Angle acceptance:** share of generated angles published with minor edits.
- **Grounding rate:** verified facts ÷ supplied facts (target > 0.8).
- **Reader loop:** related-story CTR and pages per session.
- **Commerce:** affiliate CTR, conversion, EPC, and refund rate.
- **Ads:** viewability, RPM, invalid-traffic rate.
- **Push:** opt-out rate, complaint rate, and CTR by category.
- **Trust:** correction rate and "unsubscribe" rate on alerts.

## 12. Verification

Local checks:

```bash
node --check backend/services/entertainmentTrigger.service.js
node --check backend/services/angleFactory.service.js
node --check backend/routes/entertainmentEngine.js
node --check api/entertainment-trends.js
node --check api/entertainment-angles.js
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"
```

Live checks after deploy:

```bash
curl -s https://www.realssanews.com.ng/api/entertainment/trends?limit=5 | head -c 2000
curl -s -X POST https://www.realssanews.com.ng/api/ai/entertainment/scan \
  -H "x-cron-secret: $CRON_SECRET"
curl -s https://www.realssanews.com.ng/api/shopping-links?category=entertainment
```

Expected:

- trends returns `ok: true` with 5+ signals and no publisher URLs;
- scan returns feed health (`sourcesOk`, `sourcesFailed`) and a top list;
- shopping-links returns an empty list until `AFFILIATE_LINKS` is configured;
- `/culture` shows the Entertainment Pulse rail;
- Reader Mode still has no ads.

## 13. Rollout order

1. Deploy with `CRON_SECRET` set and `ENTERTAINMENT_TRIGGER_ENABLED=1`.
2. Watch `GET /api/ai/entertainment/health` for feed health for 48 hours.
3. Run `/angles` on 20 stories; compare against editor judgment.
4. Enable `ALERT_THROTTLE_ENABLED=1` after checking push volume.
5. Add `AFFILIATE_LINKS` for one category; verify disclosure renders.
6. Add AdSense env vars on a single page; confirm CSP and consent behavior.
7. Only then consider YouTube/X keys and the TikTok Research API.
