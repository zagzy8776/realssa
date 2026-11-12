const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatSocialCaption, sourceSummary, cleanSocialText } = require('../services/socialCaption.cjs');
const { generateSocialHooks } = require('../services/summariser');
process.env.GROQ_API_KEY = 'test-only-key';

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
test('one editorial request feeds all platforms without tripling quota', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls++;
    const data = JSON.parse(options.body);
    assert.ok(data.messages[0].content.includes('source data'));
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'The council opened its new library. It contains 200 books. #Extra #Tags' } }] }) };
  };
  try {
    const hooks = await generateSocialHooks('Council opens library', 'The building contains 200 books.');
    assert.equal(calls, 1);
    assert.equal(hooks.instagram, hooks.facebook);
    assert.ok(hooks.instagram.includes('200 books'));
  } finally { global.fetch = originalFetch; }
});

test('Gemini uses current configurable model and falls back after HTTP failure', async () => {
  const originalFetch = global.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  const oldModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'test-google-key';
  process.env.GEMINI_MODEL = 'test-model';
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    if (url.includes('googleapis')) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'A verified source summary explaining the library opening and its 200 books.' } }] }) };
  };
  try {
    const result = await require('../services/aiRouter.cjs').runAI('summary', 'Explain the library and its 200 books.');
    assert.ok(urls.some(url => url.includes('/test-model:generateContent')));
    assert.ok(result.includes('200 books'));
  } finally {
    global.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = oldModel;
  }
});
