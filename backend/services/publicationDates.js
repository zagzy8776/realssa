function resolvePublicationDate(value, now = new Date()) {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return { date: parsed, source: 'source' };
  const fallback = now instanceof Date ? now : new Date(now);
  return { date: Number.isNaN(fallback.getTime()) ? new Date() : fallback, source: 'ingest_fallback' };
}

function articlePublicationDate(article, now = new Date()) {
  return resolvePublicationDate(article?.original_published_at || article?.source_published_at || article?.published_at || article?.date, now);
}

module.exports = { resolvePublicationDate, articlePublicationDate };
