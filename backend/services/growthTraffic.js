const { request } = require('./growthNetwork');
const { trafficOpportunities } = require('./growthLogic');
async function googleJson(url, token, body) {
  const res = await request(url, {
    method: 'POST', timeout: 10000,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.status !== 200) throw new Error('Google API returned HTTP ' + res.status);
  return JSON.parse(res.body.toString());
}
async function accessToken() {
  if (process.env.GROWTH_GOOGLE_REFRESH_TOKEN && process.env.GROWTH_GOOGLE_CLIENT_ID && process.env.GROWTH_GOOGLE_CLIENT_SECRET) {
    const res = await request('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: process.env.GROWTH_GOOGLE_REFRESH_TOKEN,
        client_id: process.env.GROWTH_GOOGLE_CLIENT_ID, client_secret: process.env.GROWTH_GOOGLE_CLIENT_SECRET
      }).toString()
    });
    if (res.status !== 200) throw new Error('Google token refresh failed: HTTP ' + res.status);
    return JSON.parse(res.body.toString()).access_token;
  }
  return process.env.GROWTH_GOOGLE_ACCESS_TOKEN;
}
async function trafficReport(pages = []) {
  const token = await accessToken();
  if (!token) return { status: 'not_configured', missing: 'Google OAuth credentials' };
  const output = {};
  const date = days => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  if (process.env.GROWTH_SEARCH_CONSOLE_SITE) {
    try {
      const data = await googleJson('https://www.googleapis.com/webmasters/v3/sites/' +
        encodeURIComponent(process.env.GROWTH_SEARCH_CONSOLE_SITE) + '/searchAnalytics/query', token, {
        startDate: date(30), endDate: date(3), dimensions: ['query', 'page'], rowLimit: 1000
      });
      output.search = { status: 'ok', sampledRows: data.rows?.length || 0,
        opportunities: trafficOpportunities(data.rows || []),
        note: 'Top API rows only. No impressions is not proof that a page is unindexed.' };
    } catch (err) { output.search = { status: 'error', error: err.message }; }
  } else output.search = { status: 'not_configured' };
  if (process.env.GROWTH_GA4_PROPERTY_ID) {
    try {
      if (!/^\d+$/.test(process.env.GROWTH_GA4_PROPERTY_ID)) throw new Error('Invalid GA4 property ID');
      const data = await googleJson('https://analyticsdata.googleapis.com/v1beta/properties/' +
        process.env.GROWTH_GA4_PROPERTY_ID + ':runReport', token, {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
        limit: '1000'
      });
      output.analytics = { status: 'ok', rows: data.rows || [] };
    } catch (err) { output.analytics = { status: 'error', error: err.message }; }
  } else output.analytics = { status: 'not_configured' };
  output.indexing = { status: 'not_configured' };
  if (process.env.GROWTH_SEARCH_CONSOLE_SITE) {
    output.indexing = { status: 'ok', pages: [] };
    for (const url of pages.slice(0, 2)) {
      try {
        const data = await googleJson('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', token, {
          inspectionUrl: url, siteUrl: process.env.GROWTH_SEARCH_CONSOLE_SITE
        });
        output.indexing.pages.push({ url, result: data.inspectionResult?.indexStatusResult });
      } catch (err) { output.indexing.pages.push({ url, error: err.message }); }
    }
  }
  return output;
}
module.exports = { trafficReport };
