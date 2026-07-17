/**
 * seed_competitions.js
 * Run once to populate the `competitions` table with all Soccerway targets.
 * node backend/seed_competitions.js
 */
const { Pool } = require('pg');
// Use the production Neon DB directly (hardcoded for seeding)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Priority tiers:
//   1 = African leagues (highest priority for Nigerian audience)
//   2 = Major global leagues/cups
//   3 = Supplementary leagues

const COMPETITIONS = [
  // ── AFRICA (Tier 1) ───────────────────────────────────────────
  {
    slug: 'npfl', name: '🇳🇬 NPFL', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/nigeria/premier-league/'
  },
  {
    slug: 'caf-champions-league', name: '🏆 CAF Champions League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/international/africa/caf-champions-league/'
  },
  {
    slug: 'caf-confederation-cup', name: '🏆 CAF Confederation Cup', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/international/africa/caf-confederation-cup/'
  },
  {
    slug: 'afcon', name: '🌍 AFCON', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/international/africa/african-cup-of-nations/2025/'
  },
  {
    slug: 'egypt-premier', name: '🇪🇬 Egyptian Premier League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/egypt/premier-league/'
  },
  {
    slug: 'south-africa-psl', name: '🇿🇦 South African PSL', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/south-africa/premier-soccer-league/'
  },
  {
    slug: 'ghana-premier', name: '🇬🇭 Ghana Premier League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/ghana/premier-league/'
  },
  {
    slug: 'kenya-premier', name: '🇰🇪 Kenya Premier League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/kenya/kenyan-premier-league/'
  },
  {
    slug: 'tanzania-premier', name: '🇹🇿 Tanzania Premier League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/tanzania/premier-league/'
  },
  {
    slug: 'senegal-premier', name: '🇸🇳 Senegal Premier League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/senegal/premier-league/'
  },
  {
    slug: 'cameroon-premier', name: '🇨🇲 Cameroon Elite One', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/cameroon/elite-one/'
  },
  {
    slug: 'cote-divoire-premier', name: '🇨🇮 Côte d\'Ivoire MTN Ligue 1', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/ivory-coast/ligue-1/'
  },
  {
    slug: 'morocco-premier', name: '🇲🇦 Morocco Botola Pro', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/morocco/botola-pro/'
  },
  {
    slug: 'algeria-ligue1', name: '🇩🇿 Algeria Ligue Professionnelle 1', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/algeria/ligue-professionnelle-1/'
  },
  {
    slug: 'tunisia-ligue1', name: '🇹🇳 Tunisia Ligue 1', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/tunisia/ligue-1/'
  },
  {
    slug: 'uganda-premier', name: '🇺🇬 Uganda Premier League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/uganda/premier-league/'
  },
  {
    slug: 'zambia-super', name: '🇿🇲 Zambia Super League', tier: 1, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/zambia/super-league/'
  },

  // ── EUROPE (Tier 2 - supplements football-data.org) ──────────
  {
    slug: 'efl-championship', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 EFL Championship', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/england/championship/'
  },
  {
    slug: 'efl-league-one', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 EFL League One', tier: 2, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/england/league-one/'
  },
  {
    slug: 'fa-cup', name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 FA Cup', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/england/fa-challenge-cup/'
  },
  {
    slug: 'europa-league', name: '🌍 UEFA Europa League', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/international/europe/europa-league/'
  },
  {
    slug: 'conference-league', name: '🌍 UEFA Conference League', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/international/europe/uefa-europa-conference-league/'
  },
  {
    slug: 'scottish-premier', name: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Premiership', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/scotland/premier-league/'
  },
  {
    slug: 'turkish-super', name: '🇹🇷 Turkish Süper Lig', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/turkey/super-lig/'
  },
  {
    slug: 'greek-super', name: '🇬🇷 Greek Super League', tier: 2, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/greece/super-league/'
  },
  {
    slug: 'belgian-pro', name: '🇧🇪 Belgian Pro League', tier: 2, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/belgium/pro-league/'
  },
  {
    slug: 'swiss-super', name: '🇨🇭 Swiss Super League', tier: 2, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/switzerland/super-league/'
  },

  // ── MIDDLE EAST (Tier 2) ─────────────────────────────────────
  {
    slug: 'saudi-pro', name: '🇸🇦 Saudi Pro League', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/saudi-arabia/saudi-professional-league/'
  },
  {
    slug: 'uae-pro', name: '🇦🇪 UAE Pro League', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/united-arab-emirates/uae-pro-league/'
  },

  // ── AMERICAS (Tier 2) ─────────────────────────────────────────
  {
    slug: 'mls', name: '🇺🇸 MLS', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/usa/mls/'
  },
  {
    slug: 'liga-mx', name: '🇲🇽 Liga MX', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/mexico/liga-mx-clausura/'
  },
  {
    slug: 'argentina-primera', name: '🇦🇷 Argentina Primera División', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/argentina/primera-division/'
  },
  {
    slug: 'colombia-primera', name: '🇨🇴 Colombia Primera A', tier: 3, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/colombia/primera-a/'
  },

  // ── ASIA (Tier 2) ─────────────────────────────────────────────
  {
    slug: 'j-league', name: '🇯🇵 J1 League', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/japan/j1-league/'
  },
  {
    slug: 'k-league', name: '🇰🇷 K League 1', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/national/south-korea/k-league-1/'
  },
  {
    slug: 'indian-superleague', name: '🇮🇳 Indian Super League', tier: 3, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/india/super-league/'
  },
  {
    slug: 'chinese-super', name: '🇨🇳 Chinese Super League', tier: 3, is_active: false,
    scrape_url: 'https://uk.soccerway.com/national/china/super-league/'
  },
  {
    slug: 'afc-champions', name: '🌏 AFC Champions League', tier: 2, is_active: true,
    scrape_url: 'https://uk.soccerway.com/international/asia/afc-champions-league/'
  },
];

async function seed() {
  // Ensure the competitions table has the right structure
  await pool.query(`
    CREATE TABLE IF NOT EXISTS competitions (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tier INTEGER DEFAULT 2,
      is_active BOOLEAN DEFAULT true,
      scrape_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ competitions table ready');

  let added = 0, updated = 0;
  for (const comp of COMPETITIONS) {
    const res = await pool.query(`
      INSERT INTO competitions (slug, name, tier, is_active, scrape_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        tier = EXCLUDED.tier,
        is_active = EXCLUDED.is_active,
        scrape_url = EXCLUDED.scrape_url
      RETURNING (xmax = 0) AS inserted
    `, [comp.slug, comp.name, comp.tier, comp.is_active, comp.scrape_url]);

    if (res.rows[0].inserted) { added++; console.log(`  ✅ Added: ${comp.name}`); }
    else { updated++; console.log(`  🔄 Updated: ${comp.name}`); }
  }

  console.log(`\n✅ Seeding complete: ${added} added, ${updated} updated`);
  console.log(`📊 Total active competitions: ${COMPETITIONS.filter(c => c.is_active).length}`);
  await pool.end();
}

seed().catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); });
