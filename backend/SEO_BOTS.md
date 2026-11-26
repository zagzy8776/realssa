# SEO Growth Bots

Four new bots push RealSSA into more areas, keep a self-learning autocomplete,
and generate sustained, auditable traffic. They live in `backend/services/`.

| Bot | File | What it does |
| --- | --- | --- |
| Area Expansion | `areaExpansionBot.js` | Registers every country (203 markets), African city, Nigerian state and category hub in `seo_areas`, then submits those landing pages to IndexNow (Bing, Yandex, Seznam, Naver) and pings sitemap directories (Google, Bing, Yandex, Seznam, Ping-O-Matic). |
| Autocomplete / Suggestion Seeding | `seoAutocomplete.js` | Merges branded phrases ("realssa news <query>"), editorial seeds, harvested headlines, rising queries and live Google/Bing/DuckDuckGo suggestions so the site always appears in the suggestion dropdown. Also probes how often engines surface "realssa" (`brand_hits`). |
| Traffic Bot | `trafficBot.js` | Walks areas: home → area page → hub → area-matched articles, dwells on each page, follows one internal link, records every request in `traffic_events`. Rotates least-recently-visited areas first. |
| Runner | `seoBotsRunner.js` | Schema bootstrap, advisory-locked stage runner, report and in-process scheduler. |

## Endpoints

```
GET  /api/autocomplete?q=lagos                 # legacy [q, [terms]] shape, branded terms first
GET  /api/search/suggest/v2?q=lagos             # { query, terms, site[], articles[] }
POST /api/search/suggest/click { term }         # learn from reader clicks
GET  /areas-sitemap.xml                         # area landing pages (in the sitemap index)

# Admin / cron (Bearer SEO_BOTS_TOKEN (or GROWTH_ADMIN_TOKEN/CRON_SECRET), or ?secret=)
GET  /api/seo-bots/report
GET  /api/seo-bots/areas?limit=100
GET  /api/seo-bots/autocomplete?q=lagos
POST /api/seo-bots/run            body: { stages: ["areas","suggestions","index","traffic","brand"], sessions: 6, limit: 100 }
GET  /api/cron/seo-bots?secret=<CRON_SECRET>&stages=areas,suggestions,index,traffic
```

Suggested external cron (cron-job.org or similar):

```
0 */3 * * *  /api/cron/seo-bots?secret=<CRON_SECRET>&stages=areas,suggestions,index
*/20 * * *  /api/cron/seo-bots?secret=<CRON_SECRET>&stages=traffic
0 */6 * * *  /api/cron/seo-bots?secret=<CRON_SECRET>&stages=brand
```

## Scheduling

On persistent hosts (Fly / Docker / local) the scheduler starts automatically
when `SEO_BOTS_ENABLED` is not `false`: maintenance every 3h, traffic every 20m,
brand probe every 6h. Serverless deployments must use the cron endpoints above.

## Tables created (idempotent)

- `seo_areas(slug, name, kind, country, language, path, keywords, score, indexed_at, index_status, last_traffic_at, …)`
- `search_suggestions(term, normalized, source, score, impressions, clicks, brand_hits, last_brand_check, …)`
- `traffic_events(area, path, status, dwell_ms, referrer, bot, created_at)`
- `traffic_bot_runs` / `seo_bot_runs` (report audits)

## Bounds (politeness)

- IndexNow: 100 URLs per call, per area re-checked every 7 days.
- Traffic: `maxSessions` (default 6) × ≤6 requests per session, 10s timeout per
  request, dwell `TRAFFIC_BOT_DWELL_MS` (default 1200ms).
- Suggestion engines: 3 endpoints, 1.4s timeout each, merged best-effort.
- Every stage is individually error-trapped; one failure never aborts a run.

## Honesty about search-engine autocomplete

Search engines personalise and region-lock their suggestion APIs, and no public
API can force a competitor-independent Google autocomplete entry. These bots:

1. serve RealSSA-branded suggestions in your own search UI (guaranteed), and
2. build and measure branded query demand (`brand_hits`, click learning) that
   genuinely improves brand search volume over time.

They do **not** promise a Google dropdown slot.

## Tests

```
node --test backend/tests/seoBots.test.cjs
node --test backend/tests/growth.test.cjs   # make sure nothing regressed
```