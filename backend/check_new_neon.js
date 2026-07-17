// READ-ONLY check of the NEW Neon DB (ep-morning-wind-assnxr5o) — does news/sports render?
const { Client } = require('pg');
const NEW_DB = 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
    const client = new Client({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('=== Connected to NEW Neon (ep-morning-wind-assnxr5o) ===\n');
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
    try {
        const a = await client.query('SELECT COUNT(*) AS c FROM rss_articles');
        console.log('rss_articles rows:', a.rows[0].c);
        const cat = await client.query('SELECT category, COUNT(*) AS c FROM rss_articles GROUP BY category ORDER BY c DESC LIMIT 15');
        console.table(cat.rows);
        const recent = await client.query("SELECT COUNT(*) AS c FROM rss_articles WHERE published_at > NOW() - INTERVAL '72 hours'");
        console.log('rss_articles in last 72h:', recent.rows[0].c);
    } catch (e) { console.log('rss_articles error:', e.message); }
    for (const t of ['live_matches', 'followed_matches', 'league_standings', 'users']) {
        try {
            const r = await client.query(`SELECT COUNT(*) AS c FROM ${t}`);
            console.log(`${t} rows:`, r.rows[0].c);
        } catch (e) { console.log(`${t}: (no such table or error: ${e.message})`); }
    }
    await client.end();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });