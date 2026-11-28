import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
for (const page of ['ForYou', 'Profile', 'Trending', 'LocalMarketHub']) {
  assert.ok(manifest['src/pages/' + page + '.tsx'], 'Missing route module ' + page);
}
for (const entry of Object.values(manifest)) {
  assert.ok(existsSync('dist/' + entry.file), 'Missing asset ' + entry.file);
  for (const dep of [...entry.imports || [], ...entry.dynamicImports || []]) assert.ok(manifest[dep], 'Missing dependency ' + dep);
}
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const fallback = config.rewrites.find(rule => rule.destination === '/index.html');
const pattern = new RegExp('^' + fallback.source + '$');
assert.ok(pattern.test('/profile') && !pattern.test('/assets/Profile-old.js'), 'App shell must exclude assets');
assert.ok(existsSync('dist/images/nigeria_heritage_bg.png'), 'Missing Nigeria artwork');

// Reproduce an edge returning an HTML shell for a retired chunk.
const { runInNewContext } = await import('node:vm');
const listeners = {};
const origin = 'https://example.test';
const cache = { match: async () => undefined, put() { throw Error('Cached HTML as JavaScript'); } };
runInNewContext(readFileSync('public/sw.js', 'utf8'), {
  self: { location: { origin }, addEventListener(name, listener) { listeners[name] = listener; } },
  importScripts() {}, URL, Response, caches: { open: async () => cache },
  fetch: async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
});
let reply;
listeners.fetch({
  request: new Request(origin + '/assets/Profile-retired.js', { headers: { Accept: 'text/html' } }),
  respondWith(result) { reply = result; },
});
assert.equal((await reply).status, 404);
