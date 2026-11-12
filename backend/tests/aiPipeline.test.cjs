const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runAI,callProvider}=require('../services/aiRouter.cjs');
const {enrichArticle}=require('../services/articleEnrichment.cjs');
const {generateAIAnalysis}=require('../services/summariser');
function env(values) {
 const names=['GEMINI_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','NVIDIA_API_KEY','GROQ_API_KEY','CEREBRAS_API_KEY','WATERFALL_API_KEY','CF_API_TOKEN'];
 const old=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 for(const name of names) delete process.env[name];
 Object.assign(process.env,values);
 return ()=>{for(const name of names)old[name]===undefined?delete process.env[name]:process.env[name]=old[name];};
}
const ok=content=>({ok:true,json:async()=>({choices:[{message:{content}}]})});
test('rate limited key cools down and another configured key can complete', async()=>{
 const restore=env({GROQ_API_KEY:'test-limited,test-ready'}), original=global.fetch, calls=[];
 global.fetch=async(_url,options)=>{
  calls.push(options.headers.Authorization);
  return options.headers.Authorization==='Bearer test-limited'?{ok:false,status:429,headers:{get:()=> '3600'}}:ok('Confirmed report with a valid answer.');
 };
 try{
  assert.ok(await callProvider('groq','test'));
  assert.ok(await callProvider('groq','test'));
  assert.equal(calls.filter(key=>key==='Bearer test-limited').length,1);
 }finally{global.fetch=original;restore();}
});
test('invalid provider output falls through and reasoning model has headroom',async()=>{
 const restore=env({CEREBRAS_API_KEY:'test-reasoning',GROQ_API_KEY:'test-fallback'}),original=global.fetch;
 global.fetch=async(url,options)=>{
  if(url.includes('cerebras')){assert.ok(JSON.parse(options.body).max_tokens>=4096);return ok('invalid json');}
  return ok('{"summary":"A complete sourced report."}');
 };
 try{assert.equal(JSON.parse(await runAI('summary','test',{validate:t=>{try{JSON.parse(t);return true;}catch{return false;}}})).summary,'A complete sourced report.');}
 finally{global.fetch=original;restore();}
});
test('detailed analysis receives full source and preserves translations and entities',async()=>{
 const restore=env({GROQ_API_KEY:'test-long-report'}), original=global.fetch;
 const context='The council opened a library with 200 books on Monday. '.repeat(35)+'Final source detail: free entry.';
 const report='The council opened a library with 200 books on Monday. '.repeat(30);
 global.fetch=async(_url,options)=>{
  const prompt=JSON.parse(options.body).messages[0].content;
  assert.ok(prompt.includes('Final source detail'));
  assert.ok(prompt.includes('350-600'));
  return ok(JSON.stringify({summary:report,entities:[{name:'Council',type:'organization'}],translations:{pidgin:{title:'Library opens',summary:'A sourced recap'}}}));
 };
 try{const result=await generateAIAnalysis('Library opens',context);assert.equal(result.generated,true);assert.equal(result.summary,report);assert.equal(result.entities.length,1);assert.ok(result.translations.pidgin);}
 finally{global.fetch=original;restore();}
});
test('RSS teasers do not become fabricated full reports',async()=>{
 const original=global.fetch;global.fetch=()=>{throw Error('must not call AI for a headline');};
 try{const result=await generateAIAnalysis('Library opens','A library opens on Monday.');assert.equal(result.generated,false);}
 finally{global.fetch=original;}
});
test('article extraction precedes analysis and saves actual full source',async()=>{
 let analyzed,stored;
 const body='The library contains 200 books and opens Monday. '.repeat(35);
 const result=await enrichArticle({external_link:'https://example.test/full',title:'Library',original_excerpt:'Short teaser'}, {
  extract:async()=>({textContent:body,partial:false}),
  analyze:async(_title,source)=>{analyzed=source;return{generated:true,summary:'A detailed sourced report.'};},
  save:async value=>{stored=value;}
 });
 assert.equal(analyzed.trim(),body.trim());assert.ok(stored.source.length>1000);assert.equal(result.generated,true);
});
test('outage fallback is not persisted as a successful AI report',async()=>{
 let stored;
 await enrichArticle({external_link:'https://example.test/outage',title:'Library',original_excerpt:'Only a teaser'}, {
  extract:async()=>null,analyze:async()=>({generated:false,summary:'Only a teaser'}),save:async value=>{stored=value;}
 });
 assert.equal(stored.summary,null);assert.equal(stored.source,null);
});
test('JSON-LD articleBody is recovered without AI or teaser padding',async()=>{
 const dns=require('dns').promises,originalLookup=dns.lookup,original=global.fetch;
 dns.lookup=async()=>({address:'93.184.216.34'});
 const body='Library officials confirmed the collection contains 200 books. '.repeat(35);
 global.fetch=async()=>({ok:true,url:'https://example.test/structured',text:async()=>`<html><head><title>Library</title><script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:'Library opens',articleBody:body})}</script></head><body><div>Loading</div></body></html>`});
 try{const result=await require('../services/extractor').extractArticle('https://example.test/structured');assert.equal(result.textContent.trim(),body.trim());assert.equal(result.title,'Library opens');}
 finally{dns.lookup=originalLookup;global.fetch=original;}
});

test('main API and reader load normally under deployed CommonJS package scopes',()=>{
 const {spawnSync}=require('node:child_process');
 const result=spawnSync(process.execPath,['-e',"require('./api/extract.js'); require('./api/index.js'); console.log('HANDLERS_OK'); process.exit(0)"],{
  cwd:require('node:path').resolve(__dirname,'../..'),
  env:{PATH:process.env.PATH,VERCEL:'1',NODE_ENV:'test'},encoding:'utf8',timeout:10000
 });
 assert.equal(result.status,0,result.stderr);
 assert.ok(result.stdout.includes('HANDLERS_OK'));
});
