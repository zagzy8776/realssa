// Simulate exactly what the browser would do - check CORS headers
const testUrls = [
  'https://www.realssanews.com.ng/api/articles/trending',
  'https://www.realssanews.com.ng/api/news/nigerian',
];

for (const url of testUrls) {
  const r = await fetch(url, {
    headers: {
      'Origin': 'https://www.realssanews.com.ng',
      'Accept': 'application/json',
    }
  });
  console.log(`\n${url}`);
  console.log('Status:', r.status);
  console.log('CORS header:', r.headers.get('access-control-allow-origin'));
  console.log('Content-Type:', r.headers.get('content-type'));
  const text = await r.text();
  console.log('First 100 chars:', text.substring(0, 100));
  console.log('Is JSON:', text.trim().startsWith('[') || text.trim().startsWith('{'));
}
