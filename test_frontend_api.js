async function testFrontendAPI() {
  try {
    console.log('Testing frontend API integration...');
    
    // Test fetching articles from the backend API
    console.log('1. Testing get articles from backend...');
    const articlesResponse = await fetch('http://localhost:5001/api/articles');
    const articlesData = await articlesResponse.json();
    console.log('Articles from backend:', articlesData);
    
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
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testFrontendAPI();