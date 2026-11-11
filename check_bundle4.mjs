// Find what actually happens when "No stories" is triggered
import { readFileSync } from 'fs';
const jsText = readFileSync('./dist/assets/index-CW7_8sSL.js', 'utf8');

const noStoriesIdx = jsText.indexOf('No stories');
if (noStoriesIdx !== -1) {
  // Get a large window around "No stories" to understand the surrounding logic
  console.log('=== 3000 chars around "No stories" ===');
  console.log(jsText.substring(noStoriesIdx - 1500, noStoriesIdx + 1500));
}
