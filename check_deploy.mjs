// Check the deployed JS bundle for the Loader2 fix
const r = await fetch('https://www.realssanews.com.ng/');
const html = await r.text();
const mainScript = html.match(/index-[^"]+\.js/)?.[0];

if (mainScript) {
  console.log('Main JS filename on Vercel:', mainScript);
  // Fetch the actual JS and check for Loader2
  const jsUrl = 'https://www.realssanews.com.ng/assets/' + mainScript;
  const jsRes = await fetch(jsUrl);
  const jsText = await jsRes.text();
  console.log('JS bundle size:', jsText.length);
  console.log('Contains Loader2 reference:', jsText.includes('Loader2'));
  console.log('Contains "No stories":', jsText.includes('No stories'));
  // Check what version is in the bundle
  const versionMatch = jsText.match(/"version":"([^"]+)"/);
  console.log('Version in bundle:', versionMatch?.[1]);
}

// Also check local dist
import { readFileSync, readdirSync } from 'fs';
const distAssets = readdirSync('./dist/assets');
const localMain = distAssets.find(f => f.startsWith('index-') && f.endsWith('.js'));
console.log('\nLocal dist JS:', localMain);
if (localMain) {
  const localJs = readFileSync('./dist/assets/' + localMain, 'utf8');
  console.log('Local contains Loader2:', localJs.includes('Loader2'));
}
