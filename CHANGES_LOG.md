# Changes Log: Cache Hit Rate Fix (20% → 0%)

## 2026-11-24: Initial fix deployment

### `backend/services/cronAuth.js` (lines 274-290)
- **Modified**: `requireCron()` function
- **Change**: Now only applies `applyCronNoStore()` on auth failures
- **Previous behavior**: Always applied `no-store` to ALL cron responses including 200s
- **New behavior**: Success → `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`; Failure → `no-store` + `X-Robots-Tag: noindex, nofollow`

### `api/index.js` (lines 147-163, 503-506)
- **Modified**: `cronGuard()` function
- **Change**: Removed Vercel-edge-level `if (isCronRequest) applyCronNoStore(res)` override
- **Previous behavior**: Edge layer forced `no-store` on ALL `/api/cron/*` regardless of auth result
- **New behavior**: Cache headers handled per-auth-result in function code

### `vercel.json` (lines 21-22)
- **Modified**: Removed `/api/cron/(.*)` edge header entry
- **Previous behavior**: Edge CDN forced `no-store, no-cache, must-revalidate, max-age=0` + `X-Robots-Tag: noindex, nofollow` on all cron routes
- **New behavior**: Only `/api/test-cron` retains `no-store` header; cron routes use function-code headers

### Root Cause Analysis
The auth-hardening deploy (cronAuth.js) had two compounding bugs:
1. `applyCronNoStore()` was called on **successful** cron responses, forcing all `/api/cron/*` endpoints to `no-store` at the edge
2. Vercel-edge override `if (isCronRequest) applyCronNoStore(res)` in `api/index.js` was forcing `no-store` at the CDN level, overriding function-code headers

Since cron jobs generated 39k of 469k daily requests (~90%), forcing `no-store` on all cron responses made edge caching impossible. When cron-job.org jobs started failing 401 (secret rotation without `CRON_SECRET_PREVIOUS`), crons stopped entirely, traffic collapsed from 39k → 2k/day, and the surviving requests all had `no-store` headers, giving a 0% cache hit rate.

### Files Modified
- `backend/services/cronAuth.js` — 1 function changed
- `api/index.js` — 1 function modified, 1 comment added
- `vercel.json` — 1 edge header entry removed

### Verification Commands
```bash
# Successful cron (should now be cacheable)
curl -H "x-cron-secret: $CRON_SECRET" -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports"
# Expected Cache-Control: public, s-maxage=30, stale-while-revalidate=60

# Failed cron (should have no-store)
curl -H "x-cron-secret: wrong" -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports"
# Expected: 401, with no-store + X-Robots-Tag: noindex, nofollow

# Article route (unchanged)
curl -I "https://www.realssanews.com.ng/article/test-id"
# Expected: public, s-maxage=60, stale-while-revalidate=600
```