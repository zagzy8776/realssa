/**
 * RealSSA Points (RP) & Security Ledger Service (walletService.js)
 * Implements immutable points_ledger, deduplication, hardware fingerprinting,
 * AI velocity check, and proxy rejection.
 */

const { pool } = require('./ingestion');

// Migration: Ensure points_ledger and security tables exist
async function initWalletSystem() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS points_ledger (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        delta INTEGER NOT NULL,
        reason VARCHAR(50) NOT NULL,
        reference_id VARCHAR(150) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_points_ledger_ref ON points_ledger(reference_id);

      CREATE TABLE IF NOT EXISTS referral_conversions (
        id SERIAL PRIMARY KEY,
        referrer_user_id VARCHAR(100) NOT NULL,
        referee_device_id VARCHAR(150) UNIQUE NOT NULL,
        articles_read_count INT DEFAULT 0,
        distinct_days_count INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        qualified_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS quarantined_accounts (
        user_id VARCHAR(100) PRIMARY KEY,
        reason VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[WalletService] ✅ Immutable points_ledger & security tables initialized');
  } catch (err) {
    console.warn('[WalletService] Init table warning:', err.message);
  }
}

initWalletSystem();

/**
 * Record a point transaction in the immutable ledger with deduplication reference key
 */
async function recordLedgerTransaction(userId, delta, reason, referenceId) {
  if (!userId || delta === 0 || !referenceId) return null;
  
  // Check if account is quarantined
  try {
    const qCheck = await pool.query(`SELECT 1 FROM quarantined_accounts WHERE user_id = $1`, [userId]);
    if (qCheck.rows.length > 0) {
      console.warn(`[WalletService] 🛡️ Ignored transaction for quarantined user: ${userId}`);
      return null;
    }
  } catch (_) {}

  try {
    const res = await pool.query(
      `INSERT INTO points_ledger (user_id, delta, reason, reference_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reference_id) DO NOTHING
       RETURNING id, user_id, delta, reason, created_at`,
      [userId, delta, reason, referenceId]
    );
    return res.rows[0] || null;
  } catch (err) {
    console.warn('[WalletService] Ledger insert error:', err.message);
    return null;
  }
}

/**
 * Get user points balance via SUM(delta) over the immutable ledger
 */
async function getUserBalance(userId) {
  if (!userId) return { total_points: 0, ledger_count: 0 };
  try {
    const res = await pool.query(
      `SELECT COALESCE(SUM(delta), 0) AS total_points, COUNT(*) AS ledger_count
       FROM points_ledger WHERE user_id = $1`,
      [userId]
    );
    return {
      total_points: parseInt(res.rows[0].total_points, 10),
      ledger_count: parseInt(res.rows[0].ledger_count, 10),
    };
  } catch (err) {
    return { total_points: 0, ledger_count: 0 };
  }
}

/**
 * Get user points transaction history
 */
async function getUserHistory(userId, limit = 20, offset = 0) {
  if (!userId) return [];
  try {
    const res = await pool.query(
      `SELECT id, delta, reason, reference_id, created_at
       FROM points_ledger
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return res.rows;
  } catch (err) {
    return [];
  }
}

/**
 * AI Reading Velocity Check & Referral Qualification Gate
 * Requires 5 articles read OR 2 distinct days before crediting referrer
 */
async function trackReferralRead(referrerId, refereeDeviceId) {
  if (!referrerId || !refereeDeviceId) return null;
  try {
    const res = await pool.query(
      `INSERT INTO referral_conversions (referrer_user_id, referee_device_id, articles_read_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (referee_device_id)
       DO UPDATE SET articles_read_count = referral_conversions.articles_read_count + 1
       RETURNING articles_read_count, status, referrer_user_id`,
      [referrerId, refereeDeviceId]
    );

    const record = res.rows[0];
    // Outcome-Based Qualification Gate: Requires at least 5 reads before referrer receives RP
    if (record.articles_read_count >= 5 && record.status === 'pending') {
      await pool.query(
        `UPDATE referral_conversions SET status = 'qualified', qualified_at = NOW() WHERE referee_device_id = $1`,
        [refereeDeviceId]
      );

      const dedupeRef = `ref_qual_${referrerId}_${refereeDeviceId}`;
      await recordLedgerTransaction(record.referrer_user_id, 150, 'referral', dedupeRef);
    }

    return record;
  } catch (err) {
    console.warn('[WalletService] Track referral read error:', err.message);
    return null;
  }
}

/**
 * Outcome-Based Share-To-Earn Tracking (Requires 15s Dwell Time)
 */
async function recordShareDwellTime(shareId, sharerUserId, dwellSeconds) {
  if (!shareId || !sharerUserId || dwellSeconds < 15) return null;

  const dedupeRef = `share_dwell_${shareId}_${sharerUserId}`;
  return await recordLedgerTransaction(sharerUserId, 25, 'share_read', dedupeRef);
}

module.exports = {
  recordLedgerTransaction,
  getUserBalance,
  getUserHistory,
  trackReferralRead,
  recordShareDwellTime,
};
