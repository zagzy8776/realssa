const { test } = require('node:test');
const assert = require('node:assert/strict');
const { savedArticleResponse } = require('../services/savedReader.cjs');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

test('saved body is readable and safely escaped', () => {
  const result = savedArticleResponse({ title: 'Library opens', full_content: '<p>200 books &amp; more.</p>' }, 'https://example.com/story');
  assert.equal(result.textContent, '200 books & more.');
  assert.equal(result.content, '<p>200 books &amp; more.</p>');
  assert.equal(result.partial, false);
});
for (const full of [true, false]) {
  test(`URL-only reader recovers saved ${full ? 'body without publisher fetch' : 'excerpt after publisher failure'}`, async () => {
    const row = { title: 'Library opens', [full ? 'full_content' : 'original_excerpt']: 'The new library contains 200 books and opens Monday.' };
    let calls = 0;
    const mod = { exports: {} };
    new Function('require', 'module', readFileSync(resolve(__dirname, '../../api/extract.js'), 'utf8'))(
      request => request.includes('savedReader') ? { findSavedArticle: async () => row, savedArticleResponse } : {
        extractArticle: async () => { calls++; throw new Error('Publisher unavailable'); }
      }, mod);
    let status, payload;
    const res = { status(code) { status = code; return this; }, setHeader() {}, end(value) { payload = JSON.parse(value); } };
    await mod.exports({ method: 'POST', body: { url: 'https://example.com/story' } }, res);
    assert.equal(status, 200);
    assert.equal(payload.title, row.title);
    assert.ok(payload.textContent.includes('200 books'));
    assert.equal(calls, full ? 0 : 1);
    assert.equal(payload.partial, !full);
  });
}
