const { Pool } = require('pg');

async function check() {
    // Supabase database
    const pool = new Pool({
        connectionString: 'postgresql://postgres:EkcwPYnMV6ev5kGG@db.uuysjtxxewqchejkllhs.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Checking Supabase database...');
        const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log('TABLES in Supabase:');
        if (r.rows.length === 0) console.log('  (none)');
        r.rows.forEach(t => console.log('  -', t.table_name));

        // Check rss_articles
        try {
            const ex = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rss_articles')");
            console.log('\nrss_articles exists:', ex.rows[0].exists);
            if (ex.rows[0].exists) {
                const c = await pool.query('SELECT COUNT(*) as c FROM rss_articles');
                console.log('Total articles:', c.rows[0].c);

                const cats = await pool.query('SELECT category, COUNT(*) as count FROM rss_articles GROUP BY category ORDER BY count DESC');
                console.log('\nBy category:');
                cats.rows.forEach(r => console.log('  ', r.category.padEnd(22), String(r.count).padStart(5)));
            }
        } catch (e) {
            console.log('Error querying rss_articles:', e.message);
        }

    } catch (e) {
        console.log('ERROR connecting to Supabase:', e.message);
    }
    await pool.end();
}
check();