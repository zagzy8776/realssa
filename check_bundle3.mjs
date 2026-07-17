// Find the actual ReelsCategoryColumn code in the bundle
import { readFileSync } from 'fs';
const jsText = readFileSync('./dist/assets/index-CW7_8sSL.js', 'utf8');

// Find all occurrences of fetchWithRetry
let idx = 0;
let count = 0;
while ((idx = jsText.indexOf('fetchWithRetry', idx)) !== -1 && count < 5) {
  console.log(`\n=== fetchWithRetry occurrence ${count+1} ===`);
  console.log(jsText.substring(idx - 30, idx + 500));
  idx += 14;
  count++;
}
if (count === 0) {
  console.log('fetchWithRetry NOT found - checking for the function body...');
  // Check for the TIMEOUT_MS constant which is in fetchWithRetry
  const timeoutIdx = jsText.indexOf('25000');
  if (timeoutIdx !== -1) {
    console.log('Found 25000 (TIMEOUT_MS) at:', timeoutIdx);
    console.log(jsText.substring(timeoutIdx - 100, timeoutIdx + 300));
  }
}

// Find "No stories" and look further back for the fetch logic
const noStoriesIdx = jsText.indexOf('No stories');
if (noStoriesIdx !== -1) {
  // Look for fetch call near it
  const contextStart = Math.max(0, noStoriesIdx - 2000);
  const context = jsText.substring(contextStart, noStoriesIdx + 100);
  // Find fetch( in that context
  const fetchIdx = context.lastIndexOf('fetch(');
  if (fetchIdx !== -1) {
    console.log('\n=== fetch call near "No stories" ===');
    console.log(context.substring(fetchIdx - 50, fetchIdx + 600));
  }
}
