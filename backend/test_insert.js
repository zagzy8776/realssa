const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_gQl3RcnC8MWS@ep-green-butterfly-azlp8ez4.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
async function testInsert() {
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS test_quota (id serial PRIMARY KEY, val text);");
    await pool.query("INSERT INTO test_quota (val) VALUES ('test');");
    console.log('Insert into Green Butterfly (DB3) SUCCESS');
  } catch(e) {
    console.log('Insert into Green Butterfly (DB3) ERROR: ' + e.message);
  }
  pool.end();
}
testInsert();
