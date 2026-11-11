'use strict';

/**
 * Shared cron authentication, client classification and audit trail.
 *
 * Why this module exists
 * ----------------------
 * /api/cron/ingest used to accept a hard-coded, publicly documented secret
 * (it was committed to this repo and pasted into docs and cron-job.org URLs)
 * and, on some handlers, allowed requests with no secret at all. That made it
 * possible for any external client to trigger a full RSS ingestion cycle,
 * which is the cheapest way to burn function invocations and outbound
 * bandwidth. The leaked value must be treated as burned: rotate it.
 *
 * Rules enforced here:
 *   1. Fail closed. If CRON_SECRET is not configured, every cron request is
 *      rejected (503) instead of falling back to a value that is in git.
 *   2. Secrets are never compared with `===` (timing safe compare).
 *   3. Rotation is supported through CRON_SECRET_PREVIOUS, so the old secret
 *      can be retired without breaking the scheduler mid-rollout.
 *   4. Optional IP allowlist via CRON_ALLOWED_IPS (comma separated exact IPs).
 *   5. Every attempt is classified (scheduler / scanner / browser / automation)
 *      and recorded, so "is this my cron or an external client?" is answerable
 *      from logs instead of guesswork.
 *
 * Secrets are accepted from, in order:
 *   - ?secret=...                       query string (legacy cron-job.org URLs)
 *   - x-cron-secret: ...                header (preferred for cron-job.org)
 *   - Authorization: Bearer ...         header (Vercel Cron / manual runs)
 */

const crypto = require('crypto');

const AUDIT_LIMIT = 300;

/** @type {Array<object>} */
const auditBuffer = [];
let auditSequence = 0;
let missingSecretWarned = false;

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

const parseRequestUrl = (req, parsedUrl) => {
  if (parsedUrl) return parsedUrl;
  try {
    return new URL(req.originalUrl || req.url || '/', 'https://realssa.internal');
  } catch {
    return null;
  }
};

/**
 * Current (and optionally previous) cron secrets.
 * No defaults — an unconfigured deployment has zero accepted secrets.
 */
const resolveCronSecrets = () => {
  const secrets = [];
  const current = trim(process.env.CRON_SECRET) || trim(process.env.CRON_JOB_SECRET);
  if (current) secrets.push(current);
  const previous = trim(process.env.CRON_SECRET_PREVIOUS);
  if (previous && previous !== current) secrets.push(previous);
  return secrets;
};

const isCronConfigured = () => resolveCronSecrets().length > 0;

const timingSafeEquals = (supplied, expected) => {
  const suppliedBuffer = Buffer.from(String(supplied));
  const expectedBuffer = Buffer.from(String(expected));
  if (!suppliedBuffer.length || suppliedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
};

const extractSuppliedSecret = (req, parsedUrl) => {
  const url = parseRequestUrl(req, parsedUrl);

  const querySecret = trim(url ? url.searchParams.get('secret') : '');
  if (querySecret) return { secret: querySecret, source: 'query' };

  const headerSecret = trim(req.headers ? req.headers['x-cron-secret'] : '');
  if (headerSecret) return { secret: headerSecret, source: 'x-cron-secret' };

  const authorization = trim(req.headers ? req.headers.authorization : '');
  if (/^bearer\s+/i.test(authorization)) {
    return { secret: authorization.replace(/^bearer\s+/i, '').trim(), source: 'authorization' };
  }

  return { secret: '', source: 'none' };
};

const clientIp = (req) => {
  const headers = req.headers || {};
  const cfConnectingIp = trim(headers['cf-connecting-ip']);
  if (cfConnectingIp) return cfConnectingIp;

  const vercelForwarded = trim(headers['x-vercel-forwarded-for']);
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim();

  const forwarded = trim(headers['x-forwarded-for']);
  if (forwarded) return forwarded.split(',')[0].trim();

  return trim((req.socket && req.socket.remoteAddress) || req.ip || '');
};

const SCHEDULER_SIGNATURES = [
  { match: 'vercel-cron', vendor: 'vercel-cron' },
  { match: 'vercel cron', vendor: 'vercel-cron' },
  { match: 'cron-job.org', vendor: 'cron-job.org' },
  { match: 'cronjob', vendor: 'cron-job.org' },
  { match: 'google-cloud-scheduler', vendor: 'google-cloud-scheduler' },
  { match: 'uptimerobot', vendor: 'uptimerobot' },
  { match: 'cron', vendor: 'cron-generic' }
];

const SCANNER_PATTERN = /(gobuster|nikto|nmap|masscan|zgrab|nuclei|dirbuster|ffuf|wfuzz|feroxbuster|dirb|sqlmap|acunetix|nessus|openvas|python-requests|python-urllib|go-http-client|java\/|curl\/|wget\/|axios\/|okhttp|libwww|httpclient|postmanruntime|insomnia)/i;

const BROWSER_PATTERN = /(mozilla\/|chrome\/|safari\/|firefox\/|edg\/|opr\/)/i;

/**
 * Classify the caller so logs answer "legit scheduler" vs "external client".
 * This is advisory only — authentication is still the gate.
 */
const classifyCronClient = (req) => {
  const headers = req.headers || {};
  const userAgent = trim(headers['user-agent']);
  const lowered = userAgent.toLowerCase();
  const ip = clientIp(req);
  const referer = trim(headers.referer || headers.origin).slice(0, 200);

  const base = { ip, userAgent: userAgent.slice(0, 200), referer, country: trim(headers['cf-ipcountry']) };

  const scheduler = SCHEDULER_SIGNATURES.find((entry) => lowered.includes(entry.match));
  if (scheduler) {
    return { ...base, kind: 'scheduler', vendor: scheduler.vendor };
  }
  if (!lowered) {
    return { ...base, kind: 'unknown', vendor: 'no-user-agent' };
  }
  if (SCANNER_PATTERN.test(lowered)) {
    return { ...base, kind: 'scanner', vendor: 'automation-ua' };
  }
  if (BROWSER_PATTERN.test(lowered)) {
    return { ...base, kind: 'browser', vendor: 'browser-ua' };
  }
  return { ...base, kind: 'automation', vendor: 'other-ua' };
};

const resolveAllowlist = () => trim(process.env.CRON_ALLOWED_IPS)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const safePath = (req, parsedUrl) => {
  const url = parseRequestUrl(req, parsedUrl);
  return url ? url.pathname : String(req.url || '/').split('?')[0];
};

const rememberAudit = (entry) => {
  auditBuffer.push(entry);
  if (auditBuffer.length > AUDIT_LIMIT) auditBuffer.splice(0, auditBuffer.length - AUDIT_LIMIT);
};

const logAudit = (entry) => {
  const line = `[CronAudit] ${JSON.stringify(entry)}`;
  if (entry.ok) {
    if (trim(process.env.CRON_AUDIT_LOG_SUCCESS) === 'false') return;
    console.log(line);
    return;
  }
  console.warn(line);
};

/**
 * Decide whether a cron request is allowed.
 *
 * @returns {object} audit entry: ok, status, reason, client details, secretSource.
 */
const authorizeCronRequest = (req, options = {}) => {
  const { route = 'cron', task = null, parsedUrl = null } = options;

  const path = safePath(req, parsedUrl);
  const timestamp = new Date().toISOString();
  const client = classifyCronClient(req);
  const { secret, source } = extractSuppliedSecret(req, parsedUrl);
  const configuredSecrets = resolveCronSecrets();
  const allowlist = resolveAllowlist();

  let ok = false;
  let status = 401;
  let reason = 'unauthorized';

  if (configuredSecrets.length === 0) {
    status = 503;
    reason = 'cron-secret-not-configured';
    if (!missingSecretWarned) {
      missingSecretWarned = true;
      console.error('[CronAuth] CRON_SECRET is not set on this deployment. Cron endpoints are failing closed until it is configured.');
    }
  } else if (!secret) {
    reason = 'missing-secret';
  } else if (!configuredSecrets.some((candidate) => timingSafeEquals(secret, candidate))) {
    reason = 'invalid-secret';
  } else if (allowlist.length > 0 && !allowlist.includes(client.ip)) {
    status = 403;
    reason = 'ip-not-allowlisted';
  } else {
    ok = true;
    status = 200;
    reason = 'authorized';
  }

  const entry = {
    id: ++auditSequence,
    ts: timestamp,
    route,
    task,
    method: req.method || 'GET',
    path,
    ok,
    status,
    reason,
    secretSource: source,
    clientKind: client.kind,
    clientVendor: client.vendor,
    ip: client.ip,
    country: client.country || null,
    userAgent: client.userAgent,
    referer: client.referer || null
  };

  rememberAudit(entry);
  logAudit(entry);

  return { ...entry, client };
};

const applyCronNoStore = (res) => {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
};

/**
 * Send a denial for either an Express `res` or a raw Node `res`
 * (api/index.js wraps the Express app and uses raw ServerResponse helpers).
 */
const sendCronDenial = (res, result) => {
  applyCronNoStore(res);
  const payload = {
    error: result.status === 503
      ? 'Cron secret is not configured on this deployment'
      : 'Unauthorized',
    reason: result.reason,
    timestamp: result.timestamp
  };

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(result.status).json(payload);
    return true;
  }

  if (!res.headersSent && typeof res.setHeader === 'function') {
    res.statusCode = result.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  if (typeof res.end === 'function' && !res.writableEnded) {
    res.end(JSON.stringify(payload));
  }
  return true;
};

/**
 * Express-friendly guard: returns the audit result when allowed, otherwise
 * writes the 401/403/503 response and returns null.
 */
const requireCron = (req, res, options = {}) => {
  const result = authorizeCronRequest(req, options);
  applyCronNoStore(res);
  if (result.ok) return result;
  sendCronDenial(res, result);
  return null;
};

const topEntries = (entries, key, limit = 6) => {
  const counts = new Map();
  for (const entry of entries) {
    const value = entry[key] || 'unknown';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
};

/**
 * Snapshot of the in-memory audit ring buffer.
 *
 * NOTE: this buffer is per process/instance. On Vercel each lambda instance has
 * its own copy, so treat this as a live sample. Durable evidence lives in
 * Cloudflare Security Events / Logpush and Vercel runtime logs, where every
 * [CronAudit] line is searchable.
 */
const getCronAuditSnapshot = ({ limit = 40 } = {}) => {
  const entries = [...auditBuffer];
  const denied = entries.filter((entry) => !entry.ok);
  const allowed = entries.filter((entry) => entry.ok);

  return {
    generatedAt: new Date().toISOString(),
    sampled: entries.length,
    allowed: allowed.length,
    denied: denied.length,
    cronSecretConfigured: isCronConfigured(),
    rotationSecretConfigured: Boolean(trim(process.env.CRON_SECRET_PREVIOUS)),
    ipAllowlistConfigured: resolveAllowlist().length > 0,
    byOutcome: topEntries(entries, 'reason'),
    byClientKind: topEntries(entries, 'clientKind'),
    byClientVendor: topEntries(entries, 'clientVendor'),
    bySecretSource: topEntries(entries, 'secretSource'),
    byRoute: topEntries(entries, 'route'),
    topDeniedIps: topEntries(denied, 'ip'),
    topDeniedUserAgents: topEntries(denied, 'userAgent'),
    recentDenied: denied.slice(-Math.min(limit, 20)),
    recent: entries.slice(-limit)
  };
};

module.exports = {
  AUDIT_LIMIT,
  resolveCronSecrets,
  isCronConfigured,
  timingSafeEquals,
  extractSuppliedSecret,
  classifyCronClient,
  authorizeCronRequest,
  requireCron,
  applyCronNoStore,
  sendCronDenial,
  getCronAuditSnapshot
};
