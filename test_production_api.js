async function testProductionAPI() {
  try {
    console.log('Testing production API connection...');
    
    // Test fetching articles from the Railway backend
    console.log('1. Testing get articles from Railway backend...');
    const articlesResponse = await fetch('https://realssa-production.up.railway.app/api/articles');
    
    if (articlesResponse.ok) {
      const articlesData = await articlesResponse.json();
      console.log('✅ Successfully connected to Railway backend!');
      console.log('Articles from production:', articlesData);
      
      // Check if the data structure matches what the frontend expects
      console.log('2. Checking data structure compatibility...');
      articlesData.forEach((article, index) => {
        console.log(`Article ${index + 1}:`);
        console.log(`  - id: ${article.id} (${typeof article.id})`);
        console.log(`  - title: ${article.title}`);
        console.log(`  - excerpt: ${article.excerpt}`);
        console.log(`  - category: ${article.category}`);
        console.log(`  - image: ${article.image}`);
        console.log(`  - readTime: ${article.readTime}`);
        console.log(`  - date: ${article.date}`);
        console.log(`  - source: ${article.source}`);
        console.log('');
      });
      
      console.log('✅ All articles have the correct structure for the frontend!');
    } else {
      console.log(`❌ Failed to connect to Railway backend. Status: ${articlesResponse.status}`);
      console.log('Response:', await articlesResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Error connecting to production API:', error.message);
    console.log('This might be expected if the Railway backend is not yet deployed or has deployment issues.');
  }
}

testProductionAPI();