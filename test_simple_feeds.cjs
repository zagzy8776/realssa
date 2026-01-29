const axios = require('axios');

// Test if international feeds are accessible
const internationalFeeds = [
  'http://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://variety.com/feed/',
  'https://www.rollingstone.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/rss',
  'https://www.espn.com/espn/rss/news',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://feeds.feedburner.com/ign/all',
  'https://www.gamespot.com/feeds/news/',
  'https://www.pcgamer.com/rss/',
  'https://kotaku.com/rss',
  'https://www.businessoffashion.com/feed',
  'https://fashionista.com/.rss/excerpt',
  'https://wwd.com/feed/'
];

async function testFeedAccessibility() {
  console.log('Testing international feed accessibility...\n');
  
  for (let i = 0; i < internationalFeeds.length; i++) {
    const feedUrl = internationalFeeds[i];
    try {
      console.log(`Testing ${feedUrl}...`);
      const response = await axios.get(feedUrl, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.status === 200) {
        console.log(`✓ ${feedUrl} - Accessible (${response.data.length} bytes)`);
      } else {
        console.log(`✗ ${feedUrl} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`✗ ${feedUrl} - Error: ${error.message}`);
    }
    console.log('---');
  }
}

testFeedAccessibility();