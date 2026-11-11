const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
});

/**
 * Dynamically compiles a beautiful, high-res SVG rate card representing current parallel exchange rates
 * and major commodity pricing indices.
 */
async function generateRateCardSvg() {
  let usdBuy = '1,640', usdSell = '1,650';
  let gbpBuy = '2,080', gbpSell = '2,100';
  let eurBuy = '1,780', eurSell = '1,800';
  let cementPrice = '8,200';
  let petrolPrice = '950';
  let foodPriceIndex = '+1.4%';
  let updateTime = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  try {
    // 1. Fetch Parallel Exchange Rates
    const ratesRes = await pool.query(
      `SELECT currency, street_buy, street_sell, updated_at 
       FROM parallel_rates 
       ORDER BY updated_at DESC LIMIT 6`
    );
    if (ratesRes.rows.length > 0) {
      ratesRes.rows.forEach(row => {
        const cur = row.currency.toUpperCase();
        if (cur === 'USD') { usdBuy = row.street_buy; usdSell = row.street_sell; }
        else if (cur === 'GBP') { gbpBuy = row.street_buy; gbpSell = row.street_sell; }
        else if (cur === 'EUR') { eurBuy = row.street_buy; eurSell = row.street_sell; }
      });
      // Extract latest update time from first row
      updateTime = new Date(ratesRes.rows[0].updated_at).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // 2. Fetch Commodities pricing index
    const commRes = await pool.query(
      `SELECT name, current_price, price_change_percent 
       FROM market_commodities 
       ORDER BY updated_at DESC LIMIT 10`
    );
    if (commRes.rows.length > 0) {
      commRes.rows.forEach(row => {
        const name = row.name.toLowerCase();
        if (name.includes('cement')) cementPrice = parseFloat(row.current_price).toLocaleString();
        else if (name.includes('petrol') || name.includes('gasoline')) petrolPrice = parseFloat(row.current_price).toLocaleString();
        else if (name.includes('food') || name.includes('basket')) foodPriceIndex = (row.price_change_percent >= 0 ? '+' : '') + parseFloat(row.price_change_percent).toFixed(1) + '%';
      });
    }
  } catch (err) {
    console.error('Error compiling SVG rates, using fallbacks:', err.message);
  }

  // Compile premium dark SVG with Gold/Silver gradients
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" style="background:#0b0813; font-family:'Segoe UI',Roboto,Helvetica,sans-serif;">
    <defs>
      <!-- Gradient definitions -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f0b1e" />
        <stop offset="50%" stop-color="#0b0813" />
        <stop offset="100%" stop-color="#140f29" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1b162e" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#120e20" stop-opacity="0.9" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="800" height="600" fill="url(#bgGrad)" />
    
    <!-- Accent lights -->
    <circle cx="700" cy="100" r="150" fill="#f59e0b" fill-opacity="0.04" filter="url(#glow)" />
    <circle cx="100" cy="500" r="180" fill="#6366f1" fill-opacity="0.03" filter="url(#glow)" />

    <!-- Top Header -->
    <g transform="translate(40, 45)">
      <!-- RealSSA Icon representation -->
      <circle cx="30" cy="30" r="25" fill="#f59e0b" fill-opacity="0.1" stroke="url(#goldGrad)" stroke-width="2" />
      <text x="30" y="38" font-size="24" font-weight="900" fill="#f59e0b" text-anchor="middle">R</text>
      
      <!-- Brand titles -->
      <text x="75" y="24" font-size="26" font-weight="900" fill="#ffffff" letter-spacing="1">REAL<tspan fill="#f59e0b">SSA</tspan></text>
      <text x="75" y="44" font-size="12" font-weight="700" fill="#818cf8" letter-spacing="2">LIVE ECONOMIC INDEX</text>
      
      <!-- Update Timestamp -->
      <text x="720" y="34" font-size="12" font-weight="700" fill="#94a3b8" text-anchor="end">UPDATED: ${updateTime}</text>
    </g>

    <!-- SECTION 1: PARALLEL EXCHANGE RATES -->
    <text x="40" y="145" font-size="14" font-weight="800" fill="#f59e0b" letter-spacing="1.5">PARALLEL MARKET EXCHANGE (NGN)</text>
    
    <!-- Rates grid -->
    <g transform="translate(40, 160)">
      <!-- USD Card -->
      <rect width="220" height="150" rx="20" fill="url(#cardGrad)" stroke="#2b2447" stroke-width="1.5" />
      <rect width="220" height="6" rx="3" fill="#f59e0b" />
      <text x="30" y="45" font-size="28" font-weight="900" fill="#ffffff">USD</text>
      <text x="190" y="43" font-size="11" font-weight="700" fill="#f59e0b" text-anchor="end">💵 US Dollar</text>
      
      <text x="30" y="85" font-size="11" font-weight="700" fill="#94a3b8">STREET BUY</text>
      <text x="30" y="115" font-size="24" font-weight="800" fill="#10b981">₦${usdBuy}</text>
      
      <text x="130" y="85" font-size="11" font-weight="700" fill="#94a3b8">STREET SELL</text>
      <text x="130" y="115" font-size="24" font-weight="800" fill="#ef4444">₦${usdSell}</text>
    </g>

    <g transform="translate(290, 160)">
      <!-- GBP Card -->
      <rect width="220" height="150" rx="20" fill="url(#cardGrad)" stroke="#2b2447" stroke-width="1.5" />
      <rect width="220" height="6" rx="3" fill="#8b5cf6" />
      <text x="30" y="45" font-size="28" font-weight="900" fill="#ffffff">GBP</text>
      <text x="190" y="43" font-size="11" font-weight="700" fill="#8b5cf6" text-anchor="end">💷 GB Pound</text>
      
      <text x="30" y="85" font-size="11" font-weight="700" fill="#94a3b8">STREET BUY</text>
      <text x="30" y="115" font-size="24" font-weight="800" fill="#10b981">₦${gbpBuy}</text>
      
      <text x="130" y="85" font-size="11" font-weight="700" fill="#94a3b8">STREET SELL</text>
      <text x="130" y="115" font-size="24" font-weight="800" fill="#ef4444">₦${gbpSell}</text>
    </g>

    <g transform="translate(540, 160)">
      <!-- EUR Card -->
      <rect width="220" height="150" rx="20" fill="url(#cardGrad)" stroke="#2b2447" stroke-width="1.5" />
      <rect width="220" height="6" rx="3" fill="#3b82f6" />
      <text x="30" y="45" font-size="28" font-weight="900" fill="#ffffff">EUR</text>
      <text x="190" y="43" font-size="11" font-weight="700" fill="#3b82f6" text-anchor="end">💶 Euro</text>
      
      <text x="30" y="85" font-size="11" font-weight="700" fill="#94a3b8">STREET BUY</text>
      <text x="30" y="115" font-size="24" font-weight="800" fill="#10b981">₦${eurBuy}</text>
      
      <text x="130" y="85" font-size="11" font-weight="700" fill="#94a3b8">STREET SELL</text>
      <text x="130" y="115" font-size="24" font-weight="800" fill="#ef4444">₦${eurSell}</text>
    </g>

    <!-- SECTION 2: COMMODITY RETAIL INDEX -->
    <text x="40" y="375" font-size="14" font-weight="800" fill="#f59e0b" letter-spacing="1.5">RETAIL COMMODITIES INDEX</text>
    
    <g transform="translate(40, 390)">
      <!-- Cement Card -->
      <rect width="220" height="120" rx="20" fill="url(#cardGrad)" stroke="#2b2447" stroke-width="1.5" />
      <text x="25" y="35" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">CEMENT INDEX (50KG)</text>
      <text x="25" y="75" font-size="30" font-weight="900" fill="#ffffff">₦${cementPrice}</text>
      <text x="25" y="100" font-size="10" font-weight="700" fill="#a8a29e">Dangote / BUA Retail</text>
      <circle cx="195" cy="72" r="14" fill="#38bdf8" fill-opacity="0.1" />
      <text x="195" y="76" font-size="12" font-weight="bold" fill="#38bdf8" text-anchor="middle">🏗️</text>
    </g>

    <g transform="translate(290, 390)">
      <!-- Gasoline Card -->
      <rect width="220" height="120" rx="20" fill="url(#cardGrad)" stroke="#2b2447" stroke-width="1.5" />
      <text x="25" y="35" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">FUEL PRICE (PER LITRE)</text>
      <text x="25" y="75" font-size="30" font-weight="900" fill="#ffffff">₦${petrolPrice}</text>
      <text x="25" y="100" font-size="10" font-weight="700" fill="#a8a29e">NNPC / Independent average</text>
      <circle cx="195" cy="72" r="14" fill="#fbbf24" fill-opacity="0.1" />
      <text x="195" y="76" font-size="12" font-weight="bold" fill="#fbbf24" text-anchor="middle">⛽</text>
    </g>

    <g transform="translate(540, 390)">
      <!-- Food Basket Card -->
      <rect width="220" height="120" rx="20" fill="url(#cardGrad)" stroke="#2b2447" stroke-width="1.5" />
      <text x="25" y="35" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">FOOD INFLATION BASKET</text>
      <text x="25" y="75" font-size="30" font-weight="900" fill="#10b981">${foodPriceIndex}</text>
      <text x="25" y="100" font-size="10" font-weight="700" fill="#a8a29e">Lagos / Abuja staple markets</text>
      <circle cx="195" cy="72" r="14" fill="#34d399" fill-opacity="0.1" />
      <text x="195" y="76" font-size="12" font-weight="bold" fill="#34d399" text-anchor="middle">🌾</text>
    </g>

    <!-- Bottom footer with QR CTA -->
    <rect x="0" y="540" width="800" height="60" fill="#130e25" />
    <text x="40" y="575" font-size="13" font-weight="700" fill="#ffffff" letter-spacing="0.5">CHECK HOURLY PARALLEL RATES ON THE WEB</text>
    <text x="360" y="575" font-size="13" font-weight="800" fill="#f59e0b" letter-spacing="1">👉 WWW.REALSSANEWS.COM.NG</text>
    <text x="760" y="575" font-size="11" font-weight="700" fill="#6366f1" text-anchor="end">SCAN OR VISIT TO DOWNLOAD APP</text>
  </svg>`;
  return svg;
}

module.exports = { generateRateCardSvg };
