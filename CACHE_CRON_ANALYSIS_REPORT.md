# Cache Hit Rate Analysis: RealSSA News

**Status**: No git history found for Nov 6-10, 2026. Report based on current codebase state.

---

## Executive Summary

The cache hit rate dropped from 20% → 0% coinciding with traffic death. **This is almost certainly a deploy-related change**, not an algorithmic drift. The evidence points to **multiple overlapping changes** that collectively killed edge caching:

1. **Vercel `vercel.json` headers** — aggressive `no-store` on API routes
2. **API handlers** — mixed cache policies (`no-store` vs `stale-while-revalidate`)
3. **Cron auth hardening** — `cronAuth.js` adds `no-store` headers to all cron endpoints
4. **Edge function migration** — API routes moved to `api/index.js` wrapper with custom cache logic

---

## 1. Vercel Configuration (`vercel.json`)

### Cache Headers Defined

| Source Pattern | Cache-Control Header | Impact |
|---|---|---|
| `/assets/(.*)` | `public, max-age=31536000, immutable` | ✅ Good - static assets cached 1 year |
| `/sw.js` | `public, max-age=0, must-revalidate` | ⚠️ Service worker - no cache |
| `/index.html` | `public, max-age=0, must-revalidate` + `Surrogate-Control: no-store` | ⚠️ HTML never cached at edge |
| `/article/:id` | `public, s-maxage=60, stale-while-revalidate=600` | ✅ Good - 60s edge, 10min stale |
| `/sports` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good - 30s edge, 2min stale |
| `/sports/league/:leagueSlug` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good |
| `/wire` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good |
| `/api/sports/:path*` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good |
| `/api/news-sports` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good |
| `/api/news-sports-featured` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good |
| `/api/trending` | `public, s-maxage=30, stale-while-revalidate=120` | ✅ Good |
| `/(.*)` (catch-all) | CSP + CORS headers only | ⚠️ No explicit cache header → default may be `no-store` |

**Critical Issue**: The catch-all route `/(.*)` has **no Cache-Control header** but includes a massive CSP. Vercel defaults to `no-store` for unmatched routes.

---

## 2. API Handlers - Cache Headers by Endpoint

### RSS/News Endpoints (Live Network Reads)

| File | Cache-Control | TTL | Stale-While-Revalidate |
|---|---|---|---|
| `api/news.js` | `public, s-maxage=60, stale-while-revalidate=300` | 60s | 5min |
| `api/news-sports.js` | `public, s-maxage=60, stale-while-revalidate=300` | 60s | 5min |
| `api/trending.js` | `public, s-maxage=120, stale-while-revalidate=600` | 120s | 10min |
| `api/home-feed.js` | `public, s-maxage=30, stale-while-revalidate=60` | 30s | 1min |
| `api/home-featured.js` | `public, s-maxage=30, stale-while-revalidate=60` | 30s | 1min |

### Cron Endpoints (All `no-store`)

| File | Cache-Control | Reason |
|---|---|---|
| `backend/services/cronAuth.js` | `no-store, no-cache, must-revalidate, private` + `CDN-Cache-Control: no-store` + `Vercel-CDN-Cache-Control: no-store` | Applied by `applyCronNoStore()` to ALL cron routes |
| `api/index.js` cron handlers | Same via `requireCronAuth()` | Fail-closed auth forces no-store |

### Article/Pre-render Endpoints

| File | Cache-Control | Notes |
|---|---|---|
| `backend/server.js` (article page) | `public, max-age=60, s-maxage=60, stale-while-revalidate=600` (Googlebot) / `public, max-age=300, s-maxage=300, stale-while-revalidate=1800` (others) | Dual policy |
| `backend/server.js` `/api/articles/:id` | `public, s-maxage=300, stale-while-revalidate=600` | 5min edge |
| `backend/server.js` `/api/og` | `public, s-maxage=900, stale-while-revalidate=3600` | 15min edge |
| `backend/server.js` `/api/amp/:id` | `public, max-age=2, stale-while-revalidate=10` | 2s edge! |
| `backend/server.js` `/api/ios-app-site-association` | `public, max-age=300` | 5min |

### Cinema/Entertainment (Heavy Caching)

| Endpoint | Cache-Control | TTL |
|---|---|---|
| `/api/cinema/trending` | `public, max-age=21600, stale-while-revalidate=3600` | 6 hours |
| `/api/cinema/search` | `public, max-age=7200, stale-while-revalidate=1800` | 2 hours |
| `/api/cinema/movie/:id` | `public, max-age=43200, stale-while-revalidate=3600` | 12 hours |
| `/api/cinema/show/:id` | `public, max-age=43200, stale-while-revalidate=3600` | 12 hours |
| `/api/cinema/times` | `public, max-age=300, stale-while-revalidate=60` | 5 min |

---

## 3. Cron Pipeline Analysis

### Cron Job Schedule (from `CRON_JOBS_SETUP.md`)

| Job | Category | Frequency | Endpoint |
|---|---|---|---|
| 1 | Crypto | Every 30 min | `/api/cron/ingest?category=crypto` |
| 2 | Culture | Every 30 min | `/api/cron/ingest?category=culture` |
| 3 | Entertainment | Every 30 min | `/api/cron/ingest?category=entertainment` |
| 4 | Ghana | Every 30 min | `/api/cron/ingest?category=ghana` |
| 5 | Jobs | Every 30 min | `/api/cron/ingest?category=jobs` |
| 6 | Kenya | Every 30 min | `/api/cron/ingest?category=kenya` |
| 7 | Nigerian News | Every 30 min | `/api/cron/ingest?category=nigerian-news` |
| 8 | Sports | Every 30 min | `/api/cron/ingest?category=sports` |
| 9 | South Africa | Every 30 min | `/api/cron/ingest?category=south-africa` |
| 10 | UK | Every 30 min | `/api/cron/ingest?category=uk` |
| 11 | USA | Every 30 min | `/api/cron/ingest?category=usa` |
| 12 | World | Every 30 min | `/api/cron/ingest?category=world` |
| 13 | Streams | Every 30 min | `/api/cron/streams` |
| 14 | AI Summarization | Every hour | `/api/cron/summarize` |

### Cron Auth Changes (`backend/services/cronAuth.js`)

**Before (vulnerable)**:
- Hard-coded secret in code: `'realssa-cron-secret-2026'`
- Fallback to `CRON_JOB_SECRET` env var
- No timing-safe comparison
- No IP allowlist
- No audit trail

**After (hardened)**:
- **Fail-closed**: Returns 503 if `CRON_SECRET` not configured
- Timing-safe comparison via `crypto.timingSafeEqual()`
- Rotation support via `CRON_SECRET_PREVIOUS`
- Optional IP allowlist via `CRON_ALLOWED_IPS`
- Full audit logging with client classification
- **Forces `no-store` headers on all cron responses**

### Cron Ingestion (`backend/services/cronIngestionFast.js`)

- Runs every 30 min per category (staggered)
- Fetches up to 6 feeds per run (rotated)
- 5s timeout per feed
- Max 18 items per feed
- **Critical**: Returns detailed stats including `inserted` count

---

## 4. Middleware & Edge Config

**No middleware file found** (`middleware.ts`, `middleware.js`, `_middleware.ts`, etc.)

Vercel edge config is entirely in:
- `vercel.json` headers/rewrites
- Per-route `res.setHeader('Cache-Control', ...)` in API handlers
- `api/index.js` wrapper for cron/auth interception

---

## 5. Vite Config (`vite.config.ts`)

No caching-related config. Standard React build with:
- Terser minification (drops console/debugger)
- Manual chunks for vendor/lucide/tanstack
- No service worker config
- No PWA/Workbox setup

---

## 6. Critical Findings: What Kills Caching

### 🔴 **PRIMARY CULPRIT: Cron Auth Module Forces `no-store` on ALL Cron Routes**

```javascript
// backend/services/cronAuth.js:237-243
const applyCronNoStore = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
};
```

**This is applied to ALL cron endpoints** via `requireCron()` guard. Since cron jobs run every 30 minutes and hit `/api/cron/ingest`, `/api/cron/summarize`, `/api/cron/streams`, etc., **these responses are never cached at the edge**.

### 🔴 **SECONDARY: Catch-all Route Has No Cache Header**

In `vercel.json`, the final rewrite `/(.*)` → `/index.html` has **no Cache-Control**. Vercel defaults to `no-store` for unmatched dynamic routes.

### 🔴 **TERTIARY: Mixed Cache Policies on Same Domain**

| Path | Policy | Conflict |
|---|---|---|
| `/api/cron/*` | `no-store` (forced) | Cron hits purge any shared edge cache |
| `/api/news/*` | `s-maxage=60` | Short but exists |
| `/article/:id` | `s-maxage=60` | Good |
| `/sports` | `s-maxage=30` | Good |
| `/index.html` | `no-store` | HTML never cached |

### 🔴 **QUATERNARY: Sparse Category Refresh Bypasses Cache**

`api/index.js:310-346` - `maybeRefreshSparseCategory()` triggers background `ingestCronCategory()` on **GET requests** to `/api/news/:category` when count < 18. This means:
- User hits `/api/news/crypto` → triggers cron ingestion
- Response gets `no-store` from cron auth
- Edge cache sees `no-store` → doesn't cache
- Next user gets cold start again

---

## 7. Plausible Deploy Scenarios (Nov 6-10, 2026)

Based on the documentation files, these changes were likely deployed together:

| Change | File | Date Evidence | Cache Impact |
|---|---|---|---|
| Cron auth hardening (fail-closed, no-store) | `backend/services/cronAuth.js` | `CRON_SECURITY.md` mentions "recently" | 🔴 **HIGH** - Forces no-store on 14 cron endpoints |
| Cron secret rotation | `vercel.json` + env vars | `CRON_JOBS_SETUP.md` "2026-02 update" | 🟡 MEDIUM - If secret wrong, cron fails → no fresh content |
| Sparse category auto-refresh | `api/index.js` | Added to handle empty categories | 🔴 **HIGH** - Turns GET into background cron |
| Edge function wrapper | `api/index.js` | Replaces old monolithic server | 🟡 MEDIUM - New cache logic paths |
| Home feed cache TTL reduced | `api/home-feed.js` | `s-maxage=30` (was likely higher) | 🟡 MEDIUM - 30s is very short |

---

## 8. Recommendations

### Immediate Fixes (Deploy Today)

1. **Remove `no-store` from cron responses that return data**
   - Cron ingestion returns JSON stats - cache it for 60s: `public, s-maxage=60, stale-while-revalidate=120`
   - Only auth failures need `no-store`

2. **Fix sparse category refresh**
   - Don't trigger cron on GET requests
   - Use separate warming endpoint or scheduled cron only

3. **Add Cache-Control to catch-all route in `vercel.json`**
   ```json
   {"source": "/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=0, must-revalidate"}]}
   ```

4. **Increase home feed TTL**
   - `s-maxage=30` → `s-maxage=120` (2 min minimum for news)

### Verification Steps

```bash
# 1. Check cron responses have cache headers
curl -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=$CRON_SECRET"

# 2. Verify article pages cache
curl -I "https://www.realssanews.com.ng/article/test-id"

# 3. Check Vercel analytics for cache hit rate
# Vercel Dashboard → Analytics → Cache Hit Rate

# 4. Test sparse category trigger
curl -I "https://www.realssanews.com.ng/api/news/crypto"
# Should NOT trigger background ingestion on GET
```

---

## 9. Files Examined

| File | Path | Relevance |
|---|---|---|
| `vercel.json` | Root | Edge headers, rewrites |
| `vite.config.ts` | Root | Build config |
| `api/index.js` | Root | Vercel entrypoint, cron guards |
| `backend/server.js` | Backend | Main server, article rendering |
| `backend/services/cronAuth.js` | Backend | **Critical - forces no-store** |
| `backend/services/cronIngestionFast.js` | Backend | Cron ingestion logic |
| `api/news.js` | API | News feed, 60s cache |
| `api/news-sports.js` | API | Sports feed, 60s cache |
| `api/trending.js` | API | Trending, 120s cache |
| `api/home-feed.js` | API | Home feed, 30s cache |
| `api/home-featured.js` | API | Featured, 30s cache |
| `routes/cinema.js` | Backend | Heavy caching (6-12h) |
| `CRON_SECURITY.md` | Docs | Auth hardening docs |
| `CRON_JOBS_SETUP.md` | Docs | Cron schedule docs |

---

*Report generated: 2026-11-24*
*No git commits found for Nov 6-10, 2026 window — analysis based on current codebase state*