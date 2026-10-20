/**
 * Volatility Alarm — "market pulse" attention engine
 *
 * Subscribes to the existing cryptoLive + socialPredictive engines and
 * fires OneSignal push notifications (with optional affiliate deep links)
 * when a coin breaches a volatility threshold or social panic velocity
 * spikes.
 *
 * Severity ladder:
 *   watch : |1min tick| > 0.4% OR |24h| > 3%
 *   alert : |1min tick| > 0.8% OR |24h| > 5% OR Fear&Greed < 20 / > 80
 *   panic : |1min tick| > 1.5% OR |24h| > 8%
 *
 * Anti-spam: each (symbol, severity) is rate-limited to 1 push per 15 min
 * in-process, and each symbol is deduped for 60 min.
 */

const LOG = {
  info: (m) => console.log(`[VolatilityAlarm] ${m}`),
  warn: (m) => console.warn(`[VolatilityAlarm] ${m}`),
  error: (m) => console.error(`[VolatilityAlarm] ${m}`),
};

const ENABLED = process.env.VOLATILITY_ALARM !== '0';

// Thresholds (percent)
const TICK_PCT = { watch: 0.4, alert: 0.8, panic: 1.5 };
const DAY_PCT = { watch: 3, alert: 5, panic: 8 };
const FNG_PANIC_LOW = 20;
const FNG_PANIC_HIGH = 80;

// Social panic: predicted_trend_score above this triggers an alert
const SOCIAL_PANIC_SCORE = 80;

// Affiliate deep link template — override via env
const AFFILIATE_URL = process.env.AFFILIATE_DEEP_LINK || 'https://www.realssanews.com.ng/crypto';

// Rate limits (ms)
const SEVERITY_COOLDOWN_MS = 15 * 60 * 1000;
const SYMBOL_DEDUP_MS = 60 * 60 * 1000;

const lastPushBySeverity = new Map();
const lastFiredBySymbol = new Map();

function canFire(symbol, severity) {
  const now = Date.now();
  const sevKey = `${symbol}:${severity}`;
  if (now - (lastPushBySeverity.get(sevKey) || 0) < SEVERITY_COOLDOWN_MS) return false;
  if (now - (lastFiredBySymbol.get(symbol) || 0) < SYMBOL_DEDUP_MS) return false;
  return true;
}
function markFired(symbol, severity) {
  const now = Date.now();
  lastPushBySeverity.set(`${symbol}:${severity}`, now);
  lastFiredBySymbol.set(symbol, now);
}

function classifyTicker(tickChange, change24h, fearGreedValue) {
  const absTick = Math.abs(tickChange || 0);
  const absDay = Math.abs(change24h || 0);
  let severity = null;
  if (absTick >= TICK_PCT.panic || absDay >= DAY_PCT.panic) severity = 'panic';
  else if (absTick >= TICK_PCT.alert || absDay >= DAY_PCT.alert ||
           (fearGreedValue != null && (fearGreedValue <= FNG_PANIC_LOW || fearGreedValue >= FNG_PANIC_HIGH))) severity = 'alert';
  else if (absTick >= TICK_PCT.watch || absDay >= DAY_PCT.watch) severity = 'watch';
  return severity;
}

function formatPrice(p) {
  if (p == null) return '';
  return Number(p).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function buildCopy(symbol, price, pct, severity, fearGreed) {
  const up = pct >= 0;
/**
 * Core check — called on every cryptoLive tick (throttled to 1x/sec).
 */
async function checkTick(snapshot) {
  if (!ENABLED) return;
  if (!snapshot || !Array.isArray(snapshot.coins)) return;

  const { pgRun } = (() => { try { return require('./pg'); } catch { return { pgRun: async () => ({}) }; } })();
  const notificationService = (() => { try { return require('./notificationService'); } catch { return null; } })();

  for (const coin of snapshot.coins) {
    if (!coin || coin.stale) continue;
    const severity = classifyTicker(coin.tickChange, coin.change24h, snapshot.fearGreed?.value);
    if (!severity) continue;
    if (!canFire(coin.symbol, severity)) continue;

    const copy = buildCopy(coin.symbol, coin.price, coin.tickChange, severity, snapshot.fearGreed);

    let pushed = false;
    if (severity !== 'watch' && notificationService) {
      try {
        const url = `${AFFILIATE_URL}?sym=${encodeURIComponent(coin.symbol)}&sev=${severity}`;
        const result = await notificationService.sendToTopic('crypto', {
          title: copy.title,
          body: copy.body,
          url,
          image: null,
          ...(severity === 'panic' ? { priority: 10 } : {}),
        });
        if (result && result.success) {
          pushed = true;
          LOG.info(`PUSH ${severity} ${coin.symbol} tick=${coin.tickChange}% 24h=${coin.change24h}% recipients=${result.recipients ?? '?'}`);
        }
      } catch (err) {
        LOG.warn(`push failed for ${coin.symbol}: ${err.message}`);
      }
    }
    if (severity !== 'watch') markFired(coin.symbol, severity);

    try {
      await pgRun(
        `INSERT INTO volatility_alarms
           (trigger_source, symbol, price, prev_price, pct_change, fear_greed_value, severity, push_sent, affiliate_url)
         VALUES ('crypto_price', $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          coin.symbol, coin.price ?? null, coin.prevPrice ?? null, coin.tickChange ?? null,
          snapshot.fearGreed?.value ?? null, severity,
          pushed,
          `${AFFILIATE_URL}?sym=${coin.symbol}&sev=${severity}`,
        ]
      );
    } catch (e) {
      LOG.warn(`volatility_alarms write skipped: ${e.message}`);
    }
  }
}

/**
 * Social-panic scan — called on each socialPredictive poll (10 min).
 * If a top keyword has a predicted_trend_score above threshold, fire a
 * single 'panic' push to the crypto/business audience.
 */
async function checkSocialPanic(snapshot) {
  if (!ENABLED) return;
  if (!snapshot || !Array.isArray(snapshot.trends)) return;

  const top = snapshot.trends.find((t) => t && (t.predicted_trend_score || 0) >= SOCIAL_PANIC_SCORE);
  if (!top) return;

  const key = `social:${top.keyword}`;
  if (!canFire(key, 'panic')) return;

  const notificationService = (() => { try { return require('./notificationService'); } catch { return null; } })();
  const { pgRun } = (() => { try { return require('./pg'); } catch { return { pgRun: async () => ({}) }; } })();

  if (notificationService) {
    try {
      const title = `\u{1F6A8} "${top.keyword}" is spiking across social — ${top.mentions_current} mentions in the last window`;
      const body = `Velocity ${top.velocity} \u00b7 predicted score ${top.predicted_trend_score}. Read the related coverage before it peaks.`;
      const url = `${AFFILIATE_URL}?q=${encodeURIComponent(top.keyword)}&sev=panic`;
      const result = await notificationService.sendToTopic('business', {
        title: title.slice(0, 90),
        body: body.slice(0, 140),
        url,
        priority: 10,
      });
      if (result && result.success) {
        markFired(key, 'panic');
        LOG.info(`SOCIAL-PANIC PUSH keyword="${top.keyword}" score=${top.predicted_trend_score} recipients=${result.recipients ?? '?'}`);
      }
    } catch (err) {
      LOG.warn(`social panic push failed: ${err.message}`);
    }
  }
// ── Wiring to existing engines ────────────────────────────────────────────
let lastTickCheck = 0;
function start() {
  if (!ENABLED) {
    LOG.info('Volatility alarm DISABLED (VOLATILITY_ALARM=0)');
    return;
  }
  try {
    const cryptoLive = require('./cryptoLive.service');
    cryptoLive.subscribe((snap) => {
      const now = Date.now();
      if (now - lastTickCheck < 1000) return;
      lastTickCheck = now;
      checkTick(snap).catch((e) => LOG.warn(`tick check error: ${e.message}`));
    });
    LOG.info('Subscribed to cryptoLive ticks (1/sec throttle)');
  } catch (e) {
    LOG.warn(`cryptoLive subscribe failed: ${e.message}`);
  }

  try {
    const socialPredictive = require('./socialPredictive.service');
    let lastComputedAt = null;
    const poll = setInterval(() => {
      const snap = socialPredictive.getSnapshot();
      if (snap && snap.computedAt && snap.computedAt !== lastComputedAt) {
        lastComputedAt = snap.computedAt;
        checkSocialPanic(snap).catch((e) => LOG.warn(`social check error: ${e.message}`));
      }
    }, 60 * 1000);
    if (poll.unref) poll.unref();
    LOG.info('Social-panic watcher started (60s poll of socialPredictive snapshot)');
  } catch (e) {
    LOG.warn(`socialPredictive hook failed: ${e.message}`);
  }
}

function stop() {
  // Listeners are cleared by cryptoLive.stop(); social poller is unref'd.
}

module.exports = { start, stop, checkTick, checkSocialPanic, classifyTicker };

  try {
    await pgRun(
      `INSERT INTO volatility_alarms (trigger_source, symbol, social_velocity, severity, push_sent, affiliate_url)
       VALUES ('social_panic', $1, $2, 'panic', $3, $4)`,
      [top.keyword, top.velocity ?? null, true, `${AFFILIATE_URL}?q=${top.keyword}&sev=panic`]
    );
  } catch (e) {
    LOG.warn(`volatility_alarms social write skipped: ${e.message}`);
  }
}
  const arrow = up ? '\u{1F4C8}' : '\u{1F4C9}';
  const emoji = severity === 'panic' ? '\u{1F6A8}' : severity === 'alert' ? '\u26A0\uFE0F' : '\u{1F441}';
  const dir = up ? 'surges' : 'drops';
  const priceStr = formatPrice(price);
  const fng = fearGreed && fearGreed.value != null
    ? ` \u00b7 Fear & Greed: ${fearGreed.value} (${fearGreed.classification || 'n/a'})`
    : '';
  const title = `${emoji} ${symbol} ${dir} ${Math.abs(pct).toFixed(2)}% to $${priceStr}`;
  const body = `${arrow} ${symbol} is moving fast. See the live chart + correlated news before it settles.${fng}`;
  return { title: title.slice(0, 90), body: body.slice(0, 140) };
}