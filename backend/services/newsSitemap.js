/**
 * Google News sitemap builder.
 * Emits a valid <urlset> with the news:news namespace, a 48-hour window and a
 * hard cap of 1,000 URLs (Google News limit).
 */

const DEFAULT_SITE = 'https://www.realssanews.com.ng';
const DEFAULT_MAX_AGE_HOURS = 48;
const DEFAULT_LIMIT = 1000;

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Array<{id,title,published_at,category,image}>} rows
 * @param {{site?: string, limit?: number, maxAgeHours?: number, now?: number}} [options]
 * @returns {string} XML document
 */
function buildNewsSitemap(rows, options = {}) {
  const site = options.site || DEFAULT_SITE;
  const limit = Math.min(Number(options.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT);
  const maxAgeHours = Number(options.maxAgeHours) || DEFAULT_MAX_AGE_HOURS;
  const now = options.now || Date.now();
  const cutoff = now - maxAgeHours * 60 * 60 * 1000;

  const entries = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const published = toDate(row && (row.published_at || row.date || row.pubDate));
      if (!published) return null;
      if (published.getTime() < cutoff) return null;
      if (published.getTime() > now + 10 * 60 * 1000) return null; // ignore future timestamps
      const id = row.id != null ? String(row.id) : '';
      const title = row.title != null ? String(row.title).trim() : '';
      if (!id || !title) return null;
      const modified = toDate(row.updated_at || row.modified_at || row.date_modified) || published;
      return { row, published, modified, id, title };
    })
    .filter(Boolean)
    .sort((a, b) => b.published.getTime() - a.published.getTime())
    .slice(0, limit);

  const urls = entries.map(({ row, published, modified, id, title }) => {
    const iso = published.toISOString();
    const modifiedIso = modified.toISOString();
    const external = typeof row.external_link === 'string' && /^https?:\/\//i.test(row.external_link)
      ? row.external_link
      : null;
    const loc = external || `${site}/article/${encodeURIComponent(id)}`;
    const image = typeof row.image === 'string' && /^https?:\/\//i.test(row.image) ? row.image : '';
    const keywords = row.category ? `\n      <news:keywords>${xmlEscape(row.category)}</news:keywords>` : '';
    const imageBlock = image
      ? `\n    <image:image>\n      <image:loc>${xmlEscape(image)}</image:loc>\n      <image:title>${xmlEscape(title)}</image:title>\n    </image:image>`
      : '';
    return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${modifiedIso}</lastmod>
    <news:news>
      <news:publication>
        <news:name>RealSSA News</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${iso}</news:publication_date>
      <news:title>${xmlEscape(title)}</news:title>${keywords}
    </news:news>${imageBlock}
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;
}

module.exports = { buildNewsSitemap, xmlEscape, DEFAULT_LIMIT, DEFAULT_MAX_AGE_HOURS };
