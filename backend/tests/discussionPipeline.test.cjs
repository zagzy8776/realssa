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
 const service=load('../services/discussionBot.js', request=>request==='pg'?{Pool:function(){return db;}}:{runAI:async()=> 'Which part of the library plan matters most to residents?'});
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
