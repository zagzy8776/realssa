const { getHomeArticles } = require('./home-feed');

const DAY = 24 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const articles = await getHomeArticles();
    const withImage = articles.filter(a => a.image && !/(logo|icon|placeholder|favicon)/i.test(a.image));
    // Hero should be fresh: prefer the last 3 days, widen to 14 days only if too few.
    const within = (days) => withImage.filter(a => Date.now() - new Date(a.date).getTime() <= days * DAY);
    let featured = within(3);
    if (featured.length < 3) featured = within(14);
    featured = featured.slice(0, 8);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(featured);
  } catch (error) {
    console.error('[Home Featured] failed:', error);
    return res.status(200).json([]);
  }
};
