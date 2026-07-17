# 🚀 RealSSA News - Deployment Checklist

## Pre-Deployment Verification

### ✅ Environment Variables (Vercel Dashboard)

Check that these are set in **Vercel → Project → Settings → Environment Variables**:

- [ ] `DATABASE_URL` - Your Neon PostgreSQL connection string
- [ ] `GEMINI_API_KEY` - Google Gemini API key for AI summaries
- [ ] `CRON_SECRET` - Secret token for cron job authentication
- [ ] `JWT_SECRET` - Secret for admin JWT tokens
- [ ] `NODE_TLS_REJECT_UNAUTHORIZED` - Set to `0` (for government RSS feeds)

**Optional but recommended:**
- [ ] `VITE_ONESIGNAL_APP_ID` - For push notifications
- [ ] `BUFFER_S_TOKEN` - For social media automation
- [ ] `BUFFER_FILE_IDS` - Buffer profile IDs

---

### ✅ Database Setup (Neon)

1. **Login to Neon Dashboard**: https://console.neon.tech
2. **Open SQL Editor**
3. **Run these schemas in order:**

```sql
-- Step 1: Run backend/db_schema.sql (creates users, articles, comments tables)
-- Step 2: Run backend/rss_articles_schema.sql (creates rss_articles table)
```

4. **Verify tables exist:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

Expected output:
- `users`
- `articles`
- `comments`
- `rss_articles` ⭐ **CRITICAL**

---

### ✅ Cron Jobs Setup

Use **cron-job.org** or any cron service:

#### Cron Job #1: RSS Ingestion
- **Name**: RealSSA RSS Ingestion
- **URL**: `https://www.realssanews.com.ng/api/cron/ingest?secret=YOUR_CRON_SECRET`
- **Schedule**: Every 30 minutes (`*/30 * * * *`)
- **Method**: GET
- **Expected Response**: 
  ```json
  {"success": true, "newCount": 5, "summaryCount": 0}
  ```

#### Cron Job #2: AI Summarization ⭐ **NEW**
- **Name**: RealSSA AI Summarization
- **URL**: `https://www.realssanews.com.ng/api/cron/summarize?secret=YOUR_CRON_SECRET`
- **Schedule**: Every hour (`0 * * * *`)
- **Method**: GET
- **Expected Response**: 
  ```json
  {"success": true, "processed": 10, "successCount": 10, "failCount": 0}
  ```

---

### ✅ Code Changes Deployed

Make sure these files are pushed to GitHub:

- [ ] `backend/server.js` (updated with on-demand summarization)
- [ ] `api/cron/summarize.js` (new automated cron job)
- [ ] `backend/rss_articles_schema.sql` (new database schema)
- [ ] `AI_SUMMARIZATION_SETUP.md` (setup documentation)
- [ ] `README.md` (updated project overview)

**Deploy command:**
```bash
git add .
git commit -m "Add fully automated AI summarization system"
git push origin main
```

Vercel will auto-deploy.

---

## Post-Deployment Testing

### Test 1: Manual Article View (On-Demand Summarization)

1. Visit: https://www.realssanews.com.ng
2. Click on any article
3. **First view**: Should show summary within 5-8 seconds
4. **Refresh page**: Summary should load instantly (cached)

**Check Vercel Logs:**
- Look for: `⚡ Generating AI summary for article...`
- Look for: `✅ AI summary generated and cached...`

---

### Test 2: API Response Check

```bash
# Fetch latest articles
curl https://www.realssanews.com.ng/api/articles | jq '.[0]'
```

**Expected Output:**
```json
{
  "id": "rss-3173",
  "title": "Police kill two kidnappers in Ondo gun battle",
  "ai_summary": "Ondo State Police neutralized two suspected kidnappers...",  ⬅️ Should NOT be null!
  ...
}
```

---

### Test 3: Manual Cron Job Trigger

#### Test Ingestion:
```bash
curl "https://www.realssanews.com.ng/api/cron/ingest?secret=YOUR_CRON_SECRET"
```

**Expected:**
```json
{"success": true, "newCount": 5, "summaryCount": 0, "category": "all"}
```

#### Test Summarization:
```bash
curl "https://www.realssanews.com.ng/api/cron/summarize?secret=YOUR_CRON_SECRET"
```

**Expected:**
```json
{"success": true, "processed": 10, "successCount": 10, "failCount": 0}
```

---

### Test 4: Database Verification

Run this in **Neon SQL Editor**:

```sql
-- Check total articles
SELECT COUNT(*) FROM rss_articles;

-- Check articles WITH AI summaries
SELECT COUNT(*) FROM rss_articles WHERE ai_summary IS NOT NULL;

-- Check articles WITHOUT AI summaries
SELECT COUNT(*) FROM rss_articles WHERE ai_summary IS NULL;

-- View recent articles with summaries
SELECT id, title, 
       SUBSTRING(ai_summary, 1, 50) as summary_preview,
       published_at 
FROM rss_articles 
WHERE ai_summary IS NOT NULL 
ORDER BY published_at DESC 
LIMIT 5;
```

**Healthy System:**
- Total articles: 100+
- With summaries: Growing every hour (10+ per hour)
- Without summaries: Decreasing every hour

---

### Test 5: World Directory Functionality

1. Visit: https://www.realssanews.com.ng/world-directory
2. Click on any country (e.g., "Nigeria", "Ghana", "Kenya")
3. Should see articles for that country
4. Articles should have AI summaries

---

## Performance Monitoring

### Vercel Dashboard

**Check these metrics:**
- [ ] Function executions: Should see `/api/cron/ingest` and `/api/cron/summarize` running
- [ ] Function duration: Should be < 10 seconds
- [ ] Error rate: Should be < 1%

**Logs to watch for:**
- ✅ `✅ Ingestion complete: X new articles`
- ✅ `✅ Summarization job complete: X success`
- ❌ `❌ Gemini API error` (check API key)
- ❌ `❌ Database connection failed` (check DATABASE_URL)

---

### Neon Dashboard

**Check these metrics:**
- [ ] Connection count: Should be stable
- [ ] Query duration: < 100ms for most queries
- [ ] Storage used: Growing as articles are added
- [ ] Active queries: Should see INSERT and UPDATE statements

---

## Common Issues & Solutions

### Issue: "Unauthorized" on cron jobs
**Fix**: Check that `CRON_SECRET` in Vercel matches the secret in your cron URLs

### Issue: All ai_summary are null
**Causes:**
1. `GEMINI_API_KEY` not set → Add to Vercel env vars
2. Cron job not set up → Create `/api/cron/summarize` cron
3. Articles too old → System only summarizes articles < 7 days old

### Issue: "Table rss_articles does not exist"
**Fix**: Run `backend/rss_articles_schema.sql` in Neon SQL Editor

### Issue: Vercel timeout (10s exceeded)
**Causes:**
1. Too many articles in one cron run → Already limited to 10/run
2. Gemini API slow response → Expected, built-in retry logic
3. Database query slow → Check Neon performance

### Issue: Gemini rate limit errors
**Expected:** System is designed to handle this
- Max 12 summaries/min (under 15/min limit)
- Failed summaries retry next hour
- No action needed

---

## Success Indicators

You'll know everything is working when:

✅ **Immediate (< 1 hour):**
- [ ] Articles load on homepage
- [ ] Clicking an article shows AI summary within 5-8s
- [ ] Refreshing shows cached summary instantly

✅ **After 1st Cron Run (1 hour):**
- [ ] 10 articles have `ai_summary` populated
- [ ] Vercel logs show successful cron execution
- [ ] No errors in Neon logs

✅ **After 24 Hours:**
- [ ] 240+ articles have AI summaries (10/hour × 24)
- [ ] Users experience instant summary loads (pre-cached)
- [ ] No "generating summary" delays

✅ **Long-term (1 week):**
- [ ] All active categories have summarized articles
- [ ] World Directory countries show content
- [ ] Push notifications working for breaking news

---

## Rollback Plan

If something goes wrong:

1. **Disable AI summarization:**
   - Delete `GEMINI_API_KEY` from Vercel env vars
   - System will fall back to raw RSS excerpts

2. **Revert code changes:**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Pause cron jobs:**
   - Go to cron-job.org dashboard
   - Disable `/api/cron/summarize` job
   - Keep `/api/cron/ingest` running

---

## Support

If issues persist:
1. Check Vercel function logs
2. Check Neon database logs  
3. Test manual API calls
4. Review [AI_SUMMARIZATION_SETUP.md](./AI_SUMMARIZATION_SETUP.md)

---

**Last Updated:** July 8, 2026  
**Status:** ✅ Ready for Production
