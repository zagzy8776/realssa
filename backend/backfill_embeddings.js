const { Client } = require('pg');
const { generateEmbedding } = require('./services/summariser');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Error: DATABASE_URL is not set.');
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function backfill() {
  console.log('🔄 Starting backfill of embeddings...');
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Fetch articles from the last 14 days that lack embeddings
    console.log('Fetching active articles without embeddings...');
    const result = await client.query(`
      SELECT id, title, ai_summary, original_excerpt 
      FROM rss_articles 
      WHERE (has_embedding = false OR has_embedding IS NULL) 
      AND content_type = 'article'
      AND published_at > NOW() - INTERVAL '14 days'
      ORDER BY published_at DESC
    `);

    const articles = result.rows;
    console.log(`Found ${articles.length} articles needing embeddings.`);

    let successCount = 0;
    const { upsertArticleVector } = require('./services/qdrantService');

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      const textToEmbed = art.ai_summary || art.original_excerpt || art.title;

      if (!textToEmbed) {
        console.log(`[${i+1}/${articles.length}] Skipping article ${art.id} (no summary or excerpt)`);
        continue;
      }

      console.log(`[${i+1}/${articles.length}] Generating embedding for article ${art.id}: "${art.title.slice(0, 50)}..."`);
      
      try {
        const vector = await generateEmbedding(textToEmbed);
        
        if (vector && vector.length === 768) {
          // Upsert vector to Qdrant Cloud
          const qdrantSuccess = await upsertArticleVector(art.id, vector);
          
          if (qdrantSuccess) {
            await client.query(
              'UPDATE rss_articles SET has_embedding = true WHERE id = $1',
              [art.id]
            );
            successCount++;
            console.log(`  ✅ Embedding saved in Qdrant for article ${art.id}`);
          } else {
            console.error(`  ❌ Failed to save vector to Qdrant for article ${art.id}`);
          }
        } else {
          console.error(`  ❌ Failed to generate valid embedding for article ${art.id}`);
        }
      } catch (err) {
        console.error(`  ❌ Error processing article ${art.id}:`, err.message);
      }

      // Rate limit safety: sleep 4.5 seconds between requests (caps at 13 requests per minute)
      if (i < articles.length - 1) {
        await sleep(4500);
      }
    }

    console.log(`\n🎉 Backfill complete. Successfully embedded ${successCount}/${articles.length} articles in Qdrant.`);

  } catch (err) {
    console.error('Backfill job error:', err.message);
  } finally {
    await client.end();
  }
}

backfill();
