// Deep check: simulate what ReelsCategoryColumn does
import { readFileSync } from 'fs';

// Check what the actual Vercel JS does around the "No stories" message
const jsText = readFileSync('./dist/assets/index-CW7_8sSL.js', 'utf8');

// Search around "No stories" context 
const idx = jsText.indexOf('No stories');
if (idx !== -1) {
  console.log('Context around "No stories" (500 chars):');
  console.log(jsText.substring(idx - 200, idx + 300));
}

// Search for fetchWithRetry usage
const fetchIdx = jsText.indexOf('fetchWithRetry');
if (fetchIdx !== -1) {
  console.log('\nContext around fetchWithRetry:');
  console.log(jsText.substring(fetchIdx - 100, fetchIdx + 400));
}

// Search for apiUrl usage in reels context
const reelsIdx = jsText.indexOf('api/articles/trending');
if (reelsIdx !== -1) {
  console.log('\nContext around trending API call:');
  console.log(jsText.substring(reelsIdx - 100, reelsIdx + 400));
}
