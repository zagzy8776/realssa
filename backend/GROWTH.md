# Growth worker

The worker adds image recovery, publisher-advertised feed discovery, title-based story clustering,
source-linked editorial context, SEO checks, Google Search Console/GA4 reporting and ranked distribution drafts.
No new package dependencies are required beyond the existing backend dependencies.

## Operation

Persistent RSS workers schedule a growth run every ten minutes. Set GROWTH_WORKER_ENABLED=false to disable.
Serverless deployments use an external scheduler: POST /api/growth/run with
Authorization: Bearer <GROWTH_ADMIN_TOKEN>. Allow 180 seconds for this endpoint.
GET /api/growth/report uses the same token and returns recent runs, country/language coverage and drafts.
Set a private random GROWTH_ADMIN_TOKEN; there is no built-in default.

Schema creation is idempotent on first run. PostgreSQL advisory locks prevent overlapping workers.
Image attempts retry after 15 minutes, doubling up to 24 hours; successful images are checked again after three days.
Each image/feed/SEO stage has a 20-second soft budget; an in-flight request can exceed that budget.
Runs retain their reports for 30 days. Child records are removed when their source articles expire.
NEWS_RETENTION_DAYS and NEWS_MAX_ROWS remain the article-retention controls.

## Google connections

Set:
- GROWTH_SITE_URL (default https://www.realssanews.com.ng)
- GROWTH_SEARCH_CONSOLE_SITE (exact property, e.g. sc-domain:realssanews.com.ng)
- GROWTH_GA4_PROPERTY_ID (numeric property ID)
- GROWTH_GOOGLE_CLIENT_ID, GROWTH_GOOGLE_CLIENT_SECRET, GROWTH_GOOGLE_REFRESH_TOKEN

The OAuth account needs access to both properties and scopes:
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/analytics.readonly

For a temporary test, GROWTH_GOOGLE_ACCESS_TOKEN is also supported.
The report explicitly marks unconfigured integrations. Google errors never become zero-traffic results.
Search reports inspect the top 1,000 query/page rows over the last 28 complete days (three-day reporting delay).
The 3% CTR opportunity threshold is a heuristic, not a promised click forecast.
GA4 returns sessions and engaged sessions by page. Two sampled article URLs use URL Inspection.
Successful search reports are reused for six hours to limit API usage.

## Publishing behavior and limits

Verified discovered feeds join the main ingestion worker on its next cycle.
Image recovery checks payload MIME type and decoded dimensions and tries up to five publisher candidates.
Clustering is conservative title similarity within one category and 48 hours; it is not semantic fact checking.
The latest 300 stories are grouped, producing one distribution draft per group.
Source-linked excerpts and publication timelines appear on server-rendered article pages.
Drafts include UTM links and ranking based on views, source count and image availability.
Drafts are available through the report; the new worker does not automatically send them to social accounts.
Existing Buffer/Telegram scheduling remains in place.

Live database integration, publisher availability, Google authorization, deployment routing and traffic impact
must be checked after deployment. Unit tests use fixtures and mocked database/network calls.

Run: node --test backend/tests/feedImages.test.cjs backend/tests/growth.test.cjs

References:
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/analytics/devguides/reporting/data/v1/basics
