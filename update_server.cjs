const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'backend', 'server.js');
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Update trending algorithm
const oldOrder = `      // Build ORDER BY: preferred categories first, then by recency
      let orderBy = 'published_at DESC';
      if (preferred.length > 0) {
        const caseStr = preferred.map((cat, i) => \`WHEN LOWER(category) = '\${cat.replace(/'/g, "''")}' THEN \${i}\`).join(' ');
        orderBy = \`CASE \${caseStr} ELSE \${preferred.length} END, published_at DESC\`;
      }`;

const newOrder = `      // Build ORDER BY: Gravity Algorithm (Views + Saves + Reactions vs Time Decay)
      let gravityCalc = \`((COALESCE(view_count,0) + (COALESCE(save_count,0) * 5) + (COALESCE(reaction_count,0) * 2) + 1.0) / POWER(EXTRACT(EPOCH FROM (NOW() - published_at))/3600.0 + 2.0, 1.8))\`;
      
      let orderBy = \`\${gravityCalc} DESC, published_at DESC\`;
      if (preferred.length > 0) {
        const caseStr = preferred.map((cat, i) => \`WHEN LOWER(category) = '\${cat.replace(/'/g, "''")}' THEN \${i}\`).join(' ');
        orderBy = \`CASE \${caseStr} ELSE \${preferred.length} END, \${gravityCalc} DESC, published_at DESC\`;
      }`;
      
content = content.replace(oldOrder, newOrder);

const oldSubquery1 = `                   '5 min read' AS read_time,
                   ROW_NUMBER() OVER (PARTITION BY source_name ORDER BY published_at DESC) AS rn`;
const newSubquery1 = `                   '5 min read' AS read_time,
                   view_count, save_count, reaction_count, published_at,
                   ROW_NUMBER() OVER (PARTITION BY source_name ORDER BY published_at DESC) AS rn`;
content = content.replace(oldSubquery1, newSubquery1);

const oldSubquery2 = `                 '5 min read' AS read_time
          FROM rss_articles`;
const newSubquery2 = `                 '5 min read' AS read_time,
                 view_count, save_count, reaction_count, published_at
          FROM rss_articles`;
content = content.replace(oldSubquery2, newSubquery2);

// 2. Add tracking endpoint
const trackingEndpoint = `// Increment view/dwell tracking for an article
app.post('/api/articles/:id/view', async (req, res) => {
  try {
    const rawId = req.params.id;
    const dbId = rawId.startsWith('rss-') ? rawId.replace('rss-', '') : rawId;
    if (process.env.DATABASE_URL) {
      await pool.query(
        'UPDATE rss_articles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1',
        [dbId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update view count' });
  }
});

app.get('/api/articles/:id',`;
content = content.replace("app.get('/api/articles/:id',", trackingEndpoint);

// 3. Add table migration
const oldInit = `    CREATE INDEX IF NOT EXISTS idx_rss_articles_cat_pub 
    ON rss_articles (category, published_at DESC)
  \`).catch(e => console.warn('Composite index creation failed:', e.message));
}`;

const newInit = `    CREATE INDEX IF NOT EXISTS idx_rss_articles_cat_pub 
    ON rss_articles (category, published_at DESC)
  \`).catch(e => console.warn('Composite index creation failed:', e.message));

  // Add engagement columns if they don't exist
  pool.query(\`
    ALTER TABLE rss_articles 
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
  \`).catch(e => console.warn('Engagement columns creation failed:', e.message));
}`;
content = content.replace(oldInit, newInit);

fs.writeFileSync(serverFile, content);
console.log('Successfully updated server.js!');
