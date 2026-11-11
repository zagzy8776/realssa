'use strict';

/**
 * Alert throttle
 * ==============
 * A breaking-news subscription is a promise, not a trap. This module caps
 * push volume, enforces a gap between alerts, and respects quiet hours.
 *
 * It is opt-in (ALERT_THROTTLE_ENABLED=1) so existing behaviour is unchanged
 * until the newsroom turns it on. Hard breaking alerts (score >= 3) may bypass
 * quiet hours but still respect the daily caps and a shorter gap.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function readConfig() {
  return {
    enabled: process.env.ALERT_THROTTLE_ENABLED === '1',
    globalPerDay: Math.max(1, Number(process.env.ALERT_GLOBAL_PER_DAY) || 8),
    perCategoryPerDay: Math.max(1, Number(process.env.ALERT_CATEGORY_PER_DAY) || 3),
    minGapMs: Math.max(1, Number(process.env.ALERT_MIN_GAP_MINUTES) || 45) * 60 * 1000,
    breakingGapMs: Math.max(1, Number(process.env.ALERT_BREAKING_GAP_MINUTES) || 15) * 60 * 1000,
    quietStartHour: Number.isFinite(Number(process.env.ALERT_QUIET_START))
      ? Number(process.env.ALERT_QUIET_START)
      : 23,
    quietEndHour: Number.isFinite(Number(process.env.ALERT_QUIET_END))
      ? Number(process.env.ALERT_QUIET_END)
      : 6,
    timezone: process.env.ALERT_TIMEZONE || 'Africa/Lagos',
  };
}

const sends = [];

function localHour(now, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date(now));
    const hour = parts.find((part) => part.type === 'hour')?.value;
    return Number(hour);
  } catch {
    return new Date(now).getHours();
  }
}

function isQuietHours(now, config) {
  const hour = localHour(now, config.timezone);
  if (config.quietStartHour === config.quietEndHour) return false;
  if (config.quietStartHour < config.quietEndHour) {
    return hour >= config.quietStartHour && hour < config.quietEndHour;
  }
  return hour >= config.quietStartHour || hour < config.quietEndHour;
}

function prune(now) {
  while (sends.length && now - sends[0].ts > DAY_MS) sends.shift();
}

function canSend({ category = 'general', priority = 0, breaking = false, now = Date.now() } = {}) {
  const config = readConfig();
  if (!config.enabled) return { allowed: true, reason: 'disabled', config };

  prune(now);

  const isBreaking = breaking || Number(priority) >= 3;
  const categoryKey = String(category || 'general').toLowerCase();

  if (!isBreaking && isQuietHours(now, config)) {
    return { allowed: false, reason: 'quiet_hours', config };
  }

  if (sends.length >= config.globalPerDay) {
    return { allowed: false, reason: 'global_daily_cap', config };
  }

  const categoryCount = sends.filter((send) => send.category === categoryKey).length;
  if (categoryCount >= config.perCategoryPerDay) {
    return { allowed: false, reason: 'category_daily_cap', config };
  }

  const last = sends[sends.length - 1];
  if (last) {
    const gap = isBreaking ? config.breakingGapMs : config.minGapMs;
    if (now - last.ts < gap) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterMs: gap - (now - last.ts),
        config,
      };
    }
  }

  return { allowed: true, reason: 'ok', breaking: isBreaking, config };
}

function record({ category = 'general', priority = 0, breaking = false, now = Date.now() } = {}) {
  sends.push({
    ts: now,
    category: String(category || 'general').toLowerCase(),
    priority: Number(priority) || 0,
    breaking: Boolean(breaking || Number(priority) >= 3),
  });
  prune(now);
}

function getState(now = Date.now()) {
  prune(now);
  const config = readConfig();
  return {
    enabled: config.enabled,
    sentLast24h: sends.length,
    lastSentAt: sends.length ? new Date(sends[sends.length - 1].ts).toISOString() : null,
    quietHours: isQuietHours(now, config),
    caps: {
      globalPerDay: config.globalPerDay,
      perCategoryPerDay: config.perCategoryPerDay,
      minGapMinutes: Math.round(config.minGapMs / 60000),
      breakingGapMinutes: Math.round(config.breakingGapMs / 60000),
      quietStartHour: config.quietStartHour,
      quietEndHour: config.quietEndHour,
      timezone: config.timezone,
    },
  };
}

module.exports = { canSend, record, getState, _internals: { localHour, isQuietHours, readConfig } };
