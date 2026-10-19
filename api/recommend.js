/**
 * Interest Engine — GET /api/recommend
 * ====================================
 * The Endless Loop generator. Given the article a reader just finished,
 * returns the stories their subconscious wants next, ranked by:
 *   • title/entity overlap with the seed article (semantic proxy, zero AI cost)
 *   • category affinity + freshness
 *   • source diversity (max 2 per publisher — feels editorial, not spammy)
 * Sub-second response, never 500s, s-maxage edge cached.
 */

const { Pool } = require('pg');

let pool = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 8000,
  });
  pool.on('error', () => {});
  return pool;
}

const STOP = new Set(
  ('the a an and or of in on for to with at by from as is are was were be been being it its this that these those ' +
   'after before over under new how why what who when whom which your you their they he she his her not no yes can ' +
   'will just more most says said say about into up down out off than then them there here where while amid versus ' +
   'reports report update latest dies dead death year years day days week weeks')
    .split(/\s+/)
);

function tokens(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

function overlap(titleA, titleB) {
  const A = new Set(tokens(titleA));
  if (!A.size) return 0;
  let n = 0;
  for (const w of new Set(tokens(titleB))) if (A.has(w)) n++;
  return n;
}

const SELECT_COLS = 'id, title, original_excerpt, image, category, source_name, published_at, external_link, is_featured';

function shape(row, heat) {
  return {
    id: `rss-${row.id}`,
    dbId: row.id,
    title: row.title,
    excerpt: row.original_excerpt || '',
    image: row.image || '',
    category: row.category || 'news',
    readTime: '4 min read',
    date: row.published_at,
    author: row.source_name || 'RealSSA News',
    source: row.source_name || '',
    externalLink: row.external_link || '',
    heat,
  };
}

// __RECOMMEND_PART2__
