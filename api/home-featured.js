const { getHomeArticles } = require('./home-feed');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const articles = await getHomeArticles();
    const featured = articles.filter(a => a.image && !/(logo|icon|placeholder|favicon)/i.test(a.image)).slice(0, 8);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(featured);
  } catch (error) {
    console.error('[Home Featured] failed:', error);
    return res.status(200).json([]);
  }
};
