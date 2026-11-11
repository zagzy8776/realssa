// Find the Df function (fetchWithRetry) in the bundle
import { readFileSync } from 'fs';
const jsText = readFileSync('./dist/assets/index-CW7_8sSL.js', 'utf8');

// Search for the fetchWithRetry function - it has TIMEOUT_MS=25000 and RETRY_DELAY_MS=3000
// In minified form, look for 25e3 (25000) and 3e3 (3000)
const idx25k = jsText.indexOf('25e3');
const idx3k = jsText.indexOf('3e3');

console.log('25e3 (25000ms timeout) at:', idx25k);
console.log('3e3 (3000ms retry) at:', idx3k);

if (idx25k !== -1) {
  console.log('\n=== Context around 25e3 ===');
  console.log(jsText.substring(idx25k - 200, idx25k + 600));
}

// Also find "Df" as a standalone identifier
// fetchWithRetry is called as Df(e) in the ReelsCategoryColumn code
// Let's find Df definition
const dfPattern = /,Df=async function|async function Df|Df=async e=>/;
const match = jsText.match(dfPattern);
if (match) {
  const dfIdx = jsText.indexOf(match[0]);
  console.log('\n=== Df (fetchWithRetry) definition ===');
  console.log(jsText.substring(dfIdx, dfIdx + 800));
}

// Also search: the function contains "abort" for AbortController
const abortIdx = jsText.lastIndexOf('AbortController');
if (abortIdx !== -1) {
  console.log('\n=== AbortController context (fetchWithRetry location) ===');
  console.log(jsText.substring(abortIdx - 100, abortIdx + 600));
}
