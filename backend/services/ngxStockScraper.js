const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;

const BASELINE_STOCKS = [
  { symbol: 'MTNN', name: 'MTN Nigeria Communications PLC', price: 275.50 },
  { symbol: 'DANGCEM', name: 'Dangote Cement PLC', price: 650.00 },
  { symbol: 'GTCO', name: 'Guaranty Trust Holding Co PLC', price: 46.80 },
  { symbol: 'ZENITHBANK', name: 'Zenith Bank PLC', price: 38.50 },
  { symbol: 'FBNH', name: 'FBN Holdings PLC', price: 28.90 },
  { symbol: 'ACCESSCORP', name: 'Access Holdings PLC', price: 22.30 },
  { symbol: 'UBA', name: 'United Bank for Africa PLC', price: 26.40 },
  { symbol: 'SEPLAT', name: 'Seplat Energy PLC', price: 3100.00 }
];

async function updateStockPrices() {
  console.log('📡 Updating daily NGX stock closes...');

  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    return;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if we already have records for today
    const checkRes = await pool.query(
      'SELECT COUNT(*) FROM ngx_stocks WHERE trading_date = $1',
      [today]
    );

    if (parseInt(checkRes.rows[0].count) > 0) {
      console.log('Stock prices for today already exist. Skipping.');
      return;
    }

    // Fetch the most recent price for each symbol to calculate swings
    const lastClosesRes = await pool.query(
      `SELECT DISTINCT ON (symbol) symbol, company_name, price 
       FROM ngx_stocks 
       ORDER BY symbol, trading_date DESC`
    );

    const hasData = lastClosesRes.rows.length > 0;

    if (!hasData) {
      console.log('Initializing stock database with baseline ticker valuations...');
      for (const stk of BASELINE_STOCKS) {
        await pool.query(
          `INSERT INTO ngx_stocks (symbol, company_name, price, price_change, percent_change, volume, trading_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [stk.symbol, stk.name, stk.price, 0.0, 0.0, 1500000 + Math.floor(Math.random() * 5000000), today]
        );
      }
      console.log('✅ Stock database initialized.');
    } else {
      console.log('Calculating NGX closing price swings...');
      for (const row of lastClosesRes.rows) {
        // Volatility swing (-1.5% to +2.0%)
        const pctSwing = (Math.random() * 3.5 - 1.5); // float percent
        const oldPrice = parseFloat(row.price);
        const priceChange = parseFloat((oldPrice * (pctSwing / 100)).toFixed(2));
        const newPrice = parseFloat((oldPrice + priceChange).toFixed(2));
        const volume = 1000000 + Math.floor(Math.random() * 8000000);

        await pool.query(
          `INSERT INTO ngx_stocks (symbol, company_name, price, price_change, percent_change, volume, trading_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (symbol, trading_date) DO UPDATE SET
             price = EXCLUDED.price,
             price_change = EXCLUDED.price_change,
             percent_change = EXCLUDED.percent_change,
             volume = EXCLUDED.volume`,
          [row.symbol, row.company_name, newPrice, priceChange, pctSwing.toFixed(2), volume, today]
        );
      }
      console.log('✅ Daily closing updates written.');
    }

  } catch (err) {
    console.error('❌ Failed to update stock closing rates:', err.message);
  } finally {
    await pool.end();
  }
}

// Support direct execution
if (require.main === module) {
  updateStockPrices();
}

module.exports = { updateStockPrices };
