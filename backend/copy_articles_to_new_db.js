const { Client } = require('pg');

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.TARGET_DATABASE_URL;
const TABLE_NAME = process.env.TABLE_NAME || 'rss_articles';
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);

if (!SOURCE_DATABASE_URL || !TARGET_DATABASE_URL) {
  console.error('Missing required env vars. Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL before running.');
  process.exit(1);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) as exists`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function ensureTargetTableMatchesSource(sourceClient, targetClient, tableName) {
  const exists = await tableExists(targetClient, tableName);
  if (exists) {
    console.log(`[setup] Target table "${tableName}" already exists.`);
    return;
  }

  const createSql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      url_hash VARCHAR(64) UNIQUE NOT NULL,
      title TEXT NOT NULL,
      original_excerpt TEXT,
      ai_summary TEXT,
      category VARCHAR(100),
      image TEXT,
      image_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      image_checked_at TIMESTAMPTZ,
      image_width INTEGER,
      image_height INTEGER,
      author VARCHAR(200),
      source_name VARCHAR(200),
      external_link TEXT,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      content_type VARCHAR(50) DEFAULT 'article',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      view_count INTEGER DEFAULT 0,
      reaction_count INTEGER DEFAULT 0,
      needs_summary BOOLEAN DEFAULT FALSE,
      needs_image BOOLEAN DEFAULT FALSE,
      summary_status VARCHAR(30) DEFAULT 'pending',
      image_source VARCHAR(100),
      updated_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_${tableName}_url_hash ON ${tableName}(url_hash);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_category ON ${tableName}(category);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_published ON ${tableName}(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_content_type ON ${tableName}(content_type);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_views ON ${tableName}(view_count DESC);
  `;

  console.log('[setup] Creating target table to match the known rss_articles schema...');
  await targetClient.query(createSql);
}

function formatValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function getColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return result.rows.map(r => r.column_name);
}

async function copyTable(sourceClient, targetClient, tableName) {
  const sourceColumns = await getColumns(sourceClient, tableName);
  const targetColumns = await getColumns(targetClient, tableName);
  const commonColumns = sourceColumns.filter(col => targetColumns.includes(col));

  if (!commonColumns.length) {
    throw new Error(`No matching columns between source and target for "${tableName}".`);
  }

  const selectSql = `SELECT ${commonColumns.map(c => `"${c}"`).join(', ')} FROM ${tableName} ORDER BY id ASC`;
  const sourceResult = await sourceClient.query(selectSql);
  console.log(`[copy] Found ${sourceResult.rows.length} rows in ${tableName}`);

  if (!sourceResult.rows.length) {
    console.log(`[copy] No rows to copy for ${tableName}.`);
    return { copied: 0, table: tableName };
  }

  const columnsSql = commonColumns.map(c => `"${c}"`).join(', ');
  const placeholders = commonColumns.map((_, idx) => `$${idx + 1}`).join(', ');

  const insertSql = `
    INSERT INTO ${tableName} (${columnsSql})
    VALUES (${placeholders})
    ON CONFLICT (url_hash)
    DO UPDATE SET
      title = EXCLUDED.title,
      original_excerpt = EXCLUDED.original_excerpt,
      ai_summary = EXCLUDED.ai_summary,
      category = EXCLUDED.category,
      image = EXCLUDED.image,
      image_status = EXCLUDED.image_status,
      image_checked_at = EXCLUDED.image_checked_at,
      image_width = EXCLUDED.image_width,
      image_height = EXCLUDED.image_height,
      author = EXCLUDED.author,
      source_name = EXCLUDED.source_name,
      external_link = EXCLUDED.external_link,
      published_at = EXCLUDED.published_at,
      content_type = EXCLUDED.content_type,
      created_at = EXCLUDED.created_at,
      view_count = EXCLUDED.view_count,
      reaction_count = EXCLUDED.reaction_count,
      needs_summary = EXCLUDED.needs_summary,
      needs_image = EXCLUDED.needs_image,
      summary_status = EXCLUDED.summary_status,
      image_source = EXCLUDED.image_source,
      updated_at = EXCLUDED.updated_at
  `;

  let copied = 0;
  for (let i = 0; i < sourceResult.rows.length; i += BATCH_SIZE) {
    const slice = sourceResult.rows.slice(i, i + BATCH_SIZE);

    for (const row of slice) {
      const values = commonColumns.map(col => row[col]);
      await targetClient.query(insertSql, values);
      copied += 1;
    }

    console.log(`[copy] Batch complete: ${Math.min(i + BATCH_SIZE, sourceResult.rows.length)}/${sourceResult.rows.length}`);
  }

  console.log(`[copy] Done: copied ${copied} rows to ${tableName}`);
  return { copied, table: tableName };
}

async function verifyTarget(targetClient, tableName) {
  const result = await targetClient.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return Number(result.rows[0].count);
}

async function main() {
  const sourceClient = new Client({ connectionString: SOURCE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const targetClient = new Client({ connectionString: TARGET_DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await sourceClient.connect();
    await targetClient.connect();

    console.log('[copy] Connected to source and target databases.');
    await ensureTargetTableMatchesSource(sourceClient, targetClient, TABLE_NAME);

    const result = await copyTable(sourceClient, targetClient, TABLE_NAME);
    const targetCount = await verifyTarget(targetClient, TABLE_NAME);
    console.log(`[verify] Target count for ${TABLE_NAME}: ${targetCount}`);
    console.log(`[verify] Source copied count: ${result.copied}`);

    console.log('[copy] Migration finished. No deletes were performed.');
    console.log('[copy] Keep the source database as backup until the site is verified in the new DB.');
  } catch (err) {
    console.error('[copy] Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

main();
