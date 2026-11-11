# Cron Security & Origin Auditing

Status: `/api/cron/*` is now **fail-closed**. Every cron route requires a valid
secret; requests without one are rejected (`401`), and if `CRON_SECRET` is not
configured at all the routes return `503` instead of falling back to a value
that lives in git.

All cron auth goes through one module: `backend/services/cronAuth.js`
(`requireCron` for Express routes, `authorizeCronRequest` + `sendCronDenial` for
the raw Node wrapper in `api/index.js`).

---

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | **yes** | Current secret accepted by every cron route. Use 32+ random chars. |
| `CRON_SECRET_PREVIOUS` | during rotation only | Old secret, still accepted so the scheduler does not break mid-rollout. Remove after rollout. |
| `CRON_ALLOWED_IPS` | optional | Comma-separated exact IPs. When set, a valid secret from any other IP gets `403`. |
| `CRON_AUDIT_LOG_SUCCESS` | optional | Set to `false` to stop logging successful calls (denials are always logged). |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Secrets are accepted from, in this order:

1. `?secret=...` (legacy cron-job.org URLs)
2. `x-cron-secret: ...` (preferred for cron-job.org)
3. `Authorization: Bearer ...` (Vercel Cron, manual runs)

---

## 2. Rotation runbook

The previously published secret is in git history and in old docs, so treat it
as burned. Rotating is mandatory; deleting it from source is not enough.

1. Generate a new secret (command above).
2. In Vercel set `CRON_SECRET` = new value and `CRON_SECRET_PREVIOUS` = old value.
3. Update cron-job.org jobs to send the new value (`x-cron-secret` header is preferred over the query string).
4. Deploy, then confirm the scheduler still succeeds:
   - `GET /api/cron/audit` (with the new secret) → `byOutcome` shows `authorized`
   - `recent` entries show `clientKind: "scheduler"`, `clientVendor: "cron-job.org"`
5. After 24-48h of clean scheduler runs, delete `CRON_SECRET_PREVIOUS` and redeploy.
6. Re-check the audit snapshot: `reason: "invalid-secret"` / `missing-secret`
   from non-scheduler clients is expected scanner noise and can be blocked at the edge.

If you enable `CRON_ALLOWED_IPS`, use the egress IPs of your scheduler. Do not
enable it before you know them — a valid secret from an unlisted IP will get `403`.

---

## 3. What each cron route requires

| Route | Guard |
| --- | --- |
| `GET /api/cron/ingest`, `GET /api/cron/buffer`, `GET /api/cron/sports` | `requireCron` |
| `GET /api/cron/streams`, `GET /api/cron/summarize`, `GET /api/cron/feed-health` | `requireCron` |
| `GET /api/cron/viral-trend-buffer`, `GET /api/cron/test-notify` | `requireCron` |
| `GET /api/cron/human-brain` | `requireCron` (previously had **no auth at all**) |
| `POST /api/cron/rates`, `POST /api/cron/prices`, `POST /api/cron/discussion` | `requireCronAuth` → `authorizeCronRequest` |
| `GET /api/cinema/cron-prewarm` | `requireCron` (previously only logged a bad secret) |
| `GET /api/migrate`, `GET /api/test-cron`, `GET /api/debug-env` | `requireCron` |
| `GET /api/cron/audit` | `requireCron` |

---

## 4. Origin auditing

Every attempt (allowed or denied) is recorded with:

`route`, `task`, `method`, `path`, `ok`, `status`, `reason`, `secretSource`,
`clientKind` (`scheduler` | `scanner` | `browser` | `automation` | `unknown`),
`clientVendor`, `ip`, `country`, `userAgent`, `referer`.

Two sinks:

1. **Runtime logs** — one line per attempt, prefixed `[CronAudit]`, JSON body.
   Search Vercel runtime logs for `[CronAudit]` to see live traffic.
2. **In-memory ring buffer** (300 entries) — `GET /api/cron/audit?secret=...&limit=100`.
   This buffer is per instance, so on Vercel it is a sample, not a full history.
   Use it to answer: *which IPs / user agents are hitting cron right now?*

Response shape includes `byOutcome`, `byClientKind`, `byClientVendor`,
`bySecretSource`, `byRoute`, `topDeniedIps`, `topDeniedUserAgents`,
`recentDenied`, `recent`.

Durable evidence still lives in Cloudflare Security Events / Logpush — the
in-app audit is there to make the split between scheduler and scanners obvious.

---

## 5. Edge hardening (manual, Cloudflare dashboard)

Not automatable from this repo; do it once:

1. **Security → Events**: filter `http.request.uri.path contains "/api/cron"` and
   review user agents / IPs hitting the endpoints.
2. Add a WAF custom rule: block requests to `/api/cron/*` whose user agent
   matches scanner tooling (`gobuster`, `nikto`, `nuclei`, `ffuf`, `feroxbuster`,
   `zgrab`, `masscan`, `python-requests`, `go-http-client`, `curl`, `wget`) — but
   keep the scheduler's user agent allowed.
3. Optionally add a rate limit for `/api/cron/*` (e.g. 30 requests/minute per IP).
4. Keep caching disabled for cron paths (already set in `vercel.json`:
   `Cache-Control: no-store`, `X-Robots-Tag: noindex`).

---

## 6. Verification

```bash
npm run verify:cron-auth
```

Runs offline checks against `backend/services/cronAuth.js`: fail-closed `503`,
`401` for missing/retired secrets, `200` for query/header/Bearer, rotation via
`CRON_SECRET_PREVIOUS`, `403` for non-allowlisted IPs, no-store headers,
client classification and audit aggregation.

Manual smoke test against a deployment:

```bash
# 401 (no secret)
curl -i "https://www.realssanews.com.ng/api/cron/ingest?category=ghana"

# 401 (retired secret)
curl -i "https://www.realssanews.com.ng/api/cron/ingest?category=ghana&secret=REDACTED-ROTATED-CRON-SECRET"

# 200 (current secret, via header)
curl -i -H "x-cron-secret: $CRON_SECRET" "https://www.realssanews.com.ng/api/cron/ingest?category=ghana"

# Audit sample
curl -s -H "x-cron-secret: $CRON_SECRET" "https://www.realssanews.com.ng/api/cron/audit?limit=50"
```

Each call should also print a `[CronAudit]` line in the Vercel runtime logs.
