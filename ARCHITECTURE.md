# RealSSA News — Architecture Specification

**Version**: 1.0  
**Last Updated**: 2024-11-24  
**Purpose**: Single source of truth for all agents working on this codebase. Read before every task.

---

## 1. Caching & Vary Headers

### 1.1 Article Routes (`/article/:id`)
- **Vary Header**: `Vary: User-Agent` — **REQUIRED** to prevent bot/human cache collision
- **Cache-Control**: `public, s-maxage=60, stale-while-revalidate=600`
- **Googlebot-News**: Detected via `/googlebot-news/i.test(userAgent)`
- **Render Path**: Server-side pre-render in the `/article/:id` route in `backend/server.js`
- **Issue**: Without `Vary: User-Agent`, edge caches serve bot variant to humans and vice versa

### 1.2 Country Pages (`/country/:slug`)
- **Vary Header**: `Vary: User-Agent` — **REQUIRED**
- **Cache-Control**: `public, s-maxage=300, stale-while-revalidate=600`
- **Thin Content Guard**: < 3 headlines → `noindex, follow`
- **Schema**: Must include `Place` or `AdministrativeArea` JSON-LD

### 1.3 Sitemaps
- **Cache-Control**: `public, max-age=900, stale-while-revalidate=86400`
- **Location**: `/sitemap.xml` (index), `/news-sitemap.xml`, `/pages-sitemap.xml`

---

## 2. Status Codes & Soft 404s

### 2.1 Article Not Found
- **Current Bug**: `/(.*)` rewrite returns 200 for every URL
- **Fix**: Server-side check in `/article/:id` route
  - If article not in DB or JSON → `res.status(404)`
  - Do NOT fall through to SPA shell with 200

### 2.2 Country Pages
- Empty country hub → 200 with `noindex, follow` (not 404)
- Unknown slug → 404

---

## 3. hreflang & Internationalization

### 3.1 Current Bug
- All 195 country pages use `hreflang="en"` + `hreflang="x-default"`
- Google has no signal that `/country/nigeria` is for Nigeria

### 3.2 Fix
- **Country pages**: Use `hreflang="en-NG"` for Nigeria, `en-GH` for Ghana, etc.
- **Format**: `en-{ISO3166-1-alpha-2}` (e.g., `en-KE`, `en-ZA`, `en-GH`)
- **Fallback**: `x-default` points to home or region selector

### 3.3 Schema for Country Pages
```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "Nigeria",
  "sameAs": "https://www.realssanews.com.ng/country/nigeria",
  "containedInPlace": {
    "@type": "ContinentalLandmass",
    "name": "Africa"
  }
}
```

---

## 4. noindex Implementation

### 4.1 Server-Side Only
- **Rule**: `noindex` must be set in server headers, NOT client-side React
- **Reason**: Googlebot may miss client-side meta tags during initial crawl
- **Header**: `X-Robots-Tag: noindex, follow`

### 4.2 Thin Content Guard (Country Pages)
- **Trigger**: < 3 headlines in location hub
- **Action**: Server injects `X-Robots-Tag: noindex, follow`
- **Status Code**: 200 (not 404)

### 4.3 Article Pages
- **Default**: `index, follow`
- **Exception**: None (all published articles are indexable)

---

## 5. E-E-A-T Signals

### 5.1 Organization Schema
- **Type**: `NewsMediaOrganization`
- **Required Fields**:
  - `foundingDate`: "2023"
  - `areaServed`: ["Nigeria", "Ghana", "Kenya", "South Africa", "Africa"]
  - `ethicsPolicy`: URL to editorial guidelines
  - `correctionsPolicy`: URL to corrections page
  - `contactPoint`: Editorial contact info

### 5.2 Article Schema
- **Type**: `NewsArticle`
- **Required Fields**:
  - `author`: Organization or Person with URL
  - `publisher`: NewsMediaOrganization with logo
  - `datePublished`: ISO 8601
  - `mainEntityOfPage`: Canonical URL
  - `articleSection`: Category name

### 5.3 Author Attribution
- **Organization Author**: Use `@type: Organization` for editorial content
- **Individual Author**: Use `@type: Person` with `sameAs` social links
- **Byline**: Must appear in visible HTML (not just JSON-LD)

---

## 6. Cron & Automation

### 6.1 RSS Feed Fetcher
- **Schedule**: Every 15 minutes
- **Endpoint**: `/api/rss/fetch`
- **Categories**: news, sports, entertainment, tech, business, politics
- **Storage**: PostgreSQL `rss_articles` table

### 6.2 AI Summary Generator
- **Trigger**: After RSS article ingestion (fire-and-forget)
- **Endpoint**: `/api/ai/summary`
- **Timeout**: 30 seconds
- **Fallback**: Use original excerpt if AI fails

### 6.3 Freshness Score Update
- **Schedule**: Every 1 hour
- **Logic**: Decay score by 1% per hour since publication
- **Boost**: +10% for articles with reactions

---

## 7. Database Schema

### 7.1 rss_articles Table
```sql
CREATE TABLE rss_articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  original_excerpt TEXT,
  ai_summary TEXT,
  category VARCHAR(50) NOT NULL,
  image VARCHAR(500),
  source_name VARCHAR(100),
  external_link VARCHAR(500),
  published_at TIMESTAMP,
  content_type VARCHAR(20),
  is_featured BOOLEAN DEFAULT FALSE,
  freshness_score FLOAT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 source_credibility Table
```sql
CREATE TABLE source_credibility (
  source_name VARCHAR(100) PRIMARY KEY,
  credibility_score INT DEFAULT 70,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

### 7.3 article_entities Table
```sql
CREATE TABLE article_entities (
  article_id INT REFERENCES rss_articles(id),
  entity_name VARCHAR(200),
  entity_type VARCHAR(50),
  PRIMARY KEY (article_id, entity_name)
);
```

---

## 8. API Endpoints

### 8.1 Article Feed
- **GET** `/api/news/:category`
- **Query Params**: `page`, `limit`, `exclude` (comma-separated IDs)
- **Response**: `{ articles: [], pagination: {} }`
- **Cache**: `s-maxage=30, stale-while-revalidate=120`

### 8.2 Single Article
- **GET** `/api/articles/:id`
- **Cache**: `s-maxage=300`
- **Fallback**: JSON file if DB unavailable

### 8.3 Location Feed
- **GET** `/api/location-feed?name=:location`
- **Response**: `{ articles: [], location: string, hasCoverage: boolean, isThinContent: boolean }`
- **Cache**: `s-maxage=120, stale-while-revalidate=600`
- **noindex**: `X-Robots-Tag: noindex, follow` when `articles.length < 3`

---

## 9. Build & Deployment

### 9.1 Install Command
```bash
npm ci --only=production
```

### 9.2 Build Command
```bash
npm run build
```

### 9.3 Vercel Configuration
- **Function Timeout**: 180s for `/api/index.js`
- **Edge Caching**: Enabled via `Cache-Control` headers
- **Rewrites**: All routes → `/index.html` (SPA fallback)

---

## 10. Common Pitfalls

### 10.1 Cache Collision
- **Symptom**: Bot-optimized HTML served to humans
- **Cause**: Missing `Vary: User-Agent` header
- **Fix**: Add header to article and country routes

### 10.2 Soft 404s
- **Symptom**: 200 status for non-existent slugs
- **Cause**: SPA fallback catches all routes
- **Fix**: Server-side existence check before rendering

### 10.3 hreflang Confusion
- **Symptom**: Google shows wrong country page
- **Cause**: Generic `en` instead of `en-NG`, `en-GH`, etc.
- **Fix**: Use locale-specific tags per country

### 10.4 Client-Side noindex
- **Symptom**: Google indexes thin content pages
- **Cause**: React Helmet sets meta tag after JS load
- **Fix**: Server injects `X-Robots-Tag` header

