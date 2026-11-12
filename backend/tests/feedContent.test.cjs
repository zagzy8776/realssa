const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cleanArticleHtml,cleanArticleText}=require('../services/articleContent.cjs');
const {balancedCandidates,cleanText}=require('../../api/home-feed');
test('publisher controls and biography do not become article content',()=>{
 const result=cleanArticleHtml(`<article><p>The library opened on Monday with 200 books.</p>
 <div class="article-tools"><button>Save</button><span>Share</span></div>
 <p>Get alerts on significant breaking news as it happens. Sign up for our Breaking News Alert.</p>
 <p>You have reached your maximum number of saved items.</p>
 <p>Remove items from your saved list to add more.</p><p>No gift articles left</p>
 <p>You've used all of your gift articles. 3 more will become available on the 1st of every month.</p>
 <p>License this article</p><p>For subscribers</p><p>BT Quiz</p>
 <div class="author-bio">A reporter biography. Connect via email.</div>
 <p>Residents can enter for free.</p></article>`);
 assert.ok(result.textContent.includes('200 books'));
 assert.ok(result.textContent.includes('Residents can enter for free'));
 assert.doesNotMatch(result.textContent,/gift|maximum number|sign up|License|subscribers|biography/i);
});
test('words such as save and gift inside real reporting are preserved',()=>{
 const source='The council voted to save the historic library and accepted a gift of 200 books.';
 assert.equal(cleanArticleText(source),source);
});
test('RSS headlines decode escaped punctuation before API responses',()=>{
 assert.equal(cleanText('&amp;#8216;The story&#8217; &amp; news'),'‘The story’ & news');
});
test('candidate pool preserves minority categories and pagination covers each item once',()=>{
 const articles=Array.from({length:100},(_,i)=>({id:String(i),category:i<95?'sports':'culture'}));
 const balanced=balancedCandidates(articles);
 assert.ok(balanced.slice(0,10).some(a=>a.category==='culture'));
 const pages=[balanced.slice(0,20),balanced.slice(20,40),balanced.slice(40)];
 assert.equal(new Set(pages.flat().map(a=>a.id)).size,100);
});
