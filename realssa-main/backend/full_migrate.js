const { spawn } = require('child_process');
const fs = require('fs');

const SOURCE_URL = 'postgresql://neondb_owner:npg_LXS6rJEbRCl2@ep-sweet-field-azj0x1ei.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const TARGET_URL = 'postgresql://neondb_owner:npg_Vo3Pa9lmCHNp@ep-small-mouse-aybehdo9.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', data => stdout += data.toString());
    proc.stderr.on('data', data => stderr += data.toString());
    
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Command failed with exit code ${code}`));
    });
  });
}

async function main() {
  try {
    console.log('[migrate] Dumping rss_articles from source...');
    const dump = await runCommand('pg_dump', [
      '--data-only',
      '--table=rss_articles',
      '--no-privileges',
      '--no-owner',
      SOURCE_URL
    ]);
    
    console.log('[migrate] Dump size:', Math.round(dump.length / 1024), 'KB');
    fs.writeFileSync('rss_articles_dump.sql', dump);
    
    console.log('[migrate] Truncating target table...');
    const { Client } = require('pg');
    const target = new Client({ connectionString: TARGET_URL, ssl: { rejectUnauthorized: false } });
    await target.connect();
    await target.query('TRUNCATE TABLE rss_articles CASCADE');
    await target.end();
    
    console.log('[migrate] Restoring to target...');
    await runCommand('psql', [TARGET_URL, '-f', 'rss_articles_dump.sql']);
    
    console.log('[migrate] Verifying counts...');
    const { Client: Client2 } = require('pg');
    const src = new Client({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
    const tgt = new Client({ connectionString: TARGET_URL, ssl: { rejectUnauthorized: false } });
    
    await src.connect();
    await tgt.connect();
    
    const srcCount = await src.query('SELECT COUNT(*) as c FROM rss_articles');
    const tgtCount = await tgt.query('SELECT COUNT(*) as c FROM rss_articles');
    
    console.log(`[verify] Source: ${srcCount.rows[0].c} | Target: ${tgtCount.rows[0].c}`);
    
    await src.end();
    await tgt.end();
    
    fs.unlinkSync('rss_articles_dump.sql');
    console.log('[migrate] Done! Ready to switch DATABASE_URL.');
  } catch (err) {
    console.error('[error]', err.message);
    process.exit(1);
  }
}

main();
