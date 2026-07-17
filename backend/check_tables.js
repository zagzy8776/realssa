const { Pool } = require('pg');

async function check() {
    const pool = new Pool({
        connectionString: 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        ssl: { rejectUnauthorized: false }
    });

    try {
        const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log('✅ Connected to NEW Neon DB');
        console.log('TABLES:');
        r.rows.forEach(t => console.log('  -', t.table_name));

        // Check rss_articles with different casing/quoting
        console.log('\nTrying different queries...');
        try {
            const r2 = await pool.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)', ['rss_articles']);
            console.log('rss_articles exists:', r2.rows[0].exists);
        } catch (e) {
            console.log('rss_articles query error:', e.message);
        }

        // Try listing all sequences/views
        const r3 = await pool.query("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('\nAll tables with types:');
        r3.rows.forEach(t => console.log(`  ${t.table_type}: ${t.table_name}`));

    } catch (e) {
        console.log('ERROR:', e.message);
    }

    await pool.end();
}
check();