const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LXS6rJEbRCl2@ep-sweet-field-azj0x1ei.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
async function testInsert() {
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS test_quota (id serial PRIMARY KEY, val text);");
    await pool.query("INSERT INTO test_quota (val) VALUES ('test');");
    console.log('Insert into Sweet Field (DB1) SUCCESS');
  } catch(e) {
    console.log('Insert into Sweet Field (DB1) ERROR: ' + e.message);
  }
  pool.end();
}
testInsert();
