# Cron Auth Analysis: Accepted Formats vs Live cron-job.org Jobs

## 1. Accepted Auth Formats in `backend/services/cronAuth.js`

The `extractSuppliedSecret()` function (lines 74-89) accepts secrets in this priority order:

| Priority | Source | Format | Example |
|---|---|---|---|
| 1 | Query string | `?secret=<value>` | `GET /api/cron/ingest?category=sports&secret=abc123` |
| 2 | Header | `x-cron-secret: <value>` | `x-cron-secret: abc123` |
| 3 | Header | `Authorization: Bearer <value>` | `Authorization: Bearer abc123` |

**Valid secret values** (from `resolveCronSecrets()`, lines 56-63):
- `process.env.CRON_SECRET` (primary)
- `process.env.CRON_JOB_SECRET` (fallback, legacy)
- `process.env.CRON_SECRET_PREVIOUS` (rotation support)

**Authentication logic** (`authorizeCronRequest()`, lines 178-235):
1. If no secrets configured → **503** (fail-closed)
2. If no secret supplied → **401** (`missing-secret`)
3. If secret doesn't match any configured (timing-safe) → **401** (`invalid-secret`)
4. If IP allowlist enabled and IP not listed → **403** (`ip-not-allowlisted`)
5. Otherwise → **200** (`authorized`)

---

## 2. Live cron-job.org Jobs (from `CRON_JOBS_SETUP.md`)

All **14 jobs** use **query parameter** format:

| # | Job | URL Pattern |
|---|---|---|
| 1 | Crypto | `.../api/cron/ingest?category=crypto&secret=REDACTED-ROTATED-CRON-SECRET` |
| 2 | Culture | `.../api/cron/ingest?category=culture&secret=REDACTED-ROTATED-CRON-SECRET` |
| 3 | Entertainment | `.../api/cron/ingest?category=entertainment&secret=REDACTED-ROTATED-CRON-SECRET` |
| 4 | Ghana | `.../api/cron/ingest?category=ghana&secret=REDACTED-ROTATED-CRON-SECRET` |
| 5 | Jobs | `.../api/cron/ingest?category=jobs&secret=REDACTED-ROTATED-CRON-SECRET` |
| 6 | Kenya | `.../api/cron/ingest?category=kenya&secret=REDACTED-ROTATED-CRON-SECRET` |
| 7 | Nigerian News | `.../api/cron/ingest?category=nigerian-news&secret=REDACTED-ROTATED-CRON-SECRET` |
| 8 | Sports | `.../api/cron/ingest?category=sports&secret=REDACTED-ROTATED-CRON-SECRET` |
| 9 | South Africa | `.../api/cron/ingest?category=south-africa&secret=REDACTED-ROTATED-CRON-SECRET` |
| 10 | UK | `.../api/cron/ingest?category=uk&secret=REDACTED-ROTATED-CRON-SECRET` |
| 11 | USA | `.../api/cron/ingest?category=usa&secret=REDACTED-ROTATED-CRON-SECRET` |
| 12 | World | `.../api/cron/ingest?category=world&secret=REDACTED-ROTATED-CRON-SECRET` |
| 13 | Streams | `.../api/cron/streams?secret=REDACTED-ROTATED-CRON-SECRET` |
| 14 | AI Summarization | `.../api/cron/summarize?secret=REDACTED-ROTATED-CRON-SECRET` |

**Key finding**: All jobs send `secret=REDACTED-ROTATED-CRON-SECRET` as query param.

---

## 3. Which Jobs Would 401?

### Scenario A: Vercel `CRON_SECRET` = `REDACTED-ROTATED-CRON-SECRET` (old secret)
- ✅ **All 14 jobs PASS** (query param matches configured secret)
- But: `CRON_SECURITY.md` says "previous shared secret was published... must be rotated"

### Scenario B: Vercel `CRON_SECRET` = new rotated secret (e.g., `new-random-secret-xyz`)
- ❌ **All 14 jobs FAIL** with 401 `invalid-secret`
- Query param `REDACTED-ROTATED-CRON-SECRET` ≠ new `CRON_SECRET`
- No `CRON_SECRET_PREVIOUS` set → rotation not supported

### Scenario C: Vercel `CRON_SECRET` = new secret, `CRON_SECRET_PREVIOUS` = `REDACTED-ROTATED-CRON-SECRET`
- ✅ **All 14 jobs PASS** (rotation supported via `CRON_SECRET_PREVIOUS`)

### Scenario D: Vercel `CRON_SECRET` not set
- ❌ **All 14 jobs FAIL** with 503 `cron-secret-not-configured` (fail-closed)

---

## 4. Vercel Dashboard Deployment Correlation

**This workspace has no git history** (no `.git` directory). Cannot check deployment timestamps.

**What to check in Vercel Dashboard manually**:
1. Go to Vercel Project → Deployments
2. Look for deployment around **2026-11-08** (when cache hit rate dropped 20% → 0%)
3. Check if that deployment includes:
   - `backend/services/cronAuth.js` (new fail-closed auth)
   - `vercel.json` with `/api/cron/(.*)` no-store headers
   - Updated `CRON_SECRET` env var rotation

**Evidence from docs**:
- `CRON_JOBS_SETUP.md` header: "**2026-02 update — read `CRON_SECURITY.md` first**"
- `CRON_SECURITY.md`: "The previously published secret is in git history and in old docs, so treat it as burned. Rotating is mandatory"
- Multiple docs reference `REDACTED-ROTATED-CRON-SECRET` as the OLD value

**Likely timeline**:
1. Deploy rotated `CRON_SECRET` in Vercel (without `CRON_SECRET_PREVIOUS`)
2. cron-job.org jobs still sending old secret → all 401
3. Crons stop running → traffic collapses (crons were 90%+ of requests)
4. Surviving requests hit `no-store` endpoints → cache hit rate reads 0%

---

## 5. Edge Cache Headers (from `vercel.json`)

```json
{"source":"/api/cron/(.*)","headers":[{"key":"Cache-Control","value":"no-store, no-cache, must-revalidate, max-age=0"},{"key":"X-Robots-Tag","value":"noindex, nofollow"}]}
```

This applies **at the edge** to ALL `/api/cron/*` routes, regardless of auth result. Even successful cron responses get `no-store`.

---

## 6. Code Path: Where `applyCronNoStore` Is Called

### In `api/index.js` (lines 458, 504):
```javascript
const isCronRequest = parsed.pathname.startsWith('/api/cron/') || isCronAudit || parsed.pathname === '/api/migrate';
// ...
if (isCronRequest) applyCronNoStore(res);  // ALWAYS applied to all cron routes
```

### In `backend/services/cronAuth.js` (line 280):
```javascript
const requireCron = (req, res, options = {}) => {
  const result = authorizeCronRequest(req, options);
  applyCronNoStore(res);  // ALWAYS applied, even on success
  if (result.ok) return result;
  sendCronDenial(res, result);  // Also calls applyCronNoStore again
  return null;
};
```

**Result**: Every `/api/cron/*` response gets `no-store`, even successful 200 responses.

---

## 7. Fix Required

### In `backend/services/cronAuth.js`:

**Current (line 278-284)**:
```javascript
const requireCron = (req, res, options = {}) => {
  const result = authorizeCronRequest(req, options);
  applyCronNoStore(res);  // ← REMOVE THIS LINE
  if (result.ok) return result;
  sendCronDenial(res, result);  // ← This already calls applyCronNoStore
  return null;
};
```

**Fixed**:
```javascript
const requireCron = (req, res, options = {}) => {
  const result = authorizeCronRequest(req, options);
  if (result.ok) {
    // Successful cron responses: allow caching
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    // Do NOT set X-Robots-Tag on success
    return result;
  }
  // Failures: sendCronDenial already calls applyCronNoStore
  sendCronDenial(res, result);
  return null;
};
```

### In `api/index.js` (line 504):

**Current**:
```javascript
if (isCronRequest) applyCronNoStore(res);  // ← REMOVE OR SCOPE
```

**Fixed** - Remove this line entirely since `cronGuard`/`requireCron` handles headers per auth result.

---

## 8. Verify X-Robots-Tag Not Leaking to Article Routes

The catch-all route in `vercel.json`:
```json
{"source":"/(.*)","headers":[{"key":"Content-Security-Policy","value":"..."},{"key":"Access-Control-Allow-Origin","value":"*"},{"key":"Access-Control-Allow-Methods","value":"GET, POST, OPTIONS"}]}
```

**No `X-Robots-Tag` header** on catch-all. Good.

Article routes (`/article/:id`) have their own header in `vercel.json`:
```json
{"source":"/article/:id","headers":[{"key":"Cache-Control","value":"public, s-maxage=60, stale-while-revalidate=600"}]}
```

**No `X-Robots-Tag`** on article routes. Good.

The `X-Robots-Tag: noindex, nofollow` only appears on:
1. `/api/cron/(.*)` - explicit in vercel.json
2. `/api/test-cron` - explicit in vercel.json
3. Applied by `applyCronNoStore()` in code

**No leak to article routes confirmed.**

---

## Summary

| Issue | Impact | Fix |
|---|---|---|
| `applyCronNoStore` called on **success** | Successful cron responses uncached | Scope to failures only |
| `vercel.json` forces `no-store` on all `/api/cron/*` | Edge caches nothing | Keep for failures, remove for success (code handles it) |
| All 14 cron jobs use old secret format | Likely 401 if secret rotated without `CRON_SECRET_PREVIOUS` | Set `CRON_SECRET_PREVIOUS` in Vercel or update cron-job.org URLs |
| No git history to confirm deploy date | Can't prove correlation | Check Vercel Dashboard manually for ~2026-11-08 deploy |

**Priority 1**: Fix `requireCron` to allow caching on success
**Priority 2**: Set `CRON_SECRET_PREVIOUS` in Vercel to match old cron-job.org secret
**Priority 3**: Update cron-job.org jobs to use `x-cron-secret` header (per `CRON_SECURITY.md` recommendation)