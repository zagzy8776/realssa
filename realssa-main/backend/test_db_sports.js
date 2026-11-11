const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  console.log('Testing connection to Neon PostgreSQL database...');
  console.log('DB URL:', process.env.DATABASE_URL ? 'Configured (starts with postgresql://)' : 'Not set');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database successfully.');
    
    // 1. Check if live_matches table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'live_matches'
      );
    `);
    const exists = tableCheck.rows[0].exists;
    console.log('Table "live_matches" exists:', exists);
    
    if (exists) {
      // Describe table columns
      const cols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'live_matches';
      `);
      console.log('Columns in "live_matches":');
      cols.rows.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
      
      // Query sample matches
      const sample = await client.query('SELECT * FROM live_matches LIMIT 3;');
      console.log('Sample rows:', sample.rows.length);
    }
    
    client.release();
  } catch (err) {
    console.error('❌ Database connection or query error:', err.message);
  }
  process.exit(0);
})();
