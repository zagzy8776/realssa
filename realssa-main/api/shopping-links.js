// Disclosed affiliate links for "Shop the story" modules.
// Configure with AFFILIATE_LINKS (JSON array) and optional AFFILIATE_TAG.
// The endpoint never invents products and returns an empty list when unset.

const MAX_ITEMS = 6;

function parseLinks() {
  const raw = process.env.AFFILIATE_LINKS;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('[Shopping Links] AFFILIATE_LINKS is not valid JSON:', error.message);
    return [];
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === 'https:';
  } catch {
    return false;
  }
}

function withAffiliateTag(rawUrl) {
  const tag = String(process.env.AFFILIATE_TAG || '').trim();
  if (!tag) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (!/amazon\./i.test(url.hostname)) return rawUrl;
    // Always use the site's tag so a copied merchant URL cannot credit another
    // affiliate account.
    url.searchParams.set('tag', tag);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function cleanText(value, max = 200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function shapeLink(link) {
  if (!link || !isHttpsUrl(link.url)) return null;

  return {
    title: cleanText(link.title, 160),
    url: withAffiliateTag(String(link.url)),
    merchant: cleanText(link.merchant || 'Partner', 80),
    price: cleanText(link.price, 40) || null,
    image: isHttpsUrl(link.image) ? String(link.image) : null,
    category: cleanText(link.category || 'entertainment', 40).toLowerCase(),
    tags: Array.isArray(link.tags)
      ? link.tags.map((tag) => cleanText(tag, 30).toLowerCase()).filter(Boolean).slice(0, 8)
      : [],
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let params;
  try {
    params = new URL(req.url, `https://${req.headers.host || 'www.realssanews.com.ng'}`).searchParams;
  } catch {
    params = new URLSearchParams();
  }

  const category = String(params.get('category') || 'entertainment').toLowerCase();
  const query = String(params.get('q') || '').toLowerCase().trim();
  const requested = Number(params.get('limit')) || MAX_ITEMS;
  const limit = Math.min(Math.max(requested, 1), MAX_ITEMS);

  const items = parseLinks()
    .map(shapeLink)
    .filter(Boolean)
    .filter((item) => !category || item.category === category)
    .filter((item) => {
      if (!query) return true;
      return `${item.title} ${item.tags.join(' ')} ${item.merchant}`
        .toLowerCase()
        .includes(query);
    })
    .slice(0, limit);

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    ok: true,
    enabled: items.length > 0,
    items,
    disclosure: 'Paid links. RealSSA News may earn a commission from purchases.',
  });
};
