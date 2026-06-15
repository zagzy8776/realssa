# 🚀 Migrating from Railway to Render (with Neon Database)

This guide walks you through migrating your EntertainmentGHC project from Railway to Render, and switching from JSON file storage to **Neon PostgreSQL** for persistent data.

---

## 📋 Architecture Overview

Your project currently has **3 backend services** on Railway:
1. **Main API** (`realssa-production.up.railway.app`) — Express.js backend (server.js)
2. **News Aggregator** (`realssa-news-agg-production.up.railway.app`) — News feed service
3. **Sports API** (`realssasportsapi-production.up.railway.app`) — Sports data service

Your **Frontend** is deployed on Vercel and points to these Railway URLs.

### Target Architecture (after migration):
```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Vercel      │────▶│  Render (Backend)     │────▶│  Neon (Database) │
│  (Frontend)  │     │  server_neon.js       │     │  PostgreSQL       │
│              │     │  (never sleeps? no)   │     │  (never sleeps!) │
└──────────────┘     └──────────────────────┘     └──────────────────┘
```

---

## 🏁 Step 1: Create a Render Account

1. Go to [https://render.com](https://render.com)
2. Sign up using **GitHub** (recommended — connects your repos automatically)
3. Choose **Free Plan** (You get 750 hours/month free, which covers 1 service 24/7)

---

## 🗄️ Step 2: Set Up Neon Database (Do this BEFORE deploying backend)

**Why Neon + Render is the best combo:**
- **Neon** → Database that **never sleeps** (free tier has no downtime)
- **Render** → Backend API (can sleep, but Neon stays alive)
- **PostgreSQL** → Your `pg` package and `seed.js` already use it

### A) Create a Neon Project

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up with **GitHub** (recommended)
3. Click **"Create a project"**
   - **Name:** `realssa-db` (or any name)
   - **Region:** Choose one close to you (e.g., US East or EU West)
   - **Plan:** **Free** (includes 500MB storage, never sleeps!)
4. Click **"Create"**
5. Copy the **connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### B) Create Database Tables

**Option 1: Using Neon SQL Editor (Easiest)**
1. In Neon Dashboard → **"SQL Editor"** tab
2. Open `backend/db_schema.sql` from your project
3. Copy and paste the entire content into the SQL Editor
4. Click **"Run"** — this creates all tables + admin user

**Option 2: Using Command Line**
```bash
psql "YOUR_NEON_CONNECTION_STRING" -f backend/db_schema.sql
```

### C) Migrate Your Existing Data

Once tables are created, migrate your existing JSON data to Neon:

```bash
# Set your Neon connection string as an environment variable (Windows CMD)
set DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Run the migration script
node backend/migrate_json_to_neon.js
```

This will transfer all your existing users, articles, and comments from JSON files to Neon.

---

## 📦 Step 3: Prepare Your Backend for Render

### Update the Start Command

Your project now has two server files:
- `server.js` — **Old** (uses JSON files, NOT recommended for Render)
- `server_neon.js` — **New** (uses Neon PostgreSQL, RECOMMENDED)

You'll deploy using `server_neon.js`.

### (Optional) Create a `render.yaml` Blueprint

Place this in your project root for automated deployments:

```yaml
# render.yaml
services:
  - type: web
    name: realssa-api
    env: node
    region: frankfurt
    plan: free
    buildCommand: npm install
    startCommand: node server_neon.js
    healthCheckPath: /
    envVars:
      - key: NODE_VERSION
        value: 20
      - key: PORT
        value: 5000
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL
        sync: false
      - key: VAPID_PUBLIC_KEY
        sync: false
      - key: VAPID_PRIVATE_KEY
        sync: false
      - key: FIREBASE_SERVICE_ACCOUNT
        sync: false
```

---

## 🎯 Step 4: Deploy Backend to Render

### Option A: Deploy via Dashboard (Easiest)

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your **GitHub repository** (`zagzy8776/realssa`)
4. Configure the service:
   - **Name:** `realssa-api`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server_neon.js`
   - **Plan:** Free
5. Click **"Advanced"** and add **Environment Variables** (see Step 5)
6. Click **"Create Web Service"**

### Option B: Deploy via Blueprint (If you created render.yaml)

1. In Render Dashboard → **"New +"** → **"Blueprint"**
2. Connect your repo
3. Render will read `render.yaml` and create the service automatically
4. You'll be prompted to fill in the `sync: false` variables manually

### Important: Set Correct Root Directory
Since your backend is in the `backend/` folder, set:
- **Root Directory:** `backend`

---

## 🔐 Step 5: Add Environment Variables on Render

Go to your Render service → **Environment** tab → add these:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_VERSION` | `20` | Required for Node runtime |
| `PORT` | `5000` | Render uses this, maps to `:10000` externally |
| `JWT_SECRET` | `your-random-secret-here` | Generate a strong random string |
| `DATABASE_URL` | *(your Neon connection string)* | **This is the most important one!** |
| `VAPID_PUBLIC_KEY` | *(your existing key)* | From your Railway env variables |
| `VAPID_PRIVATE_KEY` | *(your existing key)* | From your Railway env variables |
| `FIREBASE_SERVICE_ACCOUNT` | *(your full JSON)* | Firebase admin service account JSON |

**How to get your current Railway env variables:**
- Go to Railway Dashboard → your project → Variables tab
- Copy each variable value manually or use Railway CLI:
  ```bash
  railway variables
  ```

---

## 🔗 Step 6: Update Vercel (Frontend) to Point to Render

Once your backend is deployed on Render, you'll get a URL like: `https://realssa-api.onrender.com`

### Update `vercel.json`

Replace Railway URLs with Render URLs:

```json
{
  "rewrites": [
    {
      "source": "/rss/(.*)",
      "destination": "https://realssa-api.onrender.com/rss/$1"
    },
    {
      "source": "/api/(.*)",
      "destination": "https://realssa-api.onrender.com/api/$1"
    },
    {
      "source": "/news-feed",
      "destination": "https://realssa-api.onrender.com/news-feed"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Also update the `connect-src` CSP header in `vercel.json`:
- Replace `https://realssa-production.up.railway.app` → `https://realssa-api.onrender.com`

### Update Vercel Environment Variables

In Vercel Dashboard → project → **Settings** → **Environment Variables**:

| Variable | New Value |
|----------|-----------|
| `VITE_API_URL` | `https://realssa-api.onrender.com` |
| `VITE_BACKEND_URL` | `https://realssa-api.onrender.com` |
| `VITE_NEWS_API_URL` | `https://realssa-api.onrender.com` |
| `VITE_SPORTS_API` | `https://realssa-api.onrender.com` |

---

## 🧪 Step 7: Test the Migration

1. **Check the API health:**
   ```
   https://realssa-api.onrender.com/
   ```
   Should return: `{ "message": "EntertainmentGHC API Server (Neon DB)", "status": "running" }`

2. **Check articles endpoint:**
   ```
   https://realssa-api.onrender.com/api/articles
   ```

3. **Visit your frontend** (Vercel URL) and verify everything works.

---

## 🧹 Step 8: Clean Up Railway

After confirming everything works on Render + Neon:
1. Go to Railway Dashboard
2. Delete the old services
3. Update your DNS records if you had a custom domain pointed to Railway

---

## ⏰ Free Tier Limitations

| Feature | Render Free Plan | Neon Free Plan |
|---------|-----------------|----------------|
| **Uptime** | Sleeps after 15 mins of inactivity | **Never sleeps** |
| **Bandwidth** | 100 GB/month | 5 GB/month |
| **Compute** | 512 MB RAM | 1 GB RAM |
| **Storage** | Ephemeral (resets on deploy) | 500 MB persistent |
| **SSL** | Automatic | Automatic |
| **Custom Domain** | Supported | Not needed (backend only) |

**Tip:** Use [UptimeRobot](https://uptimerobot.com) (free) to ping your Render URL every 10 minutes to prevent sleeping.

---

## 📝 Complete Migration Checklist

- [ ] Create Render account
- [ ] Create Neon database project
- [ ] Run `backend/db_schema.sql` in Neon SQL Editor
- [ ] Run `node backend/migrate_json_to_neon.js` to transfer existing data
- [ ] Deploy backend to Render (using `server_neon.js`)
- [ ] Add all environment variables in Render Dashboard (especially `DATABASE_URL`)
- [ ] Get the Render URL (e.g., `https://realssa-api.onrender.com`)
- [ ] Update `vercel.json` rewrites to Render URL
- [ ] Update Vercel environment variables (VITE_API_URL, etc.)
- [ ] Test API health endpoint
- [ ] Test frontend functionality
- [ ] Remove Railway services (after everything works)
- [ ] (Optional) Set up UptimeRobot to keep Render awake

---

## ❓ Troubleshooting

### "Cannot GET /" → Check if server.js is running
Make sure you're using `server_neon.js` (not the old `server.js` which uses JSON files).

### "ECONNREFUSED" → Check CORS
Update the CORS origin in `backend/server_neon.js`:
```js
app.use(cors({
  origin: ['https://your-vercel-app.vercel.app', 'https://realssa-api.onrender.com', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
```

### "502 Bad Gateway" → Check health check path
Make sure your root route (`GET /`) returns a 200 response. Render uses this for health checks.

### "ECONNREFUSED" to Neon → Check DATABASE_URL
Make sure you've added the `DATABASE_URL` environment variable in Render with your Neon connection string.

### "relation 'users' does not exist" → Tables not created
Run the `backend/db_schema.sql` script in Neon SQL Editor, OR use `server_neon.js` which auto-creates tables.