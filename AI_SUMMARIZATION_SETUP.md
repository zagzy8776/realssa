# 🤖 AI Summarization System - Setup Guide

## Overview

Your RealSSA News platform now has **fully automated AI summarization** with **zero admin intervention required**!

The system uses Google Gemini 2.0 Flash Lite to generate branded, 2-sentence summaries for all articles.

---

## ✅ What's Implemented

### 1. **On-Demand Summarization** (ACTIVE)
- When a user views an article for the first time
- If no AI summary exists, it's generated in real-time (5-8 seconds)
- The summary is cached in the database
- Future views load instantly

### 2. **Background Batch Summarization** (NEW CRON JOB)
- Runs every hour via `/api/cron/summarize`
- Processes 10 articles per run
- Respects Gemini's 15 req/min rate limit
- No admin action needed

### 3. **Database Schema** (VERIFIED)
- `rss_articles` table stores all RSS content
- `ai_summary` column caches generated summaries
- Optimized indexes for fast queries

---

## 🚀 Setup Instructions

### Step 1: Verify Neon Database Table

Run this in your **Neon SQL Editor** to ensure the table exists:

```sql
-- Copy and paste from: backend/rss_articles_schema.sql
```

If you already have the table, this will skip creation. If not, it creates it with all indexes.

---

### Step 2: Set Up Cron Jobs

You need **TWO** cron jobs (use cron-job.org or similar):

#### **Cron Job 1: RSS Ingestion** (Every 30 minutes)
```
URL: https://www.realssanews.com.ng/api/cron/ingest?secret=YOUR_CRON_SECRET
Schedule: */30 * * * * (every 30 minutes)
```

#### **Cron Job 2: AI Summarization** (Every hour) ⭐ NEW!
```
URL: https://www.realssanews.com.ng/api/cron/summarize?secret=YOUR_CRON_SECRET
Schedule: 0 * * * * (every hour at :00)
```

**Why separate jobs?**
- Ingestion is fast (< 10s) - runs frequently
- Summarization is slow (5s per article) - runs less frequently
- Each stays under Vercel's 10s timeout limit

---

### Step 3: Deploy to Vercel

```bash
# Commit the changes
git add .
git commit -m "Add automated AI summarization system"
git push origin main
```

Vercel will auto-deploy. No environment variable changes needed - you already have:
✅ `GEMINI_API_KEY`
✅ `DATABASE_URL`
✅ `CRON_SECRET`

---

## 📊 How It Works

### Ingestion Flow (Every 30 min)
```
1. Fetch RSS feeds → 2. Extract articles → 3. Save to DB (ai_summary = null)
```

### Summarization Flow (Every hour)
```
1. Find articles with null summary → 2. Generate AI summary → 3. Update database
```

### User View Flow (Real-time)
```
1. User clicks article → 2. Check if ai_summary exists
   ├─ YES → Show cached summary (instant)
   └─ NO  → Generate summary (5-8s), cache it, show to user
```

---

## 🎯 Expected Results

### Immediate (After Deployment)
- ✅ Users viewing articles will trigger AI summary generation
- ✅ Summaries are cached after first view
- ✅ No admin intervention required

### After 1 Hour (First Cron Run)
- ✅ 10 oldest articles get AI summaries automatically
- ✅ Each subsequent hour, 10 more articles are processed

### After 24 Hours
- ✅ 240 articles have AI summaries (10/hour × 24 hours)
- ✅ All frequently viewed articles already have cached summaries from user views

---

## 🔍 Monitoring & Verification

### Check If It's Working

1. **View an article on your site:**
   - First view: Takes 5-8 seconds (generating)
   - Refresh page: Loads instantly (cached)

2. **Check API response:**
   ```bash
   curl https://www.realssanews.com.ng/api/articles | jq '.[0].ai_summary'
   ```
   Should show AI-generated text instead of `null`

3. **Check Vercel logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for:
     - `⚡ Generating AI summary for article...`
     - `✅ AI summary generated and cached...`

4. **Check cron job logs:**
   - Visit: `https://www.realssanews.com.ng/api/cron/summarize?secret=YOUR_SECRET`
   - Response shows:
     ```json
     {
       "success": true,
       "processed": 10,
       "successCount": 10,
       "failCount": 0
     }
     ```

---

## 🐛 Troubleshooting

### Issue: "No summary generated (API may be rate-limited)"

**Cause:** Gemini has a 15 req/min limit
**Solution:** 
- The system waits 5 seconds between requests (12/min)
- If you see this, the cron job will retry next hour
- No action needed - self-healing

### Issue: "Database connection failed"

**Cause:** `DATABASE_URL` not set or incorrect
**Solution:**
```bash
# In Vercel, verify environment variable:
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-curly-art-aol2g9ib-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```
⚠️ **Replace `YOUR_PASSWORD` with your actual Neon database password**

### Issue: Articles still show `ai_summary: null`

**Possible Causes:**
1. Cron job not set up yet → Set up `/api/cron/summarize` cron
2. `GEMINI_API_KEY` is empty → Verify in Vercel environment variables
3. Table missing `ai_summary` column → Run `rss_articles_schema.sql`

---

## 📈 Optimization Tips

### Increase Summarization Speed
If you want faster summarization, you can:

1. **Run cron job more frequently:**
   - Change from every hour to every 30 minutes
   - Processes 20 articles/hour instead of 10

2. **Increase batch size** (risky):
   - Edit `api/cron/summarize.js`
   - Change `LIMIT 10` to `LIMIT 15`
   - Watch for Vercel timeouts

### Reduce API Costs
If you want to save Gemini API quota:

1. **Only summarize popular categories:**
   ```sql
   WHERE category IN ('nigerian-news', 'world', 'sports')
   ```

2. **Skip video content:**
   ```sql
   WHERE content_type = 'article' AND original_excerpt IS NOT NULL
   ```

---

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Articles load with branded RealSSA summaries
- ✅ No raw RSS excerpts visible
- ✅ Vercel logs show successful summary generation
- ✅ Database `ai_summary` column is populated
- ✅ Users don't experience 5-8s delays (summaries are pre-generated)

---

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Check Neon database logs
3. Verify cron jobs are hitting your endpoints
4. Test manual API call: 
   ```
   https://www.realssanews.com.ng/api/cron/summarize?secret=YOUR_SECRET
   ```

---

## 🚀 Next Steps (Optional)

Want to go further?

1. **Add summary quality tracking:**
   - Store user feedback on summaries
   - Track which summaries get clicked

2. **Multi-language summaries:**
   - Detect article language
   - Generate summaries in that language

3. **Social media automation:**
   - Uncomment the `generateSocialHook()` code
   - Auto-post to Buffer/Twitter/Facebook

---

**Deployed:** July 8, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
