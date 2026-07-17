# ⚡ Quick Start - Get AI Summaries Running in 10 Minutes

## What This Does

Your RealSSA News platform will **automatically generate AI summaries** for all articles with **ZERO admin work**. Just set it up once and forget it!

---

## 🚀 3-Step Setup

### Step 1: Deploy Code (2 minutes)

```bash
git add .
git commit -m "Enable automated AI summarization"
git push origin main
```

Vercel auto-deploys. ✅ Done.

---

### Step 2: Database Table (1 minute)

1. Go to: https://console.neon.tech
2. Open your project → **SQL Editor**
3. Copy ALL contents from `backend/rss_articles_schema.sql`
4. Paste → Click **Run**

✅ Table created.

---

### Step 3: Add NEW Cron Job (2 minutes)

You already have 13 cron jobs on cron-job.org. Add one more:

Go to: https://cron-job.org

**Create NEW Cron Job (#14):**
- **Title**: RealSSA - AI Summarization
- **URL**: `https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026`
- **Schedule**: `0 * * * *` (every hour at :00)
- **Method**: GET
- **Timeout**: 60 seconds

Click **Create** → ✅ Done!

**Note:** Keep your existing 13 jobs running - they handle RSS ingestion. This new job generates AI summaries.

---

## ✅ Verify It's Working

### Test Now (Don't Wait):

Visit this URL in your browser:
```
https://www.realssanews.com.ng/api/cron/summarize?secret=realssa-cron-secret-2026
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 10,
  "successCount": 10,
  "failCount": 0
}
```

✅ If you see this = IT'S WORKING!

---

### Check Your Site:

1. Go to: https://www.realssanews.com.ng
2. Click any article
3. Look for the summary text

**Before:** Raw RSS excerpt like "Ondo State Police neutralize two suspected kidnappers in a fierce gun battle along..."

**After (within 5-8 seconds):** AI-generated summary with RealSSA branding

---

## 📊 What Happens Next?

### Hour 1:
- ✅ 10 articles get AI summaries
- Users viewing articles trigger on-demand summaries (5-8s delay first time)

### Hour 2:
- ✅ 20 total articles have summaries
- More users see instant summaries (cached)

### Day 1:
- ✅ 240 articles with AI summaries
- Most popular articles already cached
- No more loading delays

### Week 1:
- ✅ 1,680+ articles summarized
- Entire platform has branded summaries
- **Fully automated - no admin work needed!**

---

## 🐛 Troubleshooting

### "Unauthorized" Error
**Fix:** Verify `CRON_SECRET` in Vercel matches: `realssa-cron-secret-2026`
- Go to Vercel → Settings → Environment Variables
- Ensure: `CRON_SECRET=realssa-cron-secret-2026`

### "Table rss_articles does not exist"
**Fix:** Run Step 2 again (database table creation)

### Articles still show raw excerpts
**Wait 1 hour** for first cron run, OR click an article to trigger on-demand generation

---

## 🎉 That's It!

You're done! The system now:
- ✅ Ingests news every 30 minutes
- ✅ Generates AI summaries every hour
- ✅ Caches summaries for instant loading
- ✅ Requires ZERO admin intervention

---

## Need More Details?

📖 Full Documentation: [AI_SUMMARIZATION_SETUP.md](./AI_SUMMARIZATION_SETUP.md)  
✅ Deployment Checklist: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)  
📝 Project README: [README.md](./README.md)

---

**Questions?** Check Vercel logs for real-time status.
