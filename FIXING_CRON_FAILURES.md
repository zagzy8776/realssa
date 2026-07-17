# 🔧 Fixing Your Failing Cron Jobs

## Current Situation

All 13 of your cron jobs are showing **"Failed (HTTP error)"** on cron-job.org. Let's fix this!

---

## 🕵️ Step 1: Diagnose the Problem

### Test the diagnostic endpoint I just created:

```bash
# Visit this URL in your browser OR use curl:
https://www.realssanews.com.ng/api/test-cron?secret=realssa-cron-secret-2026
```

**This will tell you:**
- ✅ Is the secret correct?
- ✅ Are environment variables set?
- ✅ Is the API endpoint reachable?

**Expected Response:**
```json
{
  "success": true,
  "message": "Cron test endpoint is working!",
  "diagnostics": {
    "secretMatches": true,
    "environment": {
      "hasDatabaseUrl": true,
      "hasGeminiApiKey": true,
      "hasCronSecret": true
    }
  }
}
```

---

## 🔍 Step 2: Identify the Issue

### Issue A: Secret Mismatch

**If `secretMatches: false`:**

Your Vercel `CRON_SECRET` doesn't match `realssa-cron-secret-2026`

**Fix:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `CRON_SECRET`
3. Update it to: `realssa-cron-secret-2026`
4. Click **Save**
5. **IMPORTANT:** Redeploy your app:
   ```bash
   git commit --allow-empty -m "Redeploy for env var update"
   git push origin main
   ```

---

### Issue B: Endpoint Not Deployed

**If you get 404 Not Found:**

The `/api/cron/ingest` endpoint isn't deployed yet.

**Fix:**
```bash
# Push all the new code:
git add .
git commit -m "Deploy AI summarization and cron endpoints"
git push origin main
```

Vercel will auto-deploy in ~2 minutes.

---

### Issue C: Database Connection

**If endpoint returns 500 error:**

Database connection is failing.

**Fix:**
1. Check Vercel → Functions → Logs
2. Look for: `❌ Database connection failed`
3. Verify `DATABASE_URL` in Vercel env vars matches your Neon connection string:
   ```
   postgresql://neondb_owner:YOUR_PASSWORD@ep-curly-art-aol2g9ib-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   ⚠️ **Replace `YOUR_PASSWORD` with your actual Neon database password from Vercel env vars**

---

## ✅ Step 3: Test Individual Endpoints

After fixing the issue above, test each endpoint manually:

### Test Ingestion:
```bash
curl "https://www.realssanews.com.ng/api/cron/ingest?category=sports&secret=realssa-cron-secret-2026"
```

**Success Response:**
```json
{
  "success": true,
  "newCount": 3,
  "summaryCount": 0,
  "category": "sports",
  "timestamp": "2026-07-08T10:00:00.000Z"
}
```

### Test AI Summarization (NEW):
```bash
curl "https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026"
```

**Success Response:**
```json
{
  "success": true,
  "processed": 10,
  "successCount": 10,
  "failCount": 0,
  "timestamp": "2026-07-08T10:00:00.000Z"
}
```

### Test Streams:
```bash
curl "https://www.realssanews.com.ng/api/cron/streams?secret=realssa-cron-secret-2026"
```

---

## 🚀 Step 4: Add the NEW Cron Job

Once the tests pass, add the AI summarization job:

### On cron-job.org:

1. **Click** "Create Cronjob"
2. **Fill in:**
   - Title: `RealSSA - AI Summarization`
   - URL: `https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026`
   - Schedule: `0 * * * *` (every hour at :00)
   - Method: GET
   - Timeout: 60 seconds
3. **Save**

---

## 📊 Step 5: Verify Everything Works

### Check cron-job.org Dashboard:

Within 1 hour, you should see:
- ✅ All 13 ingestion jobs showing **green checkmarks**
- ✅ NEW AI summarization job showing **green checkmark**

### Check Vercel Logs:

Go to: Vercel → Functions → Select any cron endpoint

Look for:
```
✅ Ingestion complete: 5 new articles
✅ Summarization job complete: 10 success, 0 failed
```

### Check Your Website:

1. Visit: https://www.realssanews.com.ng
2. Click any article
3. Should see AI-generated summary (not raw RSS excerpt)

---

## 🐛 Troubleshooting Guide

### All Jobs Still Failing After Fix

**Possible Causes:**

1. **Vercel didn't redeploy after env var change**
   ```bash
   git commit --allow-empty -m "Force redeploy"
   git push origin main
   ```

2. **Timeout (10 seconds exceeded)**
   - Check Vercel logs for timeout errors
   - Your code already limits to 2 feeds per category
   - Should NOT timeout with current settings

3. **Rate limiting (too many simultaneous requests)**
   - Use the staggered schedule from `CRON_JOBS_SETUP.md`
   - Spread jobs across 30 minutes instead of all at once

---

### Some Jobs Work, Some Fail

**This means:**
- ✅ Secret is correct
- ✅ Endpoints are deployed
- ⚠️ Specific categories have issues

**Check:**
- Which categories are failing?
- Look at Vercel logs for those specific categories
- Might be bad RSS feeds for that category

**Fix:**
- Edit `backend/services/ingestion.js`
- Remove broken RSS feeds for failing categories

---

### Ingestion Works, But No AI Summaries

**Check:**
1. Is `GEMINI_API_KEY` set in Vercel?
2. Is the NEW cron job created?
3. Wait 1 hour for first run

**Manual Test:**
```bash
curl "https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026"
```

Should return: `"successCount": 10`

---

## 📝 Quick Checklist

Before you consider it "fixed":

- [ ] Diagnostic endpoint returns `"secretMatches": true`
- [ ] Manual curl test of ingestion works (returns `{"success": true}`)
- [ ] Manual curl test of summarization works (returns `{"success": true}`)
- [ ] Pushed latest code to GitHub
- [ ] Vercel auto-deployed successfully
- [ ] Environment variables verified in Vercel
- [ ] NEW cron job (#14) added on cron-job.org
- [ ] Wait 1 hour and check cron-job.org dashboard shows green checkmarks

---

## 🎯 Expected Timeline

### In 5 Minutes:
- ✅ Code pushed to GitHub
- ✅ Vercel deployed
- ✅ Manual tests passing

### In 1 Hour:
- ✅ First cron job executions complete
- ✅ Green checkmarks on cron-job.org
- ✅ 10 articles have AI summaries

### In 24 Hours:
- ✅ All categories have fresh content
- ✅ 240+ articles with AI summaries
- ✅ No admin intervention needed

---

## 📞 Need Help?

If issues persist after following all steps:

1. **Screenshot cron-job.org error details** (click "History" on any failed job)
2. **Check Vercel function logs** (copy any error messages)
3. **Test diagnostic endpoint** and share the response
4. **Verify database table exists** (run `backend/rss_articles_schema.sql` in Neon)

---

**Remember:** The goal is to have all 14 cron jobs showing **green checkmarks** with zero admin work required!

---

**Next Steps:**
1. Run diagnostic endpoint
2. Fix any identified issues
3. Test manually with curl
4. Add NEW cron job #14
5. Wait 1 hour and verify

You got this! 🚀
