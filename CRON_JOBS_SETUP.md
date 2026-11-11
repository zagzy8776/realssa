# 🕐 RealSSA News - Complete Cron Jobs Setup

## Current Setup (cron-job.org)

You have **13 existing cron jobs** for RSS ingestion. Now adding **1 new job** for AI summarization.

---

## ⚠️ FIXING FAILING JOBS

I see all your cron jobs are showing **"Failed (HTTP error)"**. This is likely because:

### Issue 1: Wrong Secret Format
Your cron URLs use: `secret=realssa-cron-secret-2026`

But Vercel environment variable might be different. Let's verify:
- Check Vercel → Settings → Environment Variables
- Find `CRON_SECRET`
- Make sure it matches exactly: `realssa-cron-secret-2026`

### Issue 2: Endpoint Not Deployed
The `/api/cron/ingest` endpoint might not be deployed on Vercel.

**Quick Test:**
```bash
# Test if endpoint exists:
curl "https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=realssa-cron-secret-2026"
```

**Expected Response (if working):**
```json
{"success": true, "newCount": 5, "summaryCount": 0, "category": "sports"}
```

**If you get 401/403:** Wrong secret
**If you get 404:** Endpoint not deployed
**If you get 500:** Server error (check Vercel logs)

---

## 📋 Complete Cron Jobs List

### Existing Jobs (13 - RSS Ingestion)

All run **every 30 minutes** with staggered timing:

| # | Category | URL | Schedule |
|---|----------|-----|----------|
| 1 | Crypto | `https://www.realssanews.com.ng/api/cron/ingest?category=crypto&secret=realssa-cron-secret-2026` | Every 30 min |
| 2 | Culture | `https://www.realssanews.com.ng/api/cron/ingest?category=culture&secret=realssa-cron-secret-2026` | Every 30 min |
| 3 | Entertainment | `https://www.realssanews.com.ng/api/cron/ingest?category=entertainment&secret=realssa-cron-secret-2026` | Every 30 min |
| 4 | Ghana | `https://www.realssanews.com.ng/api/cron/ingest?category=ghana&secret=realssa-cron-secret-2026` | Every 30 min |
| 5 | Jobs | `https://www.realssanews.com.ng/api/cron/ingest?category=jobs&secret=realssa-cron-secret-2026` | Every 30 min |
| 6 | Kenya | `https://www.realssanews.com.ng/api/cron/ingest?category=kenya&secret=realssa-cron-secret-2026` | Every 30 min |
| 7 | Nigerian News | `https://www.realssanews.com.ng/api/cron/ingest?category=nigerian-news&secret=realssa-cron-secret-2026` | Every 30 min |
| 8 | Sports | `https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=realssa-cron-secret-2026` | Every 30 min |
| 9 | South Africa | `https://www.realssanews.com.ng/api/cron/ingest?category=south-africa&secret=realssa-cron-secret-2026` | Every 30 min |
| 10 | UK | `https://www.realssanews.com.ng/api/cron/ingest?category=uk&secret=realssa-cron-secret-2026` | Every 30 min |
| 11 | USA | `https://www.realssanews.com.ng/api/cron/ingest?category=usa&secret=realssa-cron-secret-2026` | Every 30 min |
| 12 | World | `https://www.realssanews.com.ng/api/cron/ingest?category=world&secret=realssa-cron-secret-2026` | Every 30 min |
| 13 | Streams | `https://www.realssanews.com.ng/api/cron/streams?secret=realssa-cron-secret-2026` | Every 30 min |

---

## ⭐ NEW Job #14: AI Summarization

**Add this NEW cron job on cron-job.org:**

### Configuration:
- **Title**: `RealSSA - AI Summarization`
- **URL**: `https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026`
- **Schedule**: Every hour at :00 (`0 * * * *`)
- **Method**: GET
- **Timeout**: 60 seconds

### Why Every Hour (not 30 min)?
- Processes 10 articles × 5 seconds = 50 seconds
- Needs longer execution time
- Runs AFTER ingestion jobs complete

---

## 🔧 Staggered Schedule Strategy

To avoid hitting Vercel simultaneously (causing timeouts), stagger your jobs:

### Minute :00 (Top of Hour)
- Nigerian News
- AI Summarization ⭐ NEW

### Minute :02
- Ghana
- Kenya

### Minute :04
- Sports
- UK

### Minute :06
- USA
- World

### Minute :08
- Crypto
- Culture

### Minute :10
- Entertainment
- Jobs

### Minute :12
- South Africa
- Streams

### Minute :30 (Half Hour)
- Repeat cycle

**Why Stagger?**
- Vercel free tier has concurrent execution limits
- Prevents "cold start" delays
- Reduces database connection spikes
- Better overall performance

---

## 🚀 Updated Cron Schedule

Edit each job on cron-job.org to use these schedules:

| Job | New Schedule | Cron Expression |
|-----|--------------|-----------------|
| Nigerian News | :00 and :30 | `0,30 * * * *` |
| **AI Summarization** ⭐ | **:00 only** | `0 * * * *` |
| Ghana | :02 and :32 | `2,32 * * * *` |
| Kenya | :04 and :34 | `4,34 * * * *` |
| Sports | :06 and :36 | `6,36 * * * *` |
| UK | :08 and :38 | `8,38 * * * *` |
| USA | :10 and :40 | `10,40 * * * *` |
| World | :12 and :42 | `12,42 * * * *` |
| Crypto | :14 and :44 | `14,44 * * * *` |
| Culture | :16 and :46 | `16,46 * * * *` |
| Entertainment | :18 and :48 | `18,48 * * * *` |
| Jobs | :20 and :50 | `20,50 * * * *` |
| South Africa | :22 and :52 | `22,52 * * * *` |
| Streams | :24 and :54 | `24,54 * * * *` |

---

## ✅ Verification Steps

### Step 1: Test Manually First

Before setting up cron jobs, test each endpoint manually:

```bash
# Test ingestion (pick any category)
curl "https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=realssa-cron-secret-2026"

# Test AI summarization (NEW)
curl "https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026"
```

**If 401 Unauthorized:**
- Your `CRON_SECRET` in Vercel doesn't match
- Go to Vercel → Settings → Environment Variables
- Check exact value of `CRON_SECRET`

**If 404 Not Found:**
- Endpoint not deployed
- Push code to GitHub
- Vercel will auto-deploy

**If 500 Server Error:**
- Check Vercel function logs
- Likely database connection issue

---

## 🐛 Common Issues & Fixes

### All Jobs Failing with HTTP Error

**Cause 1: Wrong Secret**
```bash
# Test with wrong secret (should get 401)
curl "https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=wrong"

# Output: {"error":"Unauthorized"}
```

**Fix:** Update `CRON_SECRET` in Vercel or update all cron job URLs

---

**Cause 2: Endpoint Not Deployed**
```bash
# Test if endpoint exists
curl -I "https://www.realssanews.com.ng/api/cron/ingest"

# If 404: Not deployed
# If 401: Deployed but missing secret (good!)
```

**Fix:** 
```bash
git add .
git commit -m "Deploy cron endpoints"
git push origin main
```

---

**Cause 3: Vercel Timeout (10s)**

If ingestion takes >10 seconds, Vercel kills it.

**Fix:** Already implemented in your code:
```javascript
// In ingestion.js - already limits to 2 feeds per category
const randomFeeds = (feeds || []).sort(() => 0.5 - Math.random()).slice(0, 2);
```

---

**Cause 4: Database Connection**

```bash
# Check Vercel logs for:
# "❌ Database connection failed"
```

**Fix:** Verify `DATABASE_URL` in Vercel env vars matches your Neon connection string

---

## 📊 Expected Results After Setup

### First Hour:
- ✅ 13 ingestion jobs run (staggered over 30 min)
- ✅ 1 AI summarization job runs (at :00)
- ✅ 10 articles get AI summaries

### After 24 Hours:
- ✅ 312 ingestion runs (13 categories × 2 runs/hour × 12 hours)
- ✅ 24 AI summarization runs
- ✅ 240 articles with AI summaries

### After 1 Week:
- ✅ All categories have fresh content
- ✅ 1,680+ articles with AI summaries
- ✅ Fully automated - no admin work

---

## 🎯 Quick Action Plan

### Right Now (5 minutes):

1. **Test one cron endpoint manually:**
   ```bash
   curl "https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=realssa-cron-secret-2026"
   ```

2. **If it works (200 OK):**
   - Your cron jobs will work too
   - No changes needed to existing jobs
   - Just add the NEW AI summarization job

3. **If it fails (401/404/500):**
   - Check Vercel logs
   - Verify CRON_SECRET
   - Push latest code

### Add AI Summarization Job (2 minutes):

On cron-job.org:
1. Click **"Create Cronjob"**
2. Title: `RealSSA - AI Summarization`
3. URL: `https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026`
4. Schedule: `0 * * * *` (every hour at :00)
5. Save → Done!

---

## 📱 Monitoring Dashboard

### cron-job.org:
- ✅ Green = Job executed successfully
- ❌ Red = Job failed (click "History" to see error)

### Vercel Dashboard:
- Go to: Functions → `/api/cron/summarize`
- Check execution logs
- Look for: `✅ Summarization job complete`

### Neon Dashboard:
- Check: Database → Activity
- Should see INSERT and UPDATE queries every hour

---

## 🎉 Success Indicators

You'll know it's working when:

- ✅ All 14 cron jobs show green checkmarks on cron-job.org
- ✅ Vercel logs show successful executions
- ✅ Database `rss_articles` table is growing
- ✅ `ai_summary` column is being populated
- ✅ Your website shows branded AI summaries instead of raw RSS

---

**Need Help?**
1. Check cron-job.org execution history (click "HISTORY" on any job)
2. Check Vercel function logs
3. Test endpoints manually with curl
4. Verify environment variables match

---

**Last Updated:** July 8, 2026  
**Status:** Ready to add Job #14 (AI Summarization)
