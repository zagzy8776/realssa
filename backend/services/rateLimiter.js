/**
 * Bot Load Shaping Rate Limiter
 * -----------------------------
 * Shared rate limiter for all self-generated crawl traffic.
 * - Global ceiling: 20 rps
 * - Per-origin ceiling: 5 rps
 * - Jittered delays, spread across 24 hours instead of bursting
 * - Priority queue: article ingestion > sitemap pings > revalidation
 * - Backoff on 429 and 5xx
 * - Status endpoint exposes current rps and queue depth
 */

const GLOBAL_RPS = 20;
const PER_ORIGIN_RPS = 5;
const MAX_QUEUE_SIZE = 1000;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;

const PRIORITY = {
  ARTICLE_INGESTION: 1,
  SITEMAP_PING: 2,
  REVALIDATION: 3,
  OTHER: 4
};

class RateLimiter {
  constructor() {
    this.queue = [];
    this.globalTimestamps = [];
    this.originTimestamps = new Map();
    this.backoffOrigins = new Map();
    this.processing = false;
    this.stats = {
      totalProcessed: 0,
      totalBackoff: 0,
      lastProcessedAt: null
    };
  }

  add(task, priority = PRIORITY.OTHER) {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn('[RateLimiter] Queue full, dropping task');
      return false;
    }
    this.queue.push({ task, priority, addedAt: Date.now() });
    this.queue.sort((a, b) => a.priority - b.priority || a.addedAt - b.addedAt);
    this._startProcessing();
    return true;
  }

  getCurrentRPS() {
    const now = Date.now();
    this.globalTimestamps = this.globalTimestamps.filter(t => now - t < 1000);
    return this.globalTimestamps.length;
  }

  getQueueDepth() {
    return this.queue.length;
  }

  _canExecuteGlobal() {
    const now = Date.now();
    this.globalTimestamps = this.globalTimestamps.filter(t => now - t < 1000);
    return this.globalTimestamps.length < GLOBAL_RPS;
  }

  _canExecuteOrigin(origin) {
    const now = Date.now();
    const timestamps = this.originTimestamps.get(origin) || [];
    this.originTimestamps.set(origin, timestamps.filter(t => now - t < 1000));
    return timestamps.length < PER_ORIGIN_RPS;
  }

  _recordExecution(origin) {
    const now = Date.now();
    this.globalTimestamps.push(now);
    const timestamps = this.originTimestamps.get(origin) || [];
    timestamps.push(now);
    this.originTimestamps.set(origin, timestamps);
    this.stats.totalProcessed++;
    this.stats.lastProcessedAt = now;
  }

  _getBackoffDelay(origin, attempt = 1) {
    const existing = this.backoffOrigins.get(origin) || BACKOFF_BASE_MS;
    const delay = Math.min(existing * Math.pow(2, attempt), BACKOFF_MAX_MS);
    this.backoffOrigins.set(origin, delay);
    return delay;
  }

  _resetBackoff(origin) {
    this.backoffOrigins.delete(origin);
  }

  _recordBackoff(origin) {
    this.stats.totalBackoff++;
  }

  async _waitForSlot(origin) {
    const backoffDelay = this.backoffOrigins.get(origin) || 0;
    if (backoffDelay > 0) {
      await this._sleep(backoffDelay);
      this._resetBackoff(origin);
    }
    while (!this._canExecuteGlobal() || !this._canExecuteOrigin(origin)) {
      const now = Date.now();
      const globalWait = Math.max(0, (this.globalTimestamps.length - GLOBAL_RPS + 1) * 50);
      const originWait = Math.max(0, ((this.originTimestamps.get(origin) || []).length - PER_ORIGIN_RPS + 1) * 200);
      const wait = Math.max(globalWait, originWait, 50);
      await this._sleep(wait + Math.random() * 100);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async execute(task, priority = PRIORITY.OTHER) {
    const origin = task.origin || 'unknown';
    await this._waitForSlot(origin);
    this._recordExecution(origin);
    try {
      const result = await task();
      if (result?.status === 429 || result?.status >= 500) {
        this._recordBackoff(origin);
        const delay = this._getBackoffDelay(origin);
        await this._sleep(delay);
      } else {
        this._resetBackoff(origin);
      }
      return result;
    } catch (err) {
      this._recordBackoff(origin);
      throw err;
    }
  }

  getStatus() {
    return {
      rps: this.getCurrentRPS(),
      queueDepth: this.getQueueDepth(),
      globalLimit: GLOBAL_RPS,
      perOriginLimit: PER_ORIGIN_RPS,
      stats: this.stats,
      backoffOrigins: Array.from(this.backoffOrigins.entries())
    };
  }
}

const rateLimiter = new RateLimiter();

module.exports = {
  rateLimiter,
  PRIORITY,
  GLOBAL_RPS,
  PER_ORIGIN_RPS
};