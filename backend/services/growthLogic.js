const crypto = require('node:crypto');
const { imageUrl } = require('./feedImages');

function text(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(title) {
  return new Set(text(title).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
}
function similarity(a, b) {
  const x = tokens(a), y = tokens(b);
  if (x.size < 4 || y.size < 4) return text(a).toLowerCase() === text(b).toLowerCase() ? 1 : 0;
  const numbers = s => (s.match(/\b\d+\b/g) || []).sort().join(',');
  if (numbers(a) !== numbers(b)) return 0;
  const common = [...x].filter(t => y.has(t)).length;
  return common / new Set([...x, ...y]).size;
}
function clusterStories(rows) {
  const groups = [];
  for (const row of rows) {
    const group = groups.find(g => Math.abs(new Date(row.published_at) - new Date(g[0].published_at)) < 48 * 3600000 &&
      row.category === g[0].category && similarity(row.title, g[0].title) >= 0.7);
    if (group) group.push(row); else groups.push([row]);
  }
  return groups;
}
function clusterId(rows) {
  return crypto.createHash('sha256').update(String(rows[0].url_hash || rows[0].id)).digest('hex').slice(0, 24);
}
function editorialContext(rows) {
  const ordered = [...rows].sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
  return {
    method: 'source-excerpts',
    summary: ordered.map(r => text(r.original_excerpt)).filter(Boolean).slice(0, 3),
    timeline: ordered.map(r => ({
      publishedAt: r.published_at, headline: text(r.title),
      source: r.source_name, url: r.external_link
    })),
    sourceCount: new Set(rows.map(r => r.source_name || r.external_link)).size,
    background: 'Timeline entries show publication times, not independently verified event times.'
  };
}
function trafficOpportunities(rows) {
  return rows.filter(r => Number(r.impressions) >= 100 && Number(r.ctr) < 0.03)
    .map(r => ({
      query: r.keys?.[0], page: r.keys?.[1],
      impressions: Number(r.impressions), clicks: Number(r.clicks),
      ctr: Number(r.ctr), position: Number(r.position),
      estimatedClickGap: Math.max(0, Math.round(r.impressions * 0.03 - r.clicks)),
      action: 'Review headline, search intent, image and article depth'
    })).sort((a, b) => b.estimatedClickGap - a.estimatedClickGap).slice(0, 100);
}
function distributionDraft(row, site, sourceCount = 1) {
  const url = new URL('/article/rss-' + encodeURIComponent(row.id), site);
  url.searchParams.set('utm_source', 'owned-social');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', 'growth-stories');
  return {
    articleId: row.id, title: text(row.title), text: text(row.original_excerpt).slice(0, 240),
    image: imageUrl(row.image), url: url.href, sourceCount,
    priority: Number(row.view_count || 0) + sourceCount * 10 + (imageUrl(row.image) ? 5 : 0)
  };
}
module.exports = { text, similarity, clusterStories, clusterId, editorialContext, trafficOpportunities, distributionDraft };
