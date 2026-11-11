#!/usr/bin/env node
/**
 * verify-cron-auth.cjs
 *
 * Offline verification of backend/services/cronAuth.js — the shared guard used
 * by every /api/cron/* route. No server, database or network required.
 *
 *   npm run verify:cron-auth
 *
 * Covers what the production incident was about:
 *   - a missing CRON_SECRET fails closed (503) instead of allowing requests
 *   - a request with NO secret is rejected (the old `if (secret && ...)` bug)
 *   - the retired hard-coded secret is rejected
 *   - a valid secret is accepted from query, header and Bearer token
 *   - CRON_SECRET_PREVIOUS keeps the scheduler working during rotation
 *   - CRON_ALLOWED_IPS blocks non-allowlisted origins
 *   - every attempt is classified and recorded in the audit snapshot
 */
'use strict';

const assert = require('assert');
const path = require('path');

const cronAuth = require(path.join(__dirname, 'backend', 'services', 'cronAuth.js'));

const {
  authorizeCronRequest,
  requireCron,
  sendCronDenial,
  applyCronNoStore,
  getCronAuditSnapshot,
  timingSafeEquals,
  extractSuppliedSecret,
  classifyCronClient,
} = cronAuth;

const ENV_KEYS = ['CRON_SECRET', 'CRON_JOB_SECRET', 'CRON_SECRET_PREVIOUS', 'CRON_ALLOWED_IPS', 'CRON_AUDIT_LOG_SUCCESS'];

const results = [];
const check = (name, fn) => {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
};

const resetEnv = () => {
  for (const key of ENV_KEYS) delete process.env[key];
};

const makeReq = ({ url = '/api/cron/ingest', headers = {}, method = 'GET' } = {}) => ({
  url,
  originalUrl: url,
  method,
  headers,
  socket: { remoteAddress: '10.0.0.1' },
});

const makeExpressRes = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(key, value) { res.headers[key.toLowerCase()] = value; return res; },
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  return res;
};

const makeRawRes = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: '',
    headersSent: false,
    writableEnded: false,
    setHeader(key, value) { res.headers[key.toLowerCase()] = value; return res; },
    end(chunk) { res.body = chunk || ''; res.writableEnded = true; },
  };
  return res;
};

// Silence + capture the structured audit log lines.
const auditLines = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
console.log = (...args) => { const line = args.join(' '); if (line.startsWith('[CronAudit]')) auditLines.push(line); };
console.warn = (...args) => { const line = args.join(' '); if (line.startsWith('[CronAudit]')) auditLines.push(line); };
console.error = () => {};

try {
  resetEnv();

  check('fails closed with 503 when CRON_SECRET is unset', () => {
    const result = authorizeCronRequest(makeReq({ url: '/api/cron/ingest?secret=anything' }), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 503);
    assert.strictEqual(result.reason, 'cron-secret-not-configured');
  });

  check('rejects a request with no secret at all (old bug)', () => {
    process.env.CRON_SECRET = 'new-secret';
    const result = authorizeCronRequest(makeReq(), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.reason, 'missing-secret');
  });

  check('rejects the retired hard-coded secret', () => {
    process.env.CRON_SECRET = 'new-secret';
    const result = authorizeCronRequest(makeReq({ url: '/api/cron/ingest?secret=realssa-cron-secret-2026' }), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.reason, 'invalid-secret');
  });

  check('accepts ?secret=', () => {
    process.env.CRON_SECRET = 'new-secret';
    const result = authorizeCronRequest(makeReq({ url: '/api/cron/ingest?secret=new-secret' }), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.secretSource, 'query');
  });

  check('accepts x-cron-secret', () => {
    process.env.CRON_SECRET = 'new-secret';
    const result = authorizeCronRequest(makeReq({ headers: { 'x-cron-secret': 'new-secret' } }), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.secretSource, 'x-cron-secret');
  });

  check('accepts Authorization: Bearer (Vercel Cron)', () => {
    process.env.CRON_SECRET = 'new-secret';
    const result = authorizeCronRequest(makeReq({ headers: { authorization: 'Bearer new-secret' } }), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.secretSource, 'authorization');
  });

  check('accepts CRON_SECRET_PREVIOUS during rotation', () => {
    resetEnv();
    process.env.CRON_SECRET = 'new-secret';
    process.env.CRON_SECRET_PREVIOUS = 'old-secret';
    const result = authorizeCronRequest(makeReq({ url: '/api/cron/ingest?secret=old-secret' }), { route: '/api/cron/ingest' });
    assert.strictEqual(result.ok, true);
  });

  check('enforces CRON_ALLOWED_IPS when configured', () => {
    resetEnv();
    process.env.CRON_SECRET = 'new-secret';
    process.env.CRON_ALLOWED_IPS = '203.0.113.9, 203.0.113.10';

    const blocked = authorizeCronRequest(
      makeReq({ url: '/api/cron/ingest?secret=new-secret', headers: { 'cf-connecting-ip': '198.51.100.7' } }),
      { route: '/api/cron/ingest' }
    );
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual(blocked.reason, 'ip-not-allowlisted');

    const allowed = authorizeCronRequest(
      makeReq({ url: '/api/cron/ingest?secret=new-secret', headers: { 'cf-connecting-ip': '203.0.113.9' } }),
      { route: '/api/cron/ingest' }
    );
    assert.strictEqual(allowed.ok, true);
    assert.strictEqual(allowed.ip, '203.0.113.9');
  });

  check('requireCron sets no-store and 401 for Express, returns null', () => {
    resetEnv();
    process.env.CRON_SECRET = 'new-secret';
    const res = makeExpressRes();
    const result = requireCron(makeReq({ url: '/api/cron/ingest?secret=wrong' }), res, { route: '/api/cron/ingest' });
    assert.strictEqual(result, null);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Unauthorized');
    assert.match(res.headers['cache-control'], /no-store/);
  });

  check('requireCron returns the audit entry for a valid secret', () => {
    resetEnv();
    process.env.CRON_SECRET = 'new-secret';
    const res = makeExpressRes();
    const result = requireCron(
      makeReq({ url: '/api/cron/ingest?secret=new-secret' }),
      res,
      { route: '/api/cron/ingest', task: 'rss-ingest' }
    );
    assert.ok(result);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.task, 'rss-ingest');
    assert.strictEqual(res.body, null);
  });

  check('sendCronDenial works on a raw Node response (api/index.js)', () => {
    const res = makeRawRes();
    sendCronDenial(res, { ok: false, status: 401, reason: 'missing-secret', timestamp: new Date().toISOString() });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(JSON.parse(res.body).reason, 'missing-secret');
    assert.strictEqual(res.headers['cdn-cache-control'], 'no-store');
    assert.strictEqual(res.headers['vercel-cdn-cache-control'], 'no-store');
  });

  check('applyCronNoStore tolerates non-response values', () => {
    assert.doesNotThrow(() => applyCronNoStore(undefined));
    assert.doesNotThrow(() => applyCronNoStore({}));
  });

  check('timingSafeEquals handles length mismatches and empty input', () => {
    assert.strictEqual(timingSafeEquals('abc', 'abc'), true);
    assert.strictEqual(timingSafeEquals('abc', 'abd'), false);
    assert.strictEqual(timingSafeEquals('abc', 'abcd'), false);
    assert.strictEqual(timingSafeEquals('', ''), false);
    assert.strictEqual(timingSafeEquals(undefined, 'abc'), false);
  });

  check('extractSuppliedSecret reports where the secret came from', () => {
    assert.strictEqual(extractSuppliedSecret(makeReq({ url: '/x?secret=q' })).source, 'query');
    assert.strictEqual(extractSuppliedSecret(makeReq({ url: '/x', headers: { 'x-cron-secret': 'h' } })).source, 'x-cron-secret');
    assert.strictEqual(extractSuppliedSecret(makeReq({ url: '/x', headers: { authorization: 'Bearer b' } })).source, 'authorization');
    assert.deepStrictEqual(extractSuppliedSecret(makeReq({ url: '/x' })), { secret: '', source: 'none' });
  });

  check('classifyCronClient separates scheduler / scanner / browser / unknown', () => {
    const kind = (userAgent) => classifyCronClient(makeReq({ headers: userAgent === null ? {} : { 'user-agent': userAgent } })).kind;
    assert.strictEqual(kind('cron-job.org (https://cron-job.org)'), 'scheduler');
    assert.strictEqual(kind('Vercel Cron'), 'scheduler');
    assert.strictEqual(kind('gobuster/3.6'), 'scanner');
    assert.strictEqual(kind('curl/8.4.0'), 'scanner');
    assert.strictEqual(kind('Mozilla/5.0 (Windows NT 10.0) Chrome/120'), 'browser');
    assert.strictEqual(kind(null), 'unknown');
  });

  check('audit snapshot aggregates allowed and denied attempts', () => {
    resetEnv();
    process.env.CRON_SECRET = 'new-secret';
    authorizeCronRequest(makeReq({ url: '/api/cron/ingest?secret=new-secret' }), { route: '/api/cron/ingest' });
    authorizeCronRequest(makeReq({ url: '/api/cron/ingest?secret=bad', headers: { 'user-agent': 'gobuster/3.6' } }), { route: '/api/cron/ingest' });

    const snapshot = getCronAuditSnapshot({ limit: 50 });
    assert.ok(snapshot.sampled >= 2);
    assert.ok(snapshot.allowed >= 1);
    assert.ok(snapshot.denied >= 1);
    assert.strictEqual(snapshot.cronSecretConfigured, true);
    assert.ok(snapshot.byRoute.some((entry) => entry.value === '/api/cron/ingest'));
    assert.ok(snapshot.topDeniedUserAgents.some((entry) => entry.value === 'gobuster/3.6'));
    assert.ok(snapshot.recentDenied.length >= 1);
  });

  check('writes [CronAudit] structured log lines', () => {
    assert.ok(auditLines.length > 0, 'expected at least one [CronAudit] log line');
    const sample = JSON.parse(auditLines[auditLines.length - 1].replace('[CronAudit] ', ''));
    assert.ok('route' in sample && 'clientKind' in sample && 'reason' in sample);
  });
} finally {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
}

const failed = results.filter((entry) => !entry.ok);

console.log('');
console.log('Cron auth verification');
console.log('----------------------');
for (const entry of results) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}`);
  if (!entry.ok) console.log(`      ${entry.error}`);
}
console.log('');
console.log(`${results.length - failed.length}/${results.length} checks passed`);

if (failed.length > 0) {
  process.exitCode = 1;
}
  