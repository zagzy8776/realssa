async function testBackendAPI() {
  try {
    console.log('Testing backend API...');
    
    // Test login
    console.log('1. Testing login...');
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginResponse.ok && loginData.token) {
      const token = loginData.token;
      
      // Test getting articles
      console.log('2. Testing get articles...');
      const articlesResponse = await fetch('http://localhost:5001/api/articles');
      const articlesData = await articlesResponse.json();
      console.log('Articles response:', articlesData);
      
      // Test posting a new article
      console.log('3. Testing post article...');
      const newArticle = {
        title: 'Test Article from Admin',
        excerpt: 'This is a test article posted via the admin interface',
        category: 'afrobeats',
        image: 'https://via.placeholder.com/400x250?text=Test+Article',
        readTime: '3 min read',
        author: 'Admin',
        source: 'user'
      };
      
      const postResponse = await fetch('http://localhost:5001/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newArticle),
      });
      const postData = await postResponse.json();
      console.log('Post article response:', postData);
      
      // Test getting articles again to see if the new one appears
      console.log('4. Testing get articles after posting...');
      const articlesResponse2 = await fetch('http://localhost:5001/api/articles');
      const articlesData2 = await articlesResponse2.json();
      console.log('Articles after posting:', articlesData2);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testBackendAPI();
