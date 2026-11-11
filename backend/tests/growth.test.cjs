const {test}=require('node:test');
const assert=require('node:assert/strict');
const logic=require('../services/growthLogic');
const {publicAddress}=require('../services/growthNetwork');
const {recoverImages,runGrowth}=require('../services/growthWorker');

const row={id:1,url_hash:'abc',title:'Nigeria opens new rail line in Lagos today',
  category:'nigeria',published_at:'2026-11-11T10:00:00Z',
  external_link:'https://publisher.test/story',source_name:'Publisher',
  original_excerpt:'A new rail line opened.',image:'https://publisher.test/logo.png',attempts:0};
test('clusters matching stories but not conflicting numbers or old events',()=>{
 assert.equal(logic.clusterStories([row,{...row,id:2}]).length,1);
 assert.equal(logic.clusterStories([row,{...row,id:2,published_at:'2026-10-01'}]).length,2);
 assert.equal(logic.similarity('Election results show 10 seats won by party','Election results show 20 seats won by party'),0);
});
test('editorial context retains source attribution and publication ordering',()=>{
 const context=logic.editorialContext([{...row,published_at:'2026-11-11T12:00:00Z'},row]);
 assert.equal(context.timeline[0].publishedAt,row.published_at);
 assert.equal(context.timeline[0].url,row.external_link);
 assert.equal(context.method,'source-excerpts');
});
test('opportunity ranking uses impressions and actual clicks',()=>{
 const result=logic.trafficOpportunities([{keys:['rail','https://site.test/a'],impressions:1000,clicks:2,ctr:0.002,position:5},
 {keys:['small','b'],impressions:10,clicks:0,ctr:0}]);
 assert.equal(result.length,1);assert.equal(result[0].estimatedClickGap,28);
});
test('distribution links are measurable and logos excluded',()=>{
 const draft=logic.distributionDraft(row,'https://www.realssanews.com.ng');
 assert.equal(draft.image,null);
 assert.equal(new URL(draft.url).searchParams.get('utm_campaign'),'growth-stories');
});
test('network rejects local, mapped and non-global addresses',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','100.64.0.1','::1','::ffff:127.0.0.1','fd00::1','2002:7f00:1::']) assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);
 assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
function fakeDb(article) {
 const calls=[];
 return {calls,query:async(sql,args)=>{
   calls.push({sql,args});
   return {rows:sql.startsWith('SELECT a.')?[article]:[],rowCount:1};
 }};
}
test('image recovery tries another candidate after a broken image',async()=>{
 const db=fakeDb(row);
 const fetcher=async url=>{
   if(url===row.external_link) return {status:200,url,body:Buffer.from('<meta property="og:image" content="/bad.jpg"><img src="/good.jpg">'),headers:{}};
   if(url.endsWith('bad.jpg')) return {status:404,headers:{}};
   return {status:200,url,body:Buffer.from('fixture'),headers:{'content-type':'image/jpeg'}};
 };
 const result=await recoverImages(db,Date.now()+1000,fetcher,async()=>({width:1200,height:800}));
 assert.equal(result.recovered,1);
 assert.ok(db.calls.some(c=>c.sql.startsWith('UPDATE rss_articles') && c.args[1]==='https://publisher.test/good.jpg'));
});
test('failed recovery persists exponential retry without replacing photo',async()=>{
 const db=fakeDb({...row,attempts:3});
 const result=await recoverImages(db,Date.now()+1000,async()=>{throw new Error('offline');});
 assert.equal(result.failed,1);
 assert.ok(db.calls.some(c=>c.args?.[2]===120));
 assert.ok(!db.calls.some(c=>c.sql.startsWith('UPDATE rss_articles')));
});
test('worker does not overlap another active run and releases connection',async()=>{
 let released=false;
 const pool={query:async()=>({rows:[]}),connect:async()=>({
   query:async()=>({rows:[{locked:false}]}),release:()=>{released=true;}
 })};
 assert.equal((await runGrowth(pool)).status,'already_running');
 assert.equal(released,true);
});

test('run releases its advisory lock when persistence fails',async()=>{
 let released=false,unlocked=false;
 const pool={query:async()=>({rows:[]}),connect:async()=>({
   query:async sql=>{
     if(sql.includes('pg_try_advisory_lock')) return {rows:[{locked:true}]};
     if(sql.includes('pg_advisory_unlock')) {unlocked=true;return {rows:[]};}
     throw new Error('database unavailable');
   },release:()=>{released=true;}
 })};
 await assert.rejects(runGrowth(pool),/database unavailable/);
 assert.equal(unlocked,true);assert.equal(released,true);
});
