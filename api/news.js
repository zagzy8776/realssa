// Public news read path. It is intentionally independent of PostgreSQL.
// This endpoint fans out across a large multi-region RSS network and tolerates
// individual publisher failures. The database remains the persistence layer;
// RSS is the live ingestion/read fallback.

const FEEDS = {
  'nigerian-news': [
    'https://www.premiumtimesng.com/feed','https://www.vanguardngr.com/feed/','https://guardian.ng/feed/','https://punchng.com/feed/','https://www.thisdaylive.com/feed/','https://www.channelstv.com/feed/','https://www.arise.tv/feed/','https://www.thecable.ng/feed','https://saharareporters.com/rss.xml','https://www.premiumtimesng.com/rss.xml','https://news.google.com/rss/search?q=Nigeria%20news&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  politics: [
    'https://rss.punchng.com/v1/category/politics','https://www.vanguardngr.com/category/politics/feed/','https://guardian.ng/category/news/politics/feed/','https://www.thisdaylive.com/index.php/category/politics/feed/','https://www.premiumtimesng.com/category/news/politics/feed','https://www.thecable.ng/category/politics/feed','https://news.google.com/rss/search?q=Nigeria%20politics&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml','https://www.aljazeera.com/xml/rss/all.xml','https://www.france24.com/en/rss','https://rss.dw.com/xml/rss-en-all','https://www.euronews.com/rss','https://www.theguardian.com/world/rss','https://feeds.nbcnews.com/nbcnews/public/world','https://abcnews.go.com/abcnews/internationalheadlines','https://www.independent.co.uk/news/world/rss','https://feeds.skynews.com/feeds/rss/world.xml','https://news.google.com/rss/search?q=world%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  africa: [
    'https://feeds.bbci.co.uk/news/world/africa/rss.xml','https://www.aljazeera.com/xml/rss/all.xml','https://www.france24.com/en/africa/rss','https://www.theguardian.com/world/africa/rss','https://news.google.com/rss/search?q=Africa%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  europe: [
    'https://rss.dw.com/xml/rss-en-eu','https://www.euronews.com/rss','https://www.theguardian.com/world/europe/rss','https://www.france24.com/en/europe/rss','https://news.google.com/rss/search?q=Europe%20news&hl=en&gl=GB&ceid=GB%3Aen'
  ],
  asia: [
    'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511','https://www.scmp.com/rss/91/feed','https://www.japantimes.co.jp/feed/','https://www.thehindu.com/news/international/feeder/default.rss','https://news.google.com/rss/search?q=Asia%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  'middle-east': [
    'https://www.aljazeera.com/xml/rss/all.xml','https://www.france24.com/en/middle-east/rss','https://www.theguardian.com/world/middleeast/rss','https://news.google.com/rss/search?q=Middle%20East%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  'latin-america': [
    'https://www.theguardian.com/world/americas/rss','https://feeds.bbci.co.uk/news/world/latin_america/rss.xml','https://news.google.com/rss/search?q=Latin%20America%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  sports: [
    'https://www.completesports.com/feed','https://soccernet.ng/feed','https://feeds.bbci.co.uk/sport/rss.xml','https://www.theguardian.com/sport/rss','https://news.google.com/rss/search?q=sports%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  business: [
    'https://www.cnbc.com/id/10001147/device/rss/rss.html','https://feeds.bbci.co.uk/news/business/rss.xml','https://howwemadeitinafrica.com/feed','https://www.theguardian.com/business/rss','https://feeds.npr.org/1006/rss.xml','https://www.ft.com/?format=rss','https://news.google.com/rss/search?q=business%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  tech: [
    'https://techcabal.com/feed','https://techpoint.africa/feed','https://techcrunch.com/feed/','https://www.theverge.com/rss/index.xml','https://feeds.arstechnica.com/arstechnica/index','https://www.wired.com/feed/rss','https://news.google.com/rss/search?q=technology%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  crypto: [
    'https://cointelegraph.com/rss','https://decrypt.co/feed','https://www.coindesk.com/arc/outboundfeeds/rss/','https://news.google.com/rss/search?q=crypto%20bitcoin&hl=en&gl=US&ceid=US%3Aen'
  ],
  entertainment: [
    'https://variety.com/feed/','https://deadline.com/feed/','https://www.pulse.ng/entertainment/rss','https://www.hollywoodreporter.com/feed/','https://www.billboard.com/feed/','https://news.google.com/rss/search?q=entertainment%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  culture: [
    'https://www.bellanaija.com/feed','https://okayafrica.com/feed/','https://musicinafrica.net/feed','https://www.theguardian.com/culture/rss','https://news.google.com/rss/search?q=Africa%20culture&hl=en&gl=US&ceid=US%3Aen'
  ],
  lifestyle: [
    'https://wwd.com/fashion-news/feed/','https://www.theguardian.com/fashion/rss','https://skift.com/feed/','https://feeds.npr.org/1048/rss.xml','https://news.google.com/rss/search?q=lifestyle%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  science: [
    'https://www.nature.com/nature.rss','https://www.sciencenews.org/feed','https://scitechdaily.com/feed/','https://www.sciencedaily.com/rss/all.xml','https://feeds.npr.org/1007/rss.xml','https://news.google.com/rss/search?q=science%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  health: [
    'https://feeds.bbci.co.uk/news/health/rss.xml','https://www.theguardian.com/society/health/rss','https://www.statnews.com/feed/','https://feeds.npr.org/1128/rss.xml','https://news.google.com/rss/search?q=health%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  jobs: [
    'https://weworkremotely.com/remote-jobs.rss','https://reliefweb.int/jobs/rss.xml','https://remoteok.com/remote-jobs.rss','https://news.google.com/rss/search?q=jobs%20Nigeria&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  ghana: ['https://www.graphic.com.gh/rss.xml','https://www.myjoyonline.com/feed/','https://citinewsroom.com/feed','https://news.google.com/rss/search?q=Ghana%20news&hl=en&gl=GH&ceid=GH%3Aen'],
  kenya: ['https://www.standardmedia.co.ke/rss/kenya.php','https://www.tuko.co.ke/?service=rss','https://kbc.co.ke/feed','https://news.google.com/rss/search?q=Kenya%20news&hl=en&gl=KE&ceid=KE%3Aen'],
  'south-africa': ['https://www.news24.com/news24/rss','https://www.sowetanlive.co.za/rss/?publication=sowetan-live','https://news.google.com/rss/search?q=South%20Africa%20news&hl=en&gl=ZA&ceid=ZA%3Aen'],
  uk: ['https://feeds.bbci.co.uk/news/uk/rss.xml','https://www.theguardian.com/uk/rss','https://feeds.skynews.com/feeds/rss/home.xml','https://news.google.com/rss/search?q=UK%20news&hl=en-GB&gl=GB&ceid=GB%3Aen'],
  usa: ['https://rss.cnn.com/rss/edition.rss','https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml','https://www.pbs.org/newshour/feeds/rss/headlines','https://feeds.nbcnews.com/nbcnews/public/news','https://abcnews.go.com/abcnews/topstories','https://news.google.com/rss/search?q=US%20news&hl=en-US&gl=US&ceid=US%3Aen'],
  canada: ['https://www.cbc.ca/cmlink/rss-topstories','https://globalnews.ca/feed/','https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009','https://news.google.com/rss/search?q=Canada%20news&hl=en-CA&gl=CA&ceid=CA%3Aen'],
  australia: ['https://www.abc.net.au/news/feed/51120/rss.xml','https://www.smh.com.au/rss/feed.xml','https://www.theguardian.com/australia-news/rss','https://news.google.com/rss/search?q=Australia%20news&hl=en-AU&gl=AU&ceid=AU%3Aen'],
  india: ['https://timesofindia.indiatimes.com/rssfeedstopstories.cms','https://www.thehindu.com/news/national/feeder/default.rss','https://www.ndtv.com/rss','https://news.google.com/rss/search?q=India%20news&hl=en-IN&gl=IN&ceid=IN%3Aen'],
  china: ['https://www.scmp.com/rss/91/feed','https://news.google.com/rss/search?q=China%20news&hl=en&gl=US&ceid=US%3Aen'],
  japan: ['https://www.japantimes.co.jp/feed/','https://news.google.com/rss/search?q=Japan%20news&hl=en&gl=JP&ceid=JP%3Aen'],
  brazil: ['https://news.google.com/rss/search?q=Brazil%20news&hl=en&gl=BR&ceid=BR%3Aen'],
  mexico: ['https://news.google.com/rss/search?q=Mexico%20news&hl=en&gl=MX&ceid=MX%3Aen']
};

const aliases = { nigerian:'nigerian-news', nigeria:'nigerian-news', latest:'nigerian-news', global:'world', international:'world' };
const labels = Object.fromEntries(Object.keys(FEEDS).map(k => [k, k.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())]));
labels['nigerian-news']='Nigeria'; labels.tech='Technology'; labels.usa='USA'; labels.uk='UK'; labels.ghana='Ghana'; labels.kenya='Kenya'; labels['south-africa']='South Africa'; labels['middle-east']='Middle East'; labels['latin-america']='Latin America';
const countryByCategory = { 'nigerian-news':'Nigeria', politics:'Nigeria', ghana:'Ghana', kenya:'Kenya', 'south-africa':'South Africa', uk:'UK', usa:'USA', canada:'Canada', australia:'Australia', india:'India', china:'China', japan:'Japan', brazil:'Brazil', mexico:'Mexico', world:'Global', africa:'Africa', europe:'Europe', asia:'Asia', 'middle-east':'Middle East', 'latin-america':'Latin America', sports:'Global', business:'Global', tech:'Global', crypto:'Global', entertainment:'Global', culture:'Africa', lifestyle:'Global', science:'Global', health:'Global', jobs:'Global' };

const cleanText = (value, max=4000) => String(value||'').replace(/<!\[CDATA\[/gi,'').replace(/\]\]>/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&/gi,'&').replace(/"/gi,'"').replace(/&#39;|'/gi,"'").replace(/</gi,'<').replace(/>/gi,'>').replace(/\s+/g,' ').trim().slice(0,max);
const decodeXml = value => cleanText(value,12000);
function firstTag(block,tags){ for(const tag of tags){ const m=String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i')); if(m?.[1]) return m[1]; } return ''; }
function firstAttr(block,tags,attr){ for(const tag of tags){ const m=String(block).match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`,'i')); if(m?.[1]) return decodeXml(m[1]); } return ''; }
function parseXmlFeed(xml){
  const items=[]; const matches=[...String(xml||'').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  for(const match of matches){ const block=match[2]; const title=decodeXml(firstTag(block,['title'])); const link=decodeXml(firstTag(block,['link']))||firstAttr(block,['link'],'href'); const guid=decodeXml(firstTag(block,['guid','id'])); const description=firstTag(block,['content:encoded','content','description','summary']); const pubDate=decodeXml(firstTag(block,['pubDate','published','updated','dc:date'])); const author=decodeXml(firstTag(block,['dc:creator','author','creator'])); const source=decodeXml(firstTag(block,['source'])); const enclosure=firstAttr(block,['enclosure','media:content','media:thumbnail'],'url'); const image=enclosure||decodeXml(String(description||'').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]||''); if(title&&(link||guid)) items.push({title,link:link||guid,guid,description,pubDate,author,source,image}); }
  return {title:decodeXml(firstTag(String(xml||''),['title'])),items};
}
async function readFeed(url){ try{ const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; RealSSA-News/2.1; +https://realssanews.com.ng)',Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'},signal:AbortSignal.timeout(7000)}); if(!response.ok) throw new Error(`HTTP ${response.status}`); const feed=parseXmlFeed(await response.text()); if(!feed.items.length) throw new Error('no RSS items'); return feed; }catch(error){ console.warn(`[Vercel News] ${url}: ${error?.message||error}`); return null; } }
function publishedDate(item){ const d=new Date(item.pubDate||Date.now()); return Number.isNaN(d.getTime())?new Date():d; }
function getImage(item){ if(/^https?:\/\//i.test(String(item.image||''))) return item.image; return String(item.description||'').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]||'https://realssanews.com.ng/logo.png'; }
const crypto = require('crypto');
const BLOCKED_HOSTS = new Set([
  'espn.com','skysports.com','dailymaverick.co.za','edition.cnn.com'
]);
function hostOf(link){
  try { return new URL(link).hostname.replace(/^www\./,'').toLowerCase(); }
  catch { return ''; }
}
function isBlockedLink(link){
  const host = hostOf(link);
  if (!host) return true;
  for (const blocked of BLOCKED_HOSTS) {
    if (host === blocked || host.endsWith('.' + blocked)) return true;
  }
  return false;
}
function stableArticleId(link){
  return 'rss-' + crypto.createHash('sha1').update(String(link)).digest('hex').slice(0, 16);
}
async function collect(category){ const normalized=aliases[category]||category; const urls=FEEDS[normalized]||FEEDS['world']; const feeds=await Promise.all(urls.map(readFeed)); const articles=[]; const seen=new Set(); feeds.forEach((feed,feedIndex)=>{ if(!feed) return; for(const item of feed.items.slice(0,25)){ const link=String(item.link||item.guid||'').trim(); const title=cleanText(item.title,500); if(!link||!title||seen.has(link)) continue; if(isBlockedLink(link)) continue; if(!/^https?:\/\//i.test(link)) continue; seen.add(link); const date=publishedDate(item); const excerpt=cleanText(item.description||title,1000); const fallback=urls[feedIndex]?new URL(urls[feedIndex]).hostname.replace(/^www\./,''):'RSS'; articles.push({id:stableArticleId(link),title,excerpt,description:excerpt,original_excerpt:cleanText(excerpt,4000),image:getImage(item),author:cleanText(item.author,200),source_name:cleanText(item.source||feed.title||fallback,200),external_link:link,externalLink:link,published_at:date.toISOString(),date:date.toISOString(),category:labels[normalized]||normalized,feed_category:normalized,country:countryByCategory[normalized]||'Global',content_type:'article',featured:false,is_featured:false}); } }); return articles.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at)); }
async function collectCombined(categories){ const batches=await Promise.all(categories.map(c=>collect(c).catch(e=>{console.error(`[Vercel News] ${c}`,e?.message||e);return [];}))); const seen=new Set(); return batches.flat().filter(a=>{if(seen.has(a.external_link))return false;seen.add(a.external_link);return true;}).sort((a,b)=>new Date(b.published_at)-new Date(a.published_at)); }

module.exports=async function handler(req,res){ if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'}); try{ const rawPath=String(req.url||'').split('?')[0]; const isLegacy=/^\/news-feed\/?$/i.test(rawPath); const isForYou=/^\/api\/feed\/foryou\/?$/i.test(rawPath); const match=rawPath.match(/^\/api\/news\/([^/]+)\/?$/i); const category=match?decodeURIComponent(match[1]).toLowerCase():''; const allCategories=Object.keys(FEEDS); let articles; if(isLegacy||isForYou||category==='breaking'||category==='latest'||!category) articles=await collectCombined(allCategories); else articles=await collect(category); const requested=Number(req.query?.limit||100); const limit=Math.min(Math.max(Number.isFinite(requested)?requested:100,1),200); const result=articles.slice(0,limit); res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300'); if(isLegacy) return res.status(200).json(result); return res.status(200).json({articles:result,nextCursor:null,hasMore:result.length<articles.length,source:'rss-live-network',category:category||(isForYou?'foryou':'latest'),totalAvailable:articles.length}); }catch(error){ console.error('[Vercel News] handler failed:',error); const isLegacy=/^\/news-feed\/?$/i.test(String(req.url||'').split('?')[0]); if(isLegacy)return res.status(200).json([]); return res.status(200).json({articles:[],nextCursor:null,hasMore:false,source:'rss-live-network',error:'News temporarily unavailable'}); } };
