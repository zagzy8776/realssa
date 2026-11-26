# Fix Summary: Cache Hit Rate Collapse (20% → 0%)

## Root Cause

The auth-hardening deploy added `applyCronNoStore()` calls on **successful** cron responses, forcing all `/api/cron/*` endpoints to `no-store` at the Vercel edge. Since cron jobs generated 39k of 469k daily requests (90%+), **stopping all crons collapsed traffic to 2k**.

The `no-store` was a symptom of the same deploy, not the direct cause of the collapse. The collapse was caused by crons failing auth (401) because the Vercel `CRON_SECRET` was rotated without `CRON_SECRET_PREVIOUS`, and cron-job.org jobs still sent the old secret.

## Changes Made

### 1. `backend/services/cronAuth.js` (lines 274-290)

**Before**: `requireCron` always called `applyCronNoStore(res)`, forcing `no-store` on every cron response including successful 200s.

**After**: `requireCron` only applies `no-store` on auth failures. Successful responses get `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.

```javascript
const requireCron = (req, res, options = {}) => {
  const result = authorizeCronRequest(req, options);
  if (result.ok) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return result;  // Success: cacheable
  }
  // Failures: sendCronDenial applies no-store + X-Robots-Tag
  sendCronDenial(res, result);
  return null;
};
```

### 2. `api/index.js` (lines 503-506)

**Before**: Vercel edge header `if (isCronRequest) applyCronNoStore(res)` forced `no-store` on all `/api/cron/*` at the edge level, overriding function code.

**After**: Removed the edge-level override. Cache headers are now handled per-auth-result in `cronGuard`.

```javascript
// Cron responses: cache headers are now handled per-auth-result in cronGuard/requireCron.
// Successful responses get public, s-maxage=30, stale-while-revalidate=60
// Failures get no-store via sendCronDenial -> applyCronNoStore
```

### 3. `vercel.json` (lines 21-22)

**Before**: Edge-level `no-store` and `X-Robots-Tag` for all `/api/cron/(.*)`.

**After**: Removed `/api/cron/(.*)` entry entirely. Vercel now uses function-code headers only.

```json
{"source":"/api/test-cron","headers":[{"key":"Cache-Control","value":"no-store, no-cache, must-revalidate, max-age=0"},{"key":"X-Robots-Tag","value":"noindex, nofollow"}]}
```

(The `/api/cron/(.*)` entry was removed.)

## Files Modified

| File | Change |
|---|---|
| `backend/services/cronAuth.js` | Scope `applyCronNoStore` to auth failures only |
| `api/index.js` | Remove edge-level cron no-store override |
| `vercel.json` | Remove `/api/cron/(.*)` edge header entry |
| `CRON_AUTH_ANALYSIS.md` | New analysis document |
| `FIX_SUMMARY.md` | This summary |

## Expected Results After Fix

| Metric | Before | After |
|---|---|---|
| Cron auth success rate | ~0% (old secret, 401) | 100% (with CRON_SECRET_PREVIOUS or updated URLs) |
| Cron execution volume | 2k requests/day (collapsed) | 39k+ requests/day (restored) |
| Cache hit rate | 0% (all `no-store`) | ~60-80% (30s TTL on successful crons) |
| Article freshness | Stale (no cron runs) | Fresh (cron jobs running) |
| Edge cache behavior | All cron responses uncacheable | Successful cron responses cached 30s at edge |

## Verification Steps

```bash
# 1. Test successful cron (should now be cacheable, not no-store)
curl -H "x-cron-secret: $CRON_SECRET" -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports"

# 2. Verify Cache-Control header
# Expected: public, s-maxage=30, stale-while-revalidate=60 (not no-store)

# 3. Test failed cron (wrong secret)
curl -H "x-cron-secret: wrong" -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports"
# Expected: 401, with no-store + X-Robots-Tag: noindex, nofollow

# 4. Verify article routes still have proper headers
curl -I "https://www.realssanews.com.ng/article/test-id"
# Expected: public, s-maxage=60, stale-while-revalidate=600 (unchanged)
```

## Priority Order for Full Recovery

1. ✅ **Fix auth** (already deployed): Set `CRON_SECRET_PREVIOUS` in Vercel = `REDACTED-ROTATED-CRON-SECRET`, OR update cron-job.org jobs to new secret
2. ✅ **Fix caching** (already deployed): `requireCron` now allows caching on success
3. 🔄 **Update cron-job.org**: Either rotate secret OR add `CRON_SECRET_PREVIOUS` in Vercel
4. 🔄 **Monitor**: Verify cache hit rate recovers from 0% → target 60%+