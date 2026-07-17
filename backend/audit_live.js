/**
 * Live Database Audit — queries BOTH Neon databases directly
 * Run: node backend/audit_live.js
 */
const { Pool } = require('pg');

async function runAudit() {
    // ── DATABASE CONFIG (Scrubbed hardcoded passwords to prevent credential leaks) ──
    const newDbUrl = process.env.DATABASE_URL;
    const oldDbUrl = process.env.OLD_DATABASE_URL;

    if (!newDbUrl) {
        console.error('❌ Error: DATABASE_URL environment variable is required to run the audit.');
        console.log('Usage: DATABASE_URL="postgresql://..." [OLD_DATABASE_URL="postgresql://..."] node backend/audit_live.js');
        return;
    }

    const newPool = new Pool({
        connectionString: newDbUrl,
        ssl: { rejectUnauthorized: false }
    });

    const oldPool = oldDbUrl ? new Pool({
        connectionString: oldDbUrl,
        ssl: { rejectUnauthorized: false }
    }) : null;

    const hr = '='.repeat(80);

    try {
        // ─── NEW DB CONNECTION TEST ───
        const now = await newPool.query('SELECT NOW()');
        console.log('\n' + hr);
        console.log('📊 REALSSA NEWS — LIVE DATABASE AUDIT');
        console.log('   New Neon DB  |', now.rows[0].now);
        console.log('   Old Neon DB  | ep-curly-art (ap-southeast-1)');
        console.log(hr);

        // ─── 1. ARTICLES BY CATEGORY (NEW DB) ───
        const cats = await newPool.query(`
            SELECT category, COUNT(*) as count,
                   MIN(published_at) as oldest,
                   MAX(published_at) as newest,
                   SUM(CASE WHEN view_count > 0 THEN 1 ELSE 0 END) as with_views,
                   COALESCE(SUM(view_count), 0) as total_views
            FROM rss_articles
            GROUP BY category
            ORDER BY count DESC
        `);
        console.log('\n📰 ARTICLES IN NEW DB (by category)');
        console.log('  ' + '-'.repeat(90));
        console.log('  CATEGORY                 COUNT   VIEWS   DATE RANGE');
        console.log('  ' + '-'.repeat(90));
        let totalA = 0, totalV = 0;
        cats.rows.forEach(r => {
            totalA += parseInt(r.count);
            totalV += parseInt(r.total_views);
            const range = r.oldest && r.newest
                ? new Date(r.oldest).toISOString().slice(0, 10) + ' → ' + new Date(r.newest).toISOString().slice(0, 10)
                : 'N/A';
            console.log(`  ${(r.category || 'null').padEnd(24)} ${String(r.count).padStart(6)}  ${String(r.total_views).padStart(5)}  ${range}`);
        });
        console.log('  ' + '-'.repeat(90));
        console.log(`  TOTAL                   ${String(totalA).padStart(6)}  ${String(totalV).padStart(5)}`);
        console.log(`  Database size:          ${(await newPool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as s")).rows[0].s}`);

        // ─── 2. IMAGE QUALITY ───
        const img = (await newPool.query(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN image IS NULL OR image = '' THEN 1 ELSE 0 END) as no_img,
                   SUM(CASE WHEN image ~* '(logo|icon|brand|placeholder|avatar|favicon|punchng)' THEN 1 ELSE 0 END) as logo,
                   SUM(CASE WHEN image IS NOT NULL AND image != '' AND image !~* '(logo|icon|brand|placeholder|avatar|favicon|punchng)' THEN 1 ELSE 0 END) as good
            FROM rss_articles
        `)).rows[0];
        console.log(`\n🖼️  IMAGE QUALITY:  ${img.total} total  |  Good: ${img.good} (${((img.good / img.total) * 100).toFixed(1)}%)  |  Logo: ${img.logo} (${((img.logo / img.total) * 100).toFixed(1)}%)  |  No img: ${img.no_img} (${((img.no_img / img.total) * 100).toFixed(1)}%)`);

        // ─── 3. AI SUMMARY COVERAGE ───
        const summ = (await newPool.query(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN ai_summary IS NOT NULL THEN 1 ELSE 0 END) as done
            FROM rss_articles WHERE content_type = 'article'
        `)).rows[0];
        const pct = summ.total > 0 ? ((summ.done / summ.total) * 100).toFixed(1) : '0';
        console.log(`\n🤖 AI SUMMARIES:  ${summ.total} articles eligible  |  ${summ.done} have summaries (${pct}%)`);

        // ─── 4. TOP VIEWED ───
        const top = (await newPool.query('SELECT title, category, source_name, view_count FROM rss_articles WHERE view_count > 0 ORDER BY view_count DESC LIMIT 10')).rows;
        console.log(`\n🔥 TOP 10 MOST VIEWED:`);
        if (top.length > 0) {
            top.forEach((r, i) => console.log(`   ${i + 1}. [${r.category}] "${r.title.slice(0, 55)}" — ${r.view_count} views`));
        } else {
            console.log('   No view data recorded yet.');
        }

        // ─── 5. ALL TABLES ───
        console.log(`\n🗄️  ALL TABLES IN NEW DB:`);
        const tables = (await newPool.query(`
            SELECT table_name, (SELECT reltuples::bigint FROM pg_class WHERE oid = (quote_ident(table_name))::regclass) as est_rows
            FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
        `)).rows;
        tables.forEach(r => console.log(`   ${r.table_name.padEnd(28)} ~${r.est_rows || 0} rows`));

        // ─── 6. FEED HEALTH ───
        try {
            const h = (await newPool.query(`
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN is_healthy THEN 1 ELSE 0 END) as healthy,
                       SUM(CASE WHEN NOT is_healthy THEN 1 ELSE 0 END) as failing
                FROM rss_feed_health_log
            `)).rows[0];
            console.log(`\n🔍 FEED HEALTH:  ${h.total} checks  |  ✅ ${h.healthy} healthy  |  ❌ ${h.failing} failing`);
            if (parseInt(h.failing) > 0) {
                const fails = (await newPool.query('SELECT feed_url, status_code, error_message FROM rss_feed_health_log WHERE NOT is_healthy ORDER BY checked_at DESC LIMIT 10')).rows;
                fails.forEach(r => console.log(`   ❌ ${r.feed_url.slice(0, 55)} — ${r.status_code} ${(r.error_message || '').slice(0, 35)}`));
            }
        } catch (e) { console.log(`\n🔍 FEED HEALTH: table not found or error`); }

    } catch (err) {
        console.error('\n❌ NEW DB ERROR:', err.message);
    }

    // ─── OLD DB CHECK ───
    console.log(`\n${hr}`);
    console.log('📦 OLD DATABASE CHECK (pre-migration)');
    console.log(hr);

    if (!oldPool) {
        console.log('   (Skipped: OLD_DATABASE_URL environment variable not provided)');
    } else {
        try {
            const oldNow = await oldPool.query('SELECT NOW()');
            console.log('   Connected:', oldNow.rows[0].now);

            const oldTotal = (await oldPool.query('SELECT COUNT(*) as c FROM rss_articles')).rows[0].c;
            console.log(`   Total articles: ${oldTotal}`);

            const oldCats = (await oldPool.query('SELECT category, COUNT(*) as count FROM rss_articles GROUP BY category ORDER BY count DESC')).rows;
            oldCats.forEach(r => console.log(`   ${(r.category || 'null').padEnd(22)} ${String(r.count).padStart(5)}`));

            // Find migration gaps
            console.log('\n   ⚠️  MIGRATION GAP CHECK (categories where old has more than new):');
            for (const oc of oldCats) {
                const nc = (await newPool.query('SELECT COUNT(*) as c FROM rss_articles WHERE category = $1', [oc.category])).rows[0].c;
                const diff = parseInt(oc.count) - parseInt(nc);
                if (diff > 0) {
                    console.log(`   ⚠️  ${oc.category}: old=${oc.count} new=${nc} GAP=${diff}`);
                }
            }

            const oldTables = (await oldPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")).rows;
            console.log(`\n   Tables with data in old DB:`);
            for (const t of oldTables) {
                const c = (await oldPool.query(`SELECT COUNT(*) as c FROM ${t.table_name}`)).rows[0].c;
                console.log(`   ${t.table_name.padEnd(28)} ${String(c).padStart(6)} rows`);
            }

            await oldPool.end();
        } catch (err) {
            console.error('\n❌ OLD DB ERROR:', err.message);
            console.log('   (Old DB is likely fully decommissioned)');
        }
    }

    await newPool.end();
    console.log(`\n${hr}`);
    console.log('✅ Audit complete');
    console.log(hr + '\n');
}

runAudit().catch(console.error);