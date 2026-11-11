// Find ReelsCard component (rD) in the bundle to see if it has Loader2
import { readFileSync } from 'fs';
const jsText = readFileSync('./dist/assets/index-CW7_8sSL.js', 'utf8');

// Find rD function definition - search for "function rD" or "const rD"
const rdIdx = jsText.indexOf('function rD');
const rdIdx2 = jsText.indexOf('rD=function');
const rdIdx3 = jsText.indexOf(',rD=');

console.log('function rD at:', rdIdx);
console.log('rD=function at:', rdIdx2);
console.log(',rD= at:', rdIdx3);

if (rdIdx !== -1) {
  console.log('\n=== ReelsCard (rD) function ===');
  console.log(jsText.substring(rdIdx, rdIdx + 2000));
} else if (rdIdx3 !== -1) {
  console.log('\n=== ReelsCard (rD) definition ===');
  console.log(jsText.substring(rdIdx3, rdIdx3 + 2000));
}

// Also search for isParsing which is in ReelsCard
const isParsingIdx = jsText.indexOf('isParsing');
console.log('\nisParsing found:', isParsingIdx !== -1);

// Search for Loader2 anywhere in bundle including lucide chunk
const lucideText = readFileSync('./dist/assets/lucide-DPhOC7GU.js', 'utf8');
console.log('Loader2 in lucide chunk:', lucideText.includes('Loader2'));
console.log('Lucide chunk size:', lucideText.length);
