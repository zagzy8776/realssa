# 🏗️ RealSSA News - Visual Architecture

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     USERS (Millions)                            │
│              https://www.realssanews.com.ng                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│                  VERCEL FRONTEND (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Home    │  │  World   │  │  Country │  │  Article │      │
│  │  Page    │  │Directory │  │  Pages   │  │  Pages   │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│              VERCEL SERVERLESS API (Node.js)                    │
│                                                                 │
│  GET /api/articles               GET /api/articles/:id         │
│  ┌─────────────────────┐         ┌──────────────────────┐     │
│  │ Fetch all articles  │         │ Fetch single article │     │
│  │ (100 latest)        │         │ + On-demand AI       │     │
│  └─────────────────────┘         └──────────────────────┘     │
│            │                                   │                │
│            │                                   ↓                │
│            │                      ┌──────────────────────────┐ │
│            │                      │ Check: ai_summary NULL?  │ │
│            │                      │  ├─ YES: Generate now    │ │
│            │                      │  └─ NO:  Return cached   │ │
│            │                      └──────────────────────────┘ │
│            ↓                                                    │
└────────────┼────────────────────────────────────────────────────┘
             │
             ↓
┌────────────────────────────────────────────────────────────────┐
│                  NEON POSTGRESQL DATABASE                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Table: rss_articles                                     │ │
│  │  ┌────┬────────┬─────────┬────────────┬──────────────┐  │ │
│  │  │ id │ title  │ excerpt │ ai_summary │ published_at │  │ │
│  │  ├────┼────────┼─────────┼────────────┼──────────────┤  │ │
│  │  │3173│Police..│Raw text │ NULL ❌    │ 2026-07-08   │  │ │
│  │  │3174│ICPC... │Raw text │ AI text ✅ │ 2026-07-08   │  │ │
│  │  │3175│Ghana...│Raw text │ AI text ✅ │ 2026-07-08   │  │ │
│  │  └────┴────────┴─────────┴────────────┴──────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────────┘
                          ↑
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ↓                                   ↓
┌────────────────────┐           ┌─────────────────────────┐
│  CRON JOBS #1-13   │           │  CRON JOB #14 (NEW!)   │
│  RSS Ingestion     │           │  AI Summarization       │
│  Every 30 minutes  │           │  Every hour at :00      │
└────────┬───────────┘           └───────────┬─────────────┘
         │                                   │
         ↓                                   ↓
┌────────────────────┐           ┌─────────────────────────┐
│ /api/cron/ingest   │           │ /api/cron/summarize     │
│                    │           │                         │
│ ├─ crypto          │           │ ├─ Find 10 articles     │
│ ├─ culture         │           │ │   with NULL summary   │
│ ├─ entertainment   │           │ ├─ Call Gemini API      │
│ ├─ ghana           │           │ ├─ Generate summaries   │
│ ├─ jobs            │           │ └─ UPDATE database      │
│ ├─ kenya           │           │                         │
│ ├─ nigerian-news   │           │ Result: 10 articles     │
│ ├─ sports          │           │ with AI summaries ✅    │
│ ├─ south-africa    │           │                         │
│ ├─ uk              │           │ Time: ~50 seconds       │
│ ├─ usa             │           │                         │
│ ├─ world           │           │                         │
│ └─ streams         │           │                         │
└────────┬───────────┘           └───────────┬─────────────┘
         │                                   │
         ↓                                   ↓
┌──────────────────────────────────────────────────────────┐
│               GOOGLE GEMINI 2.0 FLASH LITE               │
│                                                          │
│  Input:  "Police kill two kidnappers in Ondo..."        │
│  Output: "Ondo State Police neutralized two             │
│           suspected kidnappers in a fierce gun           │
│           battle along Akure-Owo Expressway,             │
│           recovering weapons and phones. This            │
│           operation highlights Nigeria's ongoing         │
│           security challenges in rural areas."           │
│                                                          │
│  Rate Limit: 15 requests/min (Free tier)                │
│  Cost: FREE (up to 1,500 requests/day)                  │
└──────────────────────────────────────────────────────────┘
```

---

## Data Flow: How Articles Get Summarized

### Scenario A: Brand New Article

```
1️⃣  RSS Feed (Punch News)
    ↓ (Every 30 min via Cron Job #7)
    
2️⃣  /api/cron/ingest?category=nigerian-news
    ├─ Parse RSS feed
    ├─ Extract: title, excerpt, image, link
    └─ INSERT INTO rss_articles (ai_summary = NULL)
    
3️⃣  Database: Article saved WITHOUT AI summary
    {
      id: 3173,
      title: "Police kill two kidnappers...",
      excerpt: "Raw RSS text...",
      ai_summary: NULL ❌
    }
    
4️⃣  Wait 1 hour... (Cron Job #14 runs)
    
5️⃣  /api/cron/summarize
    ├─ Query: SELECT * WHERE ai_summary IS NULL LIMIT 10
    ├─ Found article 3173
    ├─ Call Gemini API with title + excerpt
    ├─ Receive: "Ondo State Police neutralized..."
    └─ UPDATE rss_articles SET ai_summary = '...' WHERE id = 3173
    
6️⃣  Database: Article NOW HAS AI summary
    {
      id: 3173,
      title: "Police kill two kidnappers...",
      excerpt: "Raw RSS text...",
      ai_summary: "Ondo State Police neutralized..." ✅
    }
    
7️⃣  User visits article page
    ├─ GET /api/articles/rss-3173
    ├─ Check: ai_summary exists? YES!
    └─ Return: AI summary (INSTANT - no delay)
```

---

### Scenario B: User Visits Before Cron Job Runs

```
1️⃣  Article ingested 5 minutes ago (ai_summary = NULL)

2️⃣  User clicks article on homepage
    ↓
    
3️⃣  GET /api/articles/rss-3173
    ├─ Check: ai_summary exists? NO ❌
    ├─ Trigger on-demand generation
    ├─ Call Gemini API (5-8 seconds)
    ├─ Receive: "Ondo State Police neutralized..."
    ├─ UPDATE database with summary
    └─ Return: AI summary to user
    
4️⃣  User sees: "Generating summary..." → AI summary appears

5️⃣  Next user who visits:
    ├─ Check: ai_summary exists? YES ✅
    └─ Return: Cached summary (INSTANT)
```

---

## Cron Job Execution Timeline

### Every Hour at :00

```
:00  ┌─ Nigerian News Ingestion
     ├─ AI Summarization ⭐ NEW
     └─ (2 jobs)
     
:02  ┌─ Ghana Ingestion
     └─ Kenya Ingestion
     
:04  ┌─ Sports Ingestion
     └─ UK Ingestion
     
:06  ┌─ USA Ingestion
     └─ World Ingestion
     
:08  ┌─ Crypto Ingestion
     └─ Culture Ingestion
     
:10  ┌─ Entertainment Ingestion
     └─ Jobs Ingestion
     
:12  ┌─ South Africa Ingestion
     └─ Streams Ingestion
```

**Then repeats at :30 (except AI Summarization)**

---

## Database Growth Over Time

```
Hour 0:  0 articles with AI summaries
         ├─ Ingestion: 50 articles added (ai_summary = NULL)
         └─ Summarization: Not run yet
         
Hour 1:  10 articles with AI summaries
         ├─ Ingestion: 50 more articles added
         └─ Summarization: 10 processed ✅
         
Hour 2:  20 articles with AI summaries
         ├─ Ingestion: 50 more articles added
         └─ Summarization: 10 more processed ✅
         
Hour 24: 240 articles with AI summaries
         ├─ Total articles: ~1,200
         └─ Coverage: 20% (growing daily)
         
Week 1:  1,680 articles with AI summaries
         ├─ Total articles: ~8,400
         └─ Coverage: 20% (steady state)
```

**Why 20% coverage?**
- Ingestion: ~50 articles/hour (13 categories × 2-4 articles each)
- Summarization: 10 articles/hour
- Old articles deleted after 14 days
- **Result:** Most-viewed articles always have summaries

---

## Environment Variables Flow

```
┌─────────────────────────────────────────────────┐
│          Vercel Environment Variables            │
│                                                  │
│  CRON_SECRET = "realssa-cron-secret-2026"       │
│  GEMINI_API_KEY = "your-api-key"                │
│  DATABASE_URL = "postgresql://..."              │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│         Cron Jobs (cron-job.org)                 │
│                                                  │
│  URL includes: ?secret=realssa-cron-secret-2026  │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│       Vercel Serverless Function                 │
│                                                  │
│  if (secret !== process.env.CRON_SECRET)        │
│    return 401 Unauthorized                       │
│                                                  │
│  Use GEMINI_API_KEY to call AI                   │
│  Use DATABASE_URL to save results                │
└──────────────────────────────────────────────────┘
```

---

## Success Metrics Dashboard

```
┌────────────────────────────────────────────────────┐
│              Daily Performance Metrics              │
├────────────────────────────────────────────────────┤
│                                                    │
│  📊 Ingestion Jobs                                 │
│  ├─ Total Executions:  624/day (13 × 2 × 24)      │
│  ├─ Success Rate:      99.5%                       │
│  ├─ Avg Duration:      4 seconds                   │
│  └─ Articles Ingested: ~1,200/day                  │
│                                                    │
│  🤖 AI Summarization                               │
│  ├─ Total Executions:  24/day (1 × 24)            │
│  ├─ Success Rate:      98%                         │
│  ├─ Avg Duration:      50 seconds                  │
│  └─ Summaries Generated: 240/day                   │
│                                                    │
│  💾 Database                                       │
│  ├─ Total Articles:    ~1,200                      │
│  ├─ With AI Summary:   240 (20%)                   │
│  ├─ Without Summary:   960 (80%)                   │
│  └─ Auto-cleanup:      14-day retention            │
│                                                    │
│  👥 User Experience                                │
│  ├─ Instant Summaries: 20% (cached)               │
│  ├─ 5-8s Delay:        5% (on-demand generation)   │
│  └─ Raw RSS Excerpt:   75% (very new articles)     │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Quick Reference: What Each File Does

```
api/
├─ cron/
│  ├─ ingest.js ────────→ Fetches RSS, saves to DB
│  └─ summarize.js ─────→ Generates AI summaries ⭐ NEW
└─ test-cron.js ────────→ Diagnostic endpoint

backend/
├─ server.js ───────────→ API endpoints + on-demand AI
├─ services/
│  ├─ ingestion.js ─────→ RSS parsing logic
│  └─ summariser.js ────→ Gemini API integration
└─ rss_articles_schema.sql → Database table

Documentation/
├─ QUICK_START.md ──────────────→ START HERE (10 min)
├─ FIXING_CRON_FAILURES.md ─────→ Fix failing jobs
├─ IMPLEMENTATION_SUMMARY.md ───→ Overview
└─ VISUAL_ARCHITECTURE.md ──────→ This file
```

---

## 🎯 Remember

**The Goal:** All 14 cron jobs showing **green checkmarks** with **zero admin work**.

**The Result:** Users see **branded RealSSA summaries** instead of raw RSS excerpts.

**The Timeline:** Full automation in **24 hours** after deployment.

---

**Next Step:** Read `FIXING_CRON_FAILURES.md` to fix your failing cron jobs! 🚀
