async function testRailwayServer() {
  try {
    console.log('Testing Railway server status...');
    
    // Test root endpoint
    console.log('1. Testing root endpoint...');
    const rootResponse = await fetch('https://realssa-production.up.railway.app/');
    
    if (rootResponse.ok) {
      const rootData = await rootResponse.json();
      console.log('✅ Root endpoint working:', rootData);
    } else {
      console.log(`❌ Root endpoint failed. Status: ${rootResponse.status}`);
      console.log('Response:', await rootResponse.text());
    }
    
    // Test articles endpoint without authentication
    console.log('2. Testing articles endpoint...');
    const articlesResponse = await fetch('https://realssa-production.up.railway.app/api/articles');
    
    if (articlesResponse.ok) {
      const articlesData = await articlesResponse.json();
      console.log('✅ Articles endpoint working:', articlesData);
    } else {
      console.log(`❌ Articles endpoint failed. Status: ${articlesResponse.status}`);
      console.log('Response:', await articlesResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Error connecting to Railway server:', error.message);
  }
}

testRailwayServer();