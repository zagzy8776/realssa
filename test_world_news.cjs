const axios = require('axios');

async function testWorldNewsAPI() {
  try {
    console.log('Testing World News API...');
    const response = await axios.get('http://localhost:3001/api/nigerian-news', {
      timeout: 10000
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Total articles: ${response.data.length}`);
    
    // Show first few articles to see what's being returned
    console.log('\nFirst 5 articles:');
    response.data.slice(0, 5).forEach((article, index) => {
      console.log(`${index + 1}. Title: ${article.title}`);
      console.log(`   Author: ${article.author}`);
      console.log(`   Category: ${article.category}`);
      console.log(`   Source: ${article.source}`);
      console.log('---');
    });
    
    // Check for international feeds
    const internationalFeeds = [
      'BBC News', 'Al Jazeera', 'Variety', 'Rolling Stone', 
      'The Verge', 'Wired', 'ESPN', 'CoinDesk', 'CoinTelegraph',
      'Bitcoin Magazine', 'TechCabal', 'IGN', 'GameSpot', 'PC Gamer', 'Kotaku',
      'The Business of Fashion', 'Fashionista', 'WWD', 'Fibre2Fashion'
    ];
    
    const internationalArticles = response.data.filter(article => 
      internationalFeeds.includes(article.author)
    );
    
    console.log(`\nInternational articles found: ${internationalArticles.length}`);
    if (internationalArticles.length > 0) {
      console.log('International articles:');
      internationalArticles.slice(0, 3).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title} - ${article.author}`);
      });
    } else {
      console.log('No international articles found. Available authors:');
      const uniqueAuthors = [...new Set(response.data.map(a => a.author))];
      console.log(uniqueAuthors);
    }
    
  } catch (error) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testWorldNewsAPI();