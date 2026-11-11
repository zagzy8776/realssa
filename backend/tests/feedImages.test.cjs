const { test } = require('node:test');
const assert = require('node:assert/strict');
const { feedImages, htmlImages, imageUrl } = require('../services/feedImages');
test('nested media extracts thumbnails, not videos', () => {
 assert.deepEqual(feedImages({link:'https://news.test/story', 'media:group':[{'media:content':[{$:{url:'/video.mp4',type:'video/mp4'}}], 'media:thumbnail':[{$:{url:'/photo.jpg'}}]}]}), ['https://news.test/photo.jpg']);
});
test('all content fields and lazy images are inspected', () => {
 assert.deepEqual(feedImages({link:'https://news.test/story',content:'<img src="/logo.png">',description:'<img width="1" src="/track.jpg"><img data-src="/photo.jpg?a=1&amp;b=2">'}), ['https://news.test/photo.jpg?a=1&b=2']);
});
test('metadata supports reversed attributes and relative URLs', () => {
 assert.equal(htmlImages('<meta content="../photo.jpg" property="og:image">','https://news.test/news/story')[0], 'https://news.test/photo.jpg');
});
test('responsive images prefer the larger candidate', () => {
 assert.equal(htmlImages('<img src="/placeholder.jpg" data-srcset="/small.jpg 320w, /large.jpg 1600w">','https://news.test')[0], 'https://news.test/large.jpg');
});
test('JSON-LD graphs support image objects and malformed blocks', () => {
 assert.equal(htmlImages('<script type="application/ld+json">bad</script><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","image":[{"url":"/hero.webp"}]}]}</script>','https://news.test')[0], 'https://news.test/hero.webp');
});
test('unsafe schemes and non-image enclosures are rejected', () => {
 for(const u of ['javascript:alert(1)','data:image/png;base64,aaa','https://u:p@news.test/a.jpg','https://news.test/a.mp4']) assert.equal(imageUrl(u),null);
 assert.deepEqual(feedImages({enclosure:{url:'https://news.test/download',type:'audio/mpeg'}}),[]);
});
test('feed logos and empty values do not become article photos', () => {
 assert.deepEqual(feedImages({link:'https://news.test/story',image:{url:'https://news.test/brand.jpg'}}),[]);
 assert.deepEqual(htmlImages('<img>','https://news.test/story'),[]);
});
