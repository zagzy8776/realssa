const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser();

// Test individual international feeds
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

async function testIndividualFeeds() {
  console.log('Testing individual international RSS feeds...\n');
  
  for (let i = 0; i < internationalFeeds.length; i++) {
    const feedUrl = internationalFeeds[i];
    try {
      console.log(`Testing ${feedUrl}...`);
      const feed = await parser.parseURL(feedUrl, { timeout: 10000 });
      console.log(`✓ ${feedUrl} - ${feed.items.length} items found`);
      if (feed.items.length > 0) {
        console.log(`  First item: ${feed.items[0].title}`);
      }
    } catch (error) {
      console.log(`✗ ${feedUrl} - Error: ${error.message}`);
    }
    console.log('---');
  }
}

testIndividualFeeds();