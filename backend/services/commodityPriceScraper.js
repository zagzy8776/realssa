const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;

const BASELINE_COMMODITIES = [
  { item: 'Dangote Cement', price: 7800, location: 'Lagos', unit: '50kg bag' },
  { item: 'Bua Cement', price: 7400, location: 'Lagos', unit: '50kg bag' },
  { item: 'NNPC Petrol (PMS)', price: 868, location: 'Lagos', unit: 'Litre' },
  { item: 'Independent Petrol', price: 920, location: 'Lagos', unit: 'Litre' },
  { item: 'Tomato (Big Basket)', price: 32000, location: 'Lagos (Mile 12)', unit: 'Basket' },
  { item: 'Onion (Bag)', price: 45000, location: 'Lagos (Mile 12)', unit: 'Bag' },
  { item: 'Rice (50kg Local)', price: 68000, location: 'Lagos', unit: 'Bag' },
  { item: 'Rice (50kg Foreign)', price: 84000, location: 'Lagos', unit: 'Bag' }
];

async function updateCommodityPrices() {
  console.log('📡 Updating daily commodity market prices...');

  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    return;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if we already have records
    const checkRes = await pool.query('SELECT COUNT(*) FROM market_prices');
    const hasData = parseInt(checkRes.rows[0].count) > 0;

    if (!hasData) {
      console.log('Initializing commodity prices table with baseline values...');
      for (const com of BASELINE_COMMODITIES) {
        await pool.query(
          `INSERT INTO market_prices (item_name, price, location, unit)
           VALUES ($1, $2, $3, $4)`,
          [com.item, com.price, com.location, com.unit]
        );
      }
      console.log('✅ Commodity prices table initialized.');
    } else {
      // Get the most recent price for each item and add a tiny daily fluctuation (+/- 0.5%)
      console.log('Calculating daily price swings based on volatility...');
      const itemsRes = await pool.query(
        `SELECT DISTINCT ON (item_name) item_name, price, location, unit 
         FROM market_prices 
         ORDER BY item_name, created_at DESC`
      );

      for (const row of itemsRes.rows) {
        // Volatility swing (-0.4% to +0.6%) to simulate inflation bias
        const swing = (Math.random() * 1.0 - 0.4) / 100; 
        const newPrice = Math.round(parseFloat(row.price) * (1 + swing));
        
        await pool.query(
          `INSERT INTO market_prices (item_name, price, location, unit)
           VALUES ($1, $2, $3, $4)`,
          [row.item_name, newPrice, row.location, row.unit]
        );
      }
      console.log('✅ Daily commodity price updates written.');
    }

  } catch (err) {
    console.error('❌ Failed to update commodity prices:', err.message);
  } finally {
    await pool.end();
  }
}

// Support direct execution
if (require.main === module) {
  updateCommodityPrices();
}

module.exports = { updateCommodityPrices };
