const { request } = require('./growthNetwork');
const { htmlImages, imageUrl } = require('./feedImages');
const logic = require('./growthLogic');
const { trafficReport } = require('./growthTraffic');

const SITE = process.env.GROWTH_SITE_URL || 'https://www.realssanews.com.ng';
const LOCK = 91634021;
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS growth_runs (id BIGSERIAL PRIMARY KEY, started_at TIMESTAMPTZ DEFAULT NOW(), finished_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'running', report JSONB)",
  "CREATE TABLE IF NOT EXISTS growth_images (article_id INTEGER PRIMARY KEY REFERENCES rss_articles(id) ON DELETE CASCADE, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ DEFAULT NOW(), checked_at TIMESTAMPTZ, error TEXT)",
  "CREATE TABLE IF NOT EXISTS growth_feeds (url TEXT NOT NULL, country TEXT NOT NULL, language TEXT, origin TEXT NOT NULL, healthy BOOLEAN, items INTEGER DEFAULT 0, failures INTEGER DEFAULT 0, checked_at TIMESTAMPTZ, next_check_at TIMESTAMPTZ DEFAULT NOW(), error TEXT, PRIMARY KEY(url,country))",
  "CREATE TABLE IF NOT EXISTS growth_stories (article_id INTEGER PRIMARY KEY REFERENCES rss_articles(id) ON DELETE CASCADE, cluster_id TEXT NOT NULL, context JSONB NOT NULL, draft JSONB, updated_at TIMESTAMPTZ DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS growth_stories_cluster ON growth_stories(cluster_id)",
  "CREATE INDEX IF NOT EXISTS growth_feeds_due ON growth_feeds(next_check_at)"
].join(';');
async function prepare(db) {
  await require('./ensureRssSchema').ensureRssSchema(db);
  await db.query(SCHEMA);
}
async function recoverImages(db, deadline, fetcher = request, inspect = body => require('sharp')(body, { limitInputPixels: 40000000 }).metadata()) {
  await db.query('INSERT INTO growth_images(article_id) SELECT id FROM rss_articles ON CONFLICT DO NOTHING');
  const { rows } = await db.query('SELECT a.*, g.attempts FROM growth_images g JOIN rss_articles a ON a.id=g.article_id WHERE g.next_attempt_at <= NOW() ORDER BY g.checked_at ASC NULLS FIRST, a.published_at DESC LIMIT 8');
  const result = { checked: 0, recovered: 0, failed: 0 };
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    let chosen = null, dimensions = null, lastError = 'No usable publisher image';
    const verify = async candidate => {
      try {
        const res = await fetcher(candidate, { maxBytes: 5 * 1024 * 1024 });
        if (res.status !== 200 || !/^image\//i.test(res.headers['content-type'] || ''))
          throw new Error('Image HTTP/MIME check failed');
        const metadata = await inspect(res.body);
        if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 60) throw new Error('Image too small');
        dimensions = metadata;
        return res.url;
      } catch (err) { lastError = err.message; return null; }
    };
    const current = imageUrl(row.image);
    if (current) chosen = await verify(current);
    if (!chosen && Date.now() < deadline) {
      try {
        const page = await fetcher(row.external_link);
        if (page.status !== 200) throw new Error('Publisher HTTP ' + page.status);
        for (const candidate of htmlImages(page.body.toString(), page.url).slice(0, 5)) {
          if (Date.now() >= deadline) break;
          chosen = await verify(candidate);
          if (chosen) break;
        }
      } catch (err) { lastError = err.message; }
    }
    result.checked++;
    if (chosen) {
      await db.query("UPDATE rss_articles SET image=$2,image_status='verified',image_checked_at=NOW(),image_width=$3,image_height=$4 WHERE id=$1",
        [row.id, chosen, dimensions.width, dimensions.height]);
      await db.query("UPDATE growth_images SET attempts=0,error=NULL,checked_at=NOW(),next_attempt_at=NOW()+INTERVAL '3 days' WHERE article_id=$1", [row.id]);
      result.recovered++;
    } else {
      const delay = Math.min(1440, 15 * 2 ** Math.min(row.attempts, 7));
      await db.query("UPDATE growth_images SET attempts=attempts+1,error=$2,checked_at=NOW(),next_attempt_at=NOW()+($3 * INTERVAL '1 minute') WHERE article_id=$1",
        [row.id, lastError.slice(0, 300), delay]);
      result.failed++;
    }
  }
  return result;
}
async function discoverFeeds(db, deadline, fetcher = request) {
  const registry = require('../data/world_feeds.json');
  const seeds = Object.entries(registry).flatMap(([country,data]) =>
    (data.urls || (data.url ? [data.url] : [])).map(url => ({url,country,language:data.language || null})));
  await db.query("INSERT INTO growth_feeds(url,country,language,origin) SELECT url,country,language,'registry' FROM jsonb_to_recordset($1::jsonb) AS x(url text,country text,language text) ON CONFLICT DO NOTHING", [JSON.stringify(seeds)]);
  const Parser = require('rss-parser');
  const parser = new Parser();
  const { rows } = await db.query('SELECT * FROM growth_feeds WHERE next_check_at <= NOW() ORDER BY checked_at ASC NULLS FIRST,country,url LIMIT 6');
  const result = { tested:0, healthy:0, discovered:0, failed:0 };
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    result.tested++;
    try {
      const response = await fetcher(row.url);
      if (response.status !== 200) throw new Error('Feed HTTP ' + response.status);
      const feed = await parser.parseString(response.body.toString());
      if (!feed.items?.length) throw new Error('Feed has no items');
      await db.query("UPDATE growth_feeds SET healthy=true,items=$3,language=COALESCE($4,language),failures=0,error=NULL,checked_at=NOW(),next_check_at=NOW()+INTERVAL '1 day' WHERE url=$1 AND country=$2",
        [row.url,row.country,feed.items.length,feed.language || null]);
      result.healthy++;
    } catch (err) {
      await db.query("UPDATE growth_feeds SET healthy=false,failures=failures+1,error=$3,checked_at=NOW(),next_check_at=NOW()+INTERVAL '6 hours' WHERE url=$1 AND country=$2",
        [row.url,row.country,err.message.slice(0,300)]);
      result.failed++;
    }
    if (Date.now() >= deadline) continue;
    try {
      const home = await fetcher(new URL(row.url).origin);
      if (home.status !== 200) continue;
      const $ = require('cheerio').load(home.body.toString());
      const discovered = [];
      $('link[rel="alternate"]').each((_,el) => {
        if (!/application\/(?:rss|atom)\+xml/i.test($(el).attr('type') || '')) return;
        try {
          const url = new URL($(el).attr('href'),home.url);
          if (['http:','https:'].includes(url.protocol)) discovered.push(url.href);
        } catch {}
      });
      for (const url of [...new Set(discovered)].slice(0,4)) {
        const inserted = await db.query("INSERT INTO growth_feeds(url,country,origin) VALUES($1,$2,'discovered') ON CONFLICT DO NOTHING",[url,row.country]);
        result.discovered += inserted.rowCount;
      }
    } catch { /* Homepage availability is independent of feed health. */ }
  }
  return result;
}
async function buildStories(db) {
  const { rows } = await db.query("SELECT id,url_hash,title,original_excerpt,source_name,external_link,published_at,category,image,view_count FROM rss_articles WHERE external_link IS NOT NULL AND published_at > NOW()-INTERVAL '48 hours' ORDER BY published_at DESC LIMIT 300");
  const groups = logic.clusterStories(rows);
  const records = [];
  for (const group of groups) {
    const context = logic.editorialContext(group);
    const id = logic.clusterId(group);
    const leader = [...group].sort((a,b) => Number(b.view_count || 0)-Number(a.view_count || 0))[0];
    for (const row of group) {
      records.push({ article_id: row.id, cluster_id: id, context,
        draft: row.id === leader.id ? logic.distributionDraft(row,SITE,context.sourceCount) : null });
    }
  }
  if (records.length) {
    await db.query('INSERT INTO growth_stories(article_id,cluster_id,context,draft) SELECT article_id,cluster_id,context,draft FROM jsonb_to_recordset($1::jsonb) AS x(article_id integer,cluster_id text,context jsonb,draft jsonb) ON CONFLICT(article_id) DO UPDATE SET cluster_id=EXCLUDED.cluster_id,context=EXCLUDED.context,draft=EXCLUDED.draft,updated_at=NOW()', [JSON.stringify(records)]);
    await db.query('UPDATE growth_stories SET draft=NULL WHERE draft IS NOT NULL AND article_id <> ALL($1::integer[])', [rows.map(r=>r.id)]);
  }
  return {articles:rows.length,clusters:groups.length,groupedDuplicates:rows.length-groups.length,editorialMode:'Source-linked excerpts and publication timeline'};
}
async function monitorSeo(db, deadline, fetcher = request) {
  const { rows } = await db.query('SELECT id FROM rss_articles ORDER BY published_at DESC LIMIT 4');
  const result = {pages:[],sitemaps:[],indexing:'See traffic.indexing for Search Console inspection results'};
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    const url = new URL('/article/rss-'+row.id,SITE).href;
    try {
      const response = await fetcher(url);
      const $ = require('cheerio').load(response.body.toString());
      const issues = [];
      if (response.status!==200) issues.push('http_'+response.status);
      if (!$('title').text().trim()) issues.push('missing_title');
      if (!$('meta[name="description"]').attr('content')) issues.push('missing_description');
      if ($('link[rel="canonical"]').attr('href')!==url) issues.push('canonical_mismatch');
      if (!$('meta[property="og:image"]').attr('content')) issues.push('missing_image');
      if (/noindex/i.test($('meta[name="robots"]').attr('content') || '')) issues.push('noindex');
      let schema=false;
      $('script[type="application/ld+json"]').each((_,el)=>{
        try {
          const parsed=JSON.parse($(el).text());
          const nodes=Array.isArray(parsed)?parsed:[parsed,...(parsed['@graph']||[])];
          if(nodes.some(n=>n?.['@type']==='NewsArticle')) schema=true;
        } catch { issues.push('invalid_json_ld'); }
      });
      if(!schema) issues.push('missing_article_schema');
      result.pages.push({url,status:response.status,issues});
    } catch(err) { result.pages.push({url,issues:[err.message]}); }
  }
  for(const path of ['/sitemap.xml','/news-sitemap.xml']) {
    if(Date.now()>=deadline) break;
    try {
      const response=await fetcher(new URL(path,SITE).href);
      const xml2js=require(require.resolve('xml2js',{paths:[require.resolve('rss-parser')]}));
      const parsed=await xml2js.parseStringPromise(response.body.toString());
      result.sitemaps.push({path,status:response.status,valid:response.status===200 && Boolean(parsed.urlset||parsed.sitemapindex)});
    } catch(err) { result.sitemaps.push({path,valid:false,error:err.message}); }
  }
  return result;
}
async function runGrowth(pool) {
  await prepare(pool);
  const db=await pool.connect();
  let locked=false,runId;
  try {
    locked=(await db.query('SELECT pg_try_advisory_lock($1) AS locked',[LOCK])).rows[0].locked;
    if(!locked) return {status:'already_running'};
    runId=(await db.query('INSERT INTO growth_runs DEFAULT VALUES RETURNING id')).rows[0].id;
    const report={};
    const stages={
      images:()=>recoverImages(db,Date.now()+20000),
      feeds:()=>discoverFeeds(db,Date.now()+20000),
      stories:()=>buildStories(db),
      seo:()=>monitorSeo(db,Date.now()+20000),
      traffic:async()=>{
        const recent=await db.query("SELECT report->'traffic' AS traffic FROM growth_runs WHERE finished_at > NOW()-INTERVAL '6 hours' AND report->'traffic' IS NOT NULL ORDER BY finished_at DESC LIMIT 1");
        if (recent.rows[0]?.traffic?.search?.status === 'ok') return recent.rows[0].traffic;
        const pages = (report.seo?.pages || []).map(p => p.url);
        return trafficReport(pages);
      }
    };
    for(const [name,action] of Object.entries(stages)) {
      try { report[name]=await action(); } catch(err) { report[name]={status:'error',error:err.message}; }
      await db.query('UPDATE growth_runs SET report=$2::jsonb WHERE id=$1',[runId,JSON.stringify(report)]);
    }
    const degraded = value => value && typeof value === 'object' &&
      (value.status === 'error' || value.failed > 0 || value.valid === false ||
       (Array.isArray(value.issues) && value.issues.length > 0) ||
       Object.values(value).some(child => typeof child === 'object' && degraded(child)));
    const status = degraded(report) ? 'partial' : 'complete';
    await db.query('UPDATE growth_runs SET finished_at=NOW(),status=$2 WHERE id=$1',[runId,status]);
    await db.query("DELETE FROM growth_runs WHERE started_at < NOW()-INTERVAL '30 days'");
    return {runId,status,report};
  } catch(err) {
    if(runId) await db.query("UPDATE growth_runs SET status='failed',finished_at=NOW() WHERE id=$1",[runId]).catch(()=>{});
    throw err;
  } finally {
    if(locked) await db.query('SELECT pg_advisory_unlock($1)',[LOCK]).catch(()=>{});
    db.release();
  }
}
async function growthReport(pool) {
  await prepare(pool);
  const runs=await pool.query('SELECT * FROM growth_runs ORDER BY started_at DESC LIMIT 5');
  const coverage=await pool.query('SELECT country,language,COUNT(*)::int AS feeds,COUNT(*) FILTER(WHERE healthy)::int AS healthy,COUNT(*) FILTER(WHERE checked_at IS NULL)::int AS untested FROM growth_feeds GROUP BY country,language ORDER BY country,language');
  const drafts=await pool.query("SELECT draft FROM growth_stories WHERE draft IS NOT NULL AND updated_at > NOW()-INTERVAL '1 hour' ORDER BY (draft->>'priority')::numeric DESC LIMIT 30");
  return {runs:runs.rows,coverage:coverage.rows,distributionDrafts:drafts.rows.map(r=>r.draft)};
}
module.exports={prepare,runGrowth,growthReport,recoverImages,discoverFeeds,buildStories,monitorSeo};
