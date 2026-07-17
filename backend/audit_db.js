/**
 * Database Audit Script
 * Run this on Fly.io to get REAL numbers from the live database.
 * Usage: node audit_db.js
 *
 * Requires DATABASE_URL environment variable to be set.
 */

const { Pool } = require('pg');

async function runAudit() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
    });

    console.log('\n' + '='.repeat(80));
    console.log('📊 REALSSA NEWS — LIVE DATABASE AUDIT');
    console.log('='.repeat(80));

    try {
        // Test connection
        const connTest = await pool.query('SELECT NOW() as time');
        console.log(`\n✅ Database connected: ${connTest.rows[0].time}`);
    } catch (err) {
        console.error(`\n❌ Database connection failed: ${err.message}`);
        console.log('   Ensure DATABASE_URL environment variable is set.\n');
        process.exit(1);
    }

    // ── 1. TOTAL ARTICLES ───────────────────────────────────────────────
    console.log('\n─── 1. TOTAL ARTICLES IN DATABASE ───');
    const totalRes = await pool.query('SELECT COUNT(*) FROM rss_articles');
    console.log(`   Total articles: ${totalRes.rows[0].count}`);

    // ── 2. ARTICLES BY CATEGORY ─────────────────────────────────────────
    console.log('\n─── 2. ARTICLES BY CATEGORY ───');
    const catRes = await pool.query(`
        SELECT category, COUNT(*) as count,
               MIN(published_at) as oldest,
               MAX(published_at) as newest
        FROM rss_articles
        GROUP BY category
        ORDER BY count DESC
    `);
    let totalArticles = 0;
    const catTable = [];
    catRes.rows.forEach(r => {
        totalArticles += parseInt(r.count);
        const oldest = r.oldest ? new Date(r.oldest).toLocaleDateString() : 'N/A';
        const newest = r.newest ? new Date(r.newest).toLocaleDateString() : 'N/A';
        catTable.push({
            category: r.category,
            count: parseInt(r.count),
            oldest,
            newest
        });
        console.log(`   ${(r.category || 'null').padEnd(25)} ${String(r.count).padStart(6)} articles  (${oldest} → ${newest})`);
    });
    console.log(`   ${'─'.repeat(50)}`);
    console.log(`   ${'TOTAL'.padEnd(25)} ${String(totalArticles).padStart(6)} articles`);

    // ── 3. ARTICLES WITH IMAGES ─────────────────────────────────────────
    console.log('\n─── 3. IMAGE QUALITY ───');
    const imgRes = await pool.query(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN image IS NULL OR image = '' THEN 1 ELSE 0 END) as no_image,
            SUM(CASE WHEN image ~* '(logo|icon|brand|placeholder|avatar|favicon|punchng)' THEN 1 ELSE 0 END) as logo_image,
            SUM(CASE WHEN image IS NOT NULL AND image != ''
                      AND image !~* '(logo|icon|brand|placeholder|avatar|favicon|punchng)' THEN 1 ELSE 0 END) as good_image
        FROM rss_articles
    `);
    const img = imgRes.rows[0];
    console.log(`   Total articles:         ${String(img.total).padStart(6)}`);
    console.log(`   With good images:       ${String(img.good_image).padStart(6)} (${((parseInt(img.good_image) / parseInt(img.total)) * 100).toFixed(1)}%)`);
    console.log(`   With logo/placeholder:  ${String(img.logo_image).padStart(6)} (${((parseInt(img.logo_image) / parseInt(img.total)) * 100).toFixed(1)}%)`);
    console.log(`   Without image:          ${String(img.no_image).padStart(6)} (${((parseInt(img.no_image) / parseInt(img.total)) * 100).toFixed(1)}%)`);

    // ── 4. ARTICLES WITH AI SUMMARIES ───────────────────────────────────
    console.log('\n─── 4. AI SUMMARY COVERAGE ───');
    const summaryRes = await pool.query(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN ai_summary IS NOT NULL THEN 1 ELSE 0 END) as has_summary
        FROM rss_articles
        WHERE content_type = 'article'
    `);
    const s = summaryRes.rows[0];
    const summaryPct = parseInt(s.total) > 0 ? ((parseInt(s.has_summary) / parseInt(s.total)) * 100).toFixed(1) : '0.0';
    console.log(`   Articles needing summaries: ${String(s.total).padStart(6)}`);
    console.log(`   With AI summaries:          ${String(s.has_summary).padStart(6)} (${summaryPct}%)`);

    // ── 5. MOST VIEWED ARTICLES ─────────────────────────────────────────
    console.log('\n─── 5. TOP 10 MOST VIEWED ARTICLES ───');
    const viewsRes = await pool.query(`
        SELECT title, category, source_name, view_count, published_at
        FROM rss_articles
        WHERE view_count IS NOT NULL AND view_count > 0
        ORDER BY view_count DESC
        LIMIT 10
    `);
    if (viewsRes.rows.length > 0) {
        viewsRes.rows.forEach((r, i) => {
            console.log(`   ${i + 1}. "${r.title.slice(0, 60)}" — ${r.view_count} views [${r.category}]`);
        });
    } else {
        console.log(`   No view data recorded yet.`);
    }

    // ── 6. FEED HEALTH ──────────────────────────────────────────────────
    console.log('\n─── 6. FEED HEALTH LOG ───');
    const healthRes = await pool.query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN is_healthy = true THEN 1 ELSE 0 END) as healthy,
               SUM(CASE WHEN is_healthy = false THEN 1 ELSE 0 END) as failing
        FROM rss_feed_health_log
    `);
    const h = healthRes.rows[0];
    console.log(`   Total health checks logged: ${h.total}`);
    console.log(`   Healthy feeds:              ${h.healthy}`);
    console.log(`   Failing feeds:              ${h.failing}`);

    if (parseInt(h.failing) > 0) {
        const failingRes = await pool.query(`
            SELECT feed_url, status_code, error_message, checked_at
            FROM rss_feed_health_log
            WHERE is_healthy = false
            ORDER BY checked_at DESC
            LIMIT 20
        `);
        console.log(`\n   Recent failing feeds:`);
        failingRes.rows.forEach(r => {
            console.log(`   ❌ ${r.feed_url.slice(0, 70)} — ${r.status_code} (${(r.error_message || '').slice(0, 50)})`);
        });
    }

    // ── 7. USER ENGAGEMENT ──────────────────────────────────────────────
    console.log('\n─── 7. USER ENGAGEMENT ───');
    const userTables = ['user_category_affinities', 'user_interactions', 'user_subscriptions', 'notified_articles'];
    for (const table of userTables) {
        try {
            const exists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables WHERE table_name = $1
                )`, [table]);
            if (exists.rows[0].exists) {
                const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`   ${table.padEnd(30)} ${String(countRes.rows[0].count).padStart(6)} rows`);
            } else {
                console.log(`   ${table.padEnd(30)} ${'TABLE NOT FOUND'.padStart(6)}`);
            }
        } catch (e) {
            console.log(`   ${table.padEnd(30)} ${'ERROR: ' + e.message.slice(0, 30)}`);
        }
    }

    // ── 8. SPORTS DATA ─────────────────────────────────────────────────
    console.log('\n─── 8. SPORTS HUB ───');
    try {
        const matchRes = await pool.query(`
            SELECT status, COUNT(*) as count FROM matches GROUP BY status
        `);
        matchRes.rows.forEach(r => {
            console.log(`   ${(r.status || 'unknown').padEnd(15)} ${String(r.count).padStart(4)} matches`);
        });
    } catch (e) {
        console.log(`   Matches table: ${e.message}`);
    }

    try {
        const followedRes = await pool.query('SELECT COUNT(*) FROM followed_matches');
        console.log(`   Followed matches: ${followedRes.rows[0].count}`);
    } catch (e) {
        console.log(`   Followed matches: ${e.message}`);
    }

    // ── 9. FEED SCHEDULE ────────────────────────────────────────────────
    console.log('\n─── 9. FEED SCHEDULE (Rotation Engine) ───');
    try {
        const schedRes = await pool.query(`
            SELECT category, tier, last_ingested_at
            FROM feed_schedule
            ORDER BY tier, last_ingested_at DESC NULLS LAST
        `);
        schedRes.rows.forEach(r => {
            const tier = r.tier === 1 ? 'Main' : 'World';
            const last = r.last_ingested_at ? new Date(r.last_ingested_at).toISOString().slice(0, 19) : 'NEVER';
            console.log(`   [${tier}] ${r.category.padEnd(25)} last ingested: ${last}`);
        });
    } catch (e) {
        console.log(`   feed_schedule: ${e.message}`);
    }

    // ── 10. AI EDITOR PICKS ─────────────────────────────────────────────
    console.log('\n─── 10. AI EDITOR PICKS ───');
    try {
        const picksRes = await pool.query(`
            SELECT COUNT(*) as count, MAX(selected_at) as latest
            FROM ai_editor_picks
        `);
        console.log(`   Total AI editorial picks cached: ${picksRes.rows[0].count}`);
        console.log(`   Latest picks at: ${picksRes.rows[0].latest ? new Date(picksRes.rows[0].latest).toISOString() : 'NONE'}`);
    } catch (e) {
        console.log(`   ai_editor_picks table: ${e.message}`);
    }

    // ── 11. DATABASE SIZE ───────────────────────────────────────────────
    console.log('\n─── 11. DATABASE SIZE ───');
    const sizeRes = await pool.query(`
        SELECT
            pg_size_pretty(pg_database_size(current_database())) as db_size,
            pg_size_pretty(SUM(pg_total_relation_size(quote_ident(table_name)))) as total_table_size
        FROM information_schema.tables
        WHERE table_schema = 'public'
    `);
    console.log(`   Database size:         ${sizeRes.rows[0].db_size}`);
    console.log(`   Total table data size: ${sizeRes.rows[0].total_table_size}`);

    // ── 12. TABLE LIST ──────────────────────────────────────────────────
    console.log('\n─── 12. ALL TABLES ───');
    const tablesRes = await pool.query(`
        SELECT table_name,
               (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as cols,
               (SELECT reltuples::bigint FROM pg_class WHERE oid = (quote_ident(table_name))::regclass) as est_rows
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);
    tablesRes.rows.forEach(r => {
        console.log(`   ${r.table_name.padEnd(30)} ${String(r.cols).padStart(3)} cols, ~${r.est_rows || 0} rows`);
    });

    await pool.end();
    console.log('\n' + '='.repeat(80));
    console.log('✅ Audit complete');
    console.log('='.repeat(80) + '\n');
}

runAudit().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});