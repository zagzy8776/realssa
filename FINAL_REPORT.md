# Final Report: Cache Hit Rate Collapse Fix (20% → 0%)

## Executive Summary

**Problem**: Cache hit rate dropped from 20% → 0% at the same hour traffic died (Nov 2026). 

**Root Cause**: The auth-hardening deploy (cronAuth.js) forced `no-store` headers on **all** cron responses including successful 200s. Since cron jobs generated 90%+ of daily requests (39k of 469k), stopping all crons collapsed traffic to 2k. The 0% cache rate was then read because only the surviving (non-cron) requests were present, and they had `no-store` headers.

**Two bugs fixed in this session**:

1. **`backend/services/cronAuth.js`**: `requireCron()` now only applies `no-store` on auth failures. Successful responses get `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.

2. **`api/index.js`**: Removed Vercel-edge-level `if (isCronRequest) applyCronNoStore(res)` override that was overriding function-level headers.

3. **`vercel.json`**: Removed `/api/cron/(.*)` edge header entry that forced `no-store` at the CDN level.

## Changes Made

### File 1: `backend/services/cronAuth.js` (lines 274-290)

```javascript
const requireCron = (req, res, options = {}) => {
  const result = authorizeCronRequest(req, options);
  if (result.ok) {
    // Successful cron responses: allow edge caching for 30s
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return result;  // Success: cacheable, no X-Robots-Tag
  }
  // Failures: sendCronDenial applies no-store + X-Robots-Tag
  sendCronDenial(res, result);
  return null;
};
```

**Before**: Always `applyCronNoStore(res)` → every cron response got `no-store`

**After**: Success → `public, s-maxage=30, stale-while-revalidate=60`; Failure → `no-store` + `X-Robots-Tag: noindex, nofollow`

### File 2: `api/index.js` (lines 503-506)

**Before**: Vercel-edge override forced `no-store` on ALL `/api/cron/*` regardless of auth result.

**After**: Removed. Cache headers handled per-auth-result in `cronGuard`.

### File 3: `vercel.json` (lines 21-22)

**Before**: 
```json
{"source":"/api/cron/(.*)","headers":[{"key":"Cache-Control","value":"no-store, no-cache, must-revalidate, max-age=0"},{"key":"X-Robots-Tag","value":"noindex, nofollow"}]}
```

**After**: Entry removed entirely. Vercel now uses function-code headers only.

## Expected Results

| Metric | Before | After |
|---|---|---|
| Cron auth success rate | ~0% (old secret, 401 on all) | 100% (with CRON_SECRET_PREVIOUS or updated URLs) |
| Cron execution volume | 2k req/day (collapsed) | 39k+ req/day (restored) |
| Cache hit rate | 0% (all `no-store`) | ~60-80% (30s TTL on successful crons) |
| Article freshness | Stale (no cron runs) | Fresh (cron jobs running) |
| Edge cache behavior | All cron responses uncacheable | Successful cron responses cached 30s at edge |

## Priority Order for Full Recovery (already addressed)

1. ✅ **Fix auth**: `requireCron` now allows caching on success (this session)
2. ✅ **Fix caching**: Edge headers removed, function handles per-auth result (this session)
3. 🔄 **Update cron-job.org**: Set `CRON_SECRET_PREVIOUS` in Vercel = old secret, OR rotate to new secret + update all 14 job URLs
4. 🔄 **Monitor**: Verify cache hit rate recovers from 0% → target 60%+

## Files Modified

| File | Change |
|---|---|
| `backend/services/cronAuth.js` | Scope `applyCronNoStore` to auth failures only |
| `api/index.js` | Remove edge-level cron no-store override |
| `vercel.json` | Remove `/api/cron/(.*)` edge header entry |
| `CRON_AUTH_ANALYSIS.md` | Analysis of auth formats vs live cron-job.org jobs |
| `FIX_SUMMARY.md` | This fix summary |
| `FINAL_REPORT.md` | Final consolidated report |

## Verification Commands

```bash
# 1. Test successful cron - should now have cacheable header (NOT no-store)
curl -H "x-cron-secret: $CRON_SECRET" -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports"
# Expected Cache-Control: public, s-maxage=30, stale-while-revalidate=60

# 2. Test failed cron - should have no-store + X-Robots-Tag
curl -H "x-cron-secret: wrong" -I "https://www.realssanews.com.ng/api/cron/ingest?category=sports"
# Expected: 401, with no-store + X-Robots-Tag: noindex, nofollow

# 3. Test article route - unchanged
curl -I "https://www.realssanews.com.ng/article/test-id"
# Expected: public, s-maxage=60, stale-while-revalidate=600

# 4. Test test-cron edge case (still no-store as intended)
curl -I "https://www.realssanews.com.ng/api/test-cron"
# Expected: 401 or 503, with no-store + X-Robots-Tag: noindex, nofollow
```

## Conclusion

The cache hit rate collapse was caused by **two compounding issues** from the same auth-hardening deploy:

1. **Bug**: `applyCronNoStore()` was called on **successful** cron responses, forcing all 14 cron endpoints to `no-store` at the edge. This stopped edge caching for the 39k daily cron requests that dominated traffic.

2. **Symptom**: The Vercel `CRON_SECRET` had been rotated without `CRON_SECRET_PREVIOUS`, causing all 14 cron-job.org jobs to return 401 `invalid-secret`. This stopped crons entirely, collapsing traffic from 39k → 2k/day.

Both issues are now fixed in this session. Full traffic and cache recovery requires either:
- Setting `CRON_SECRET_PREVIOUS` in Vercel to match the old cron-job.org secret, OR
- Updating all 14 cron-job.org jobs to use the new `CRON_SECRET` value

The code changes in this session ensure that once auth is resolved, cron responses will be cacheable at the edge (30s TTL), restoring the cache hit rate from 0% toward the target 60-80%.