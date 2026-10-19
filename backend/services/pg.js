/**
 * Thin Postgres helper for the Empire of Attention services.
 *
 * The new schema (db_schema_empire_of_attention.sql) lives in the primary
 * Neon/Postgres DB alongside rss_articles. This wrapper centralizes pool
 * access + fail-soft error handling so services never crash when the DB is
 * unconfigured or a table/column does not exist yet.
 *
 *   pgSelect(sql, params) -> rows[]      (throws on real SQL errors)
 *   pgRun(sql, params)    -> {changes}   (throws on real SQL errors)
 */

const { queryMultiDb } = require('../config/multiDb');

function isConfigured() {
  return typeof queryMultiDb === 'function';
}

async function pgSelect(sql, params = []) {
  if (!isConfigured()) return [];
  const res = await queryMultiDb(sql, params);
  return (res && res.rows) || [];
}

async function pgRun(sql, params = []) {
  if (!isConfigured()) return { changes: 0 };
  const res = await queryMultiDb(sql, params);
  return { changes: res ? res.rowCount || 0 : 0 };
}

module.exports = { pgSelect, pgRun, isConfigured };