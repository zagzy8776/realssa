// Test exact simulation of what the browser component does
// The component fetches the URL and processes the response

const fetchUrl = 'https://www.realssanews.com.ng/api/articles/trending';

// Simulate fetchWithRetry
async function fetchWithRetry(url, retries = 1) {
  let currentUrl = url;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(currentUrl, { signal: controller.signal });
      clearTimeout(timerId);
      if (response.ok) return response;
      
      if (attempt < retries) {
        if (currentUrl.includes('https://realssanews.com.ng')) {
          currentUrl = currentUrl.replace('https://realssanews.com.ng', 'https://www.realssanews.com.ng');
        } else if (currentUrl.includes('https://www.realssanews.com.ng')) {
          currentUrl = currentUrl.replace('https://www.realssanews.com.ng', 'https://realssanews.com.ng');
        }
      }
      return null;
    } catch (err) {
      clearTimeout(timerId);
      console.warn(`Attempt ${attempt+1} failed:`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 100)); // 100ms instead of 3000ms
      }
    }
  }
  return null;
}

// Simulate what ReelsCategoryColumn does
async function fetchArticles(fetchUrl) {
  try {
    const response = await fetchWithRetry(fetchUrl);
    console.log('response:', response ? `ok=${response.ok} status=${response.status}` : 'NULL');
    
    if (!response) throw new Error('Fetch failed completely');
    
    const jsonData = await response.json();
    console.log('jsonData type:', typeof jsonData, 'isArray:', Array.isArray(jsonData));
    
    let data = [];
    if (jsonData.data && Array.isArray(jsonData.data)) {
      data = jsonData.data;
    } else if (jsonData.articles && Array.isArray(jsonData.articles)) {
      data = jsonData.articles;
    } else if (Array.isArray(jsonData)) {
      data = jsonData;
    }
    
    console.log('data length:', data.length);
    
    const uniqueData = data.filter((item, index, self) => 
      index === self.findIndex((t) => (t.id === item.id))
    ).slice(0, 15);
    
    console.log('uniqueData length:', uniqueData.length);
    if (uniqueData.length > 0) {
      console.log('First article:', uniqueData[0].title);
    }
  } catch (error) {
    console.error('Error fetching reels data:', error);
  }
}

await fetchArticles(fetchUrl);
