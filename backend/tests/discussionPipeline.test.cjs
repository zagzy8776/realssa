const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function load(relative, requireImpl) {
 const mod={exports:{}};
 new Function('require','module','exports',fs.readFileSync(path.resolve(__dirname,relative),'utf8'))(requireImpl,mod,mod.exports);
 return mod.exports;
}
test('discussion cron initializes schema, uses primary article IDs, and writes the visible comments table',async()=>{
 const calls=[];
 const db={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql.includes('pg_try_advisory_lock'))return{rows:[{locked:true}]};
  if(sql.includes('COUNT(*)'))return{rows:[{count:0}]};
  if(sql.includes('FROM rss_articles'))return{rows:[{id:'rss-7',title:'Library opens',excerpt:'200 books',category:'culture'}]};
  if(sql.includes('INSERT INTO external_comments'))return{rows:[{id:9}]};
  return{rows:[]};
 },connect:async()=>({...db,release(){}})};
 const service=load('../services/discussionBot.js', request=>request.includes('multiDb')?{pools:[{pool:db}]}:request.includes('aiRouter')?{runAI:async()=> 'Which part of the library plan matters most to residents?'}:request.includes('home-feed')?{getHomeArticles:async()=>[]}:require(request));
 const result=await service.monitorAndSimulate();
 assert.equal(result.created,1);
 assert.ok(calls[0].sql.includes('CREATE TABLE IF NOT EXISTS external_comments'));
 const inserted=calls.find(c=>c.sql.includes('INSERT INTO external_comments'));
 assert.equal(inserted.args[0],'rss-7');
 assert.equal(inserted.args[1],'RealSSA Community Bot 🤖');
 assert.ok(calls.some(c=>c.sql.includes('pg_advisory_unlock')));
});
test('canonical reader thread includes existing feed hash comments',async()=>{
 const calls=[];
 const db={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql.includes('SELECT external_link'))return{rows:[{external_link:'https://example.test/story'}]};
  if(sql.includes('FROM external_comments'))return{rows:[{id:1,article_id:'rss-7',author_name:'RealSSA Community Bot 🤖',content:'A question',is_bot:true,created_at:new Date()}]};
  return{rows:[]};
 }};
 const handler=load('../../api/external-comments.js',request=>request.includes('multiDb')?{pools:[{pool:db}]}:require(request));
 let payload;
 await handler({method:'GET',url:'/api/external-comments?articleId=rss-7',headers:{host:'example.test'}},
 {setHeader(){},end(value){payload=JSON.parse(value);}});
 assert.equal(payload[0].isBot,true);
 const queried=calls.find(c=>c.sql.includes('FROM external_comments'));
 assert.equal(queried.args[0].length,2);
 assert.ok(queried.args[0].includes('rss-7'));
});

test('reader request creates one official prompt for a trusted feed-only article and skips duplicates',async()=>{
 const article={id:'rss-abcdef0123456789',title:'Library opens',excerpt:'The library contains 200 books.',category:'culture',externalLink:'https://example.test/library'};
 const writes=[];let generations=0;let exists=false;
 const db={query:async(sql,args)=>{
  if(sql.includes('pg_try_advisory_lock'))return{rows:[{locked:true}]};
  if(sql.includes('COUNT(*)'))return{rows:[{count:0}]};
  if(sql.includes('FROM rss_articles'))return{rows:[]};
  if(sql.includes('SELECT id FROM external_comments'))return{rows:exists?[{id:7}]:[]};
  if(sql.includes('INSERT INTO external_comments')){writes.push(args);exists=true;return{rows:[{id:7}]};}
  return{rows:[]};
 },connect:async()=>({...db,release(){}})};
 const service=load('../services/discussionBot.js',request=>
  request.includes('multiDb')?{pools:[{pool:db}]}:
  request.includes('aiRouter')?{runAI:async(_job,prompt)=>{generations++;assert.ok(prompt.includes('200 books'));return'How could free access benefit residents?';}}:
  request.includes('home-feed')?{getHomeArticles:async()=>[article]}:require(request));
 const first=await service.ensureArticlePrompt(article.id,article.externalLink);
 const second=await service.ensureArticlePrompt(article.id,article.externalLink);
 assert.equal(first.created,1);assert.equal(second.created,0);assert.equal(generations,1);
 assert.equal(writes[0][0],article.id);assert.equal(writes[0][1],'RealSSA Community Bot 🤖');
});
test('daily prompt limit prevents generation and database writes',async()=>{
 let generated=false;
 const db={query:async(sql)=>{
  if(sql.includes('pg_try_advisory_lock'))return{rows:[{locked:true}]};
  if(sql.includes('COUNT(*)'))return{rows:[{count:30}]};
  if(sql.includes('INSERT'))throw Error('No insert after quota');
  return{rows:[]};
 },connect:async()=>({...db,release(){}})};
 const service=load('../services/discussionBot.js',request=>request.includes('multiDb')?{pools:[{pool:db}]}:request.includes('aiRouter')?{runAI:async()=>{generated=true;}}:require(request));
 assert.equal((await service.ensureArticlePrompt('rss-7')).skipped,'daily_limit');assert.equal(generated,false);
});
test('unknown or mismatched article cannot generate a public prompt from client-supplied text',async()=>{
 let generated=false;
 const db={query:async(sql)=>{
  if(sql.includes('pg_try_advisory_lock'))return{rows:[{locked:true}]};
  if(sql.includes('COUNT(*)'))return{rows:[{count:0}]};
  return{rows:[]};
 },connect:async()=>({...db,release(){}})};
 const service=load('../services/discussionBot.js',request=>request.includes('multiDb')?{pools:[{pool:db}]}:
  request.includes('aiRouter')?{runAI:async()=>{generated=true;}}:
  request.includes('home-feed')?{getHomeArticles:async()=>[{id:'rss-aaaaaaaaaaaaaaaa',title:'Different article',externalLink:'https://example.test/other'}]}:require(request));
 const result=await service.ensureArticlePrompt('rss-bbbbbbbbbbbbbbbb','https://example.test/unknown');
 assert.equal(result.skipped,'unknown_article');assert.equal(generated,false);
});
