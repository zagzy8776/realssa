const {Client} = require('pg');
const src = new Client({
  connectionString: 'postgresql://neondb_owner:npg_VvqMQyLsL6Qi@ep-sweet-field-a7hqqrzy.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: {rejectUnauthorized: false}
});
const tgt = new Client({
  connectionString: 'postgresql://neondb_owner:npg_Vo3Pa9lmCHNp@ep-small-mouse-aybehdo9.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: {rejectUnauthorized: false}
});

(async () => {
  await src.connect();
  await tgt.connect();
  
  const srcCols = await src.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='rss_articles' ORDER BY ordinal_position");
  const tgtCols = await tgt.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='rss_articles' ORDER BY ordinal_position");
  
  console.log('[SOURCE COLS]');
  srcCols.rows.forEach(r => console.log(r.column_name + ' (' + r.data_type + ')'));
  
  console.log('\n[TARGET COLS]');
  tgtCols.rows.forEach(r => console.log(r.column_name + ' (' + r.data_type + ')'));
  
  const srcNames = new Set(srcCols.rows.map(r => r.column_name));
  const tgtNames = new Set(tgtCols.rows.map(r => r.column_name));
  
  console.log('\n[IN SOURCE BUT NOT TARGET]');
  srcNames.forEach(c => tgtNames.has(c) || console.log(c));
  
  console.log('\n[IN TARGET BUT NOT SOURCE]');
  tgtNames.forEach(c => srcNames.has(c) || console.log(c));
  
  await src.end();
  await tgt.end();
})();
