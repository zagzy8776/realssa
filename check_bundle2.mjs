// Look for the actual fetchWithRetry call in context of Reels
import { readFileSync } from 'fs';
const jsText = readFileSync('./dist/assets/index-CW7_8sSL.js', 'utf8');

// Find all occurrences of fetchWithRetry
let idx = 0;
let count = 0;
while ((idx = jsText.indexOf('fetchWithRetry', idx)) !== -1 && count < 5) {
  console.log(`\n=== fetchWithRetry occurrence ${count+1} at index ${idx} ===`);
  console.log(jsText.substring(idx - 50, idx + 300));
  idx += 14;
  count++;
}

// Also find response.json() calls near "jsonData" 
const jsonIdx = jsText.indexOf('jsonData');
if (jsonIdx !== -1) {
  console.log('\n=== jsonData context ===');
  console.log(jsText.substring(jsonIdx - 100, jsonIdx + 400));
} else {
  console.log('\njsonData NOT FOUND in bundle - variable name was mangled by minifier');
}
