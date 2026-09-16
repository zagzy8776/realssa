module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const host = req.headers.host || 'www.realssanews.com.ng';
    const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const response = await fetch(`${protocol}://${host}/api/news/sports`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    const articles = await response.json();
    const featured = Array.isArray(articles) ? (articles[0] || null) : null;
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(featured);
  } catch (error) {
    console.error('[RealSSA Sports Featured] handler failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(null);
  }
};
