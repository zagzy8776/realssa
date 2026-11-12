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
    const row = { title: 'Library opens', [full ? 'full_content' : 'original_excerpt']: full ? 'The library contains 200 books and opens Monday. '.repeat(14) : 'The new library contains 200 books and opens Monday.' };
    let calls = 0;
    const mod = { exports: {} };
    new Function('require', 'module', readFileSync(resolve(__dirname, '../../api/extract.js'), 'utf8'))(
      request => request.includes('savedReader') ? { findSavedArticle: async () => row, savedArticleResponse, saveEnrichment: async () => {} } : request.includes('summariser') ? { generateAIAnalysis: async () => ({ generated: false }) } : {
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

test('feed-only stories reuse a bounded warm cache when no database row exists',async()=>{
  const {saveEnrichment,findSavedArticle}=require('../services/savedReader.cjs');
  const url='https://example.test/cache-only';
  await saveEnrichment(url,{title:'Library opens',source:'Full confirmed source text.',summary:'A full sourced report.',image:null});
  const row=await findSavedArticle(url);
  assert.equal(row.title,'Library opens');
  assert.equal(row.ai_summary,'A full sourced report.');
});
