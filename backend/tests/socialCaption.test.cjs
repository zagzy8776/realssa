const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatSocialCaption, sourceSummary, cleanSocialText } = require('../services/socialCaption.cjs');
// Backend .js sources are CommonJS despite the inherited module package type.
// Load the existing service without changing the application's runtime setup.
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const servicePath = resolve(__dirname, '../services/summariser.js');
const serviceModule = { exports: {} };
new Function('require', 'module', 'exports', readFileSync(servicePath, 'utf8'))(
  createRequire(servicePath), serviceModule, serviceModule.exports);
const { generateSocialHooks } = serviceModule.exports;

test('normalizes legacy media captions to one hashtag and one bio ending', () => {
  const text = formatSocialCaption('A story. #News #Africa\nRead the full story on RealSSA.\nLink in bio 🔗 https://example.test');
  assert.equal(text, 'A story.\n\nLink in bio 🔗\n\n#RealSSA');
  assert.equal(formatSocialCaption(text), text);
});
test('reserves space for ending when shortening long captions', () => {
  for (const maxLength of [255, 2200]) {
    const text = formatSocialCaption('A confirmed development. '.repeat(200), { maxLength });
    assert.ok(text.length <= maxLength);
    assert.ok(text.endsWith('Link in bio 🔗\n\n#RealSSA'));
  }
});
test('fallback includes source facts and decodes scraped entities', () => {
  const title = 'Council opens library';
  const source = '<p>Council opens library.</p><p>The library has 200 books and opens on Monday.</p>';
  const text = sourceSummary(title, source);
  assert.ok(text.includes('200 books'));
  assert.equal(text.match(/Council opens library/g).length, 1);
  assert.equal(cleanSocialText('It&#8217;s &amp; &#x201c;open&#x201d;'), 'It’s & “open”');
});
test('provider failures use source summary instead of title-only caption', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  try {
    const hooks = await generateSocialHooks('Council opens library', 'The building contains 200 books. It opens on Monday.');
    assert.ok(hooks.instagram.includes('200 books'));
    for (const text of Object.values(hooks)) {
      assert.equal((text.match(/#[\p{L}\p{N}_]+/gu) || []).length, 1);
      assert.ok(text.endsWith('Link in bio 🔗\n\n#RealSSA'));
    }
  } finally { global.fetch = originalFetch; }
});
test('parallel provider results remain assigned to their own platform', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const data = JSON.parse(options.body);
    const prompt = data.messages?.[0]?.content || data.contents?.[0]?.parts?.[0]?.text;
    const platform = prompt.includes('Instagram and TikTok') ? 'Instagram' : prompt.includes('on Facebook') ? 'Facebook' : 'Twitter';
    await new Promise(resolve => setTimeout(resolve, platform === 'Instagram' ? 10 : 1));
    return { ok: true, json: async () => ({ choices: [{ message: { content: `${platform} verified story with enough detail for readers. #Extra #Tags` } }] }) };
  };
  try {
    const hooks = await generateSocialHooks('Council opens library', 'The building contains 200 books.');
    for (const [platform, text] of Object.entries(hooks)) assert.ok(text.toLowerCase().startsWith(platform));
  } finally { global.fetch = originalFetch; }
});
