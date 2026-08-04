# RealSSA — Database & Free‑Tier Capacity Plan (v3 — DECIDED)

> Status: **PLAN ONLY — nothing changed or deleted.**
> v3: user confirmed these are **branches inside ONE Neon project** (shared quota). Decision made → Plan 7 path.

---

## ⭐ 0b. MAPPING CONFIRMED + Plan 7 code design (ready to implement)
- ✅ User confirmed: branch **"realssa bb"** connection string = `ep-snowy-field-azwdymwg-pooler...` → **realssa bb IS snowy-field.** Safe to point everything here.
- ⚠️ **SECURITY:** the live password `npg_iljcrTy74CPR` was pasted in chat → **must be rotated** in Neon (Reset password on the branch). Plan moves all creds to env vars too.

### The exact edit to `backend/config/multiDb.js`
**Problem in current file:** every category is routed to a *different* branch (sweet-field, green-butterfly=DEAD, icy-glitter=11 rows). `queryMultiDb` also loops across ALL pools on failure → wakes every branch → burns the shared meter.

**Fix:** make `DATABASE_URL` (= snowy-field) the single source for ALL news categories, and stop the failover from waking sleeping branches.
- Every `DB_CONFIGS` entry's `url` → `process.env.DATABASE_URL` (snowy-field).
- `getPoolForCategory()` → always returns the snowy-field pool.
- `queryMultiDb()` → query snowy-field only (no cross-pool wake storm).
- `queryAllDbs()` / cleanup loop → operate on snowy-field only, so the DELETE stops pinging dead branches.
- Keep the AI pool (sweet-brook) separate — it's tiny and only used by the AI brain.

### The exact edit to the Rust poll
- Find the 90s poll interval in `rust-engine/src/*.rs` → raise to ≥ 6 min (360s) so snowy-field can auto-suspend (>300s idle) between reads.

**Net effect:** all categories (world/ghana/crypto/entertainment/etc.) now write AND read from snowy-field → they appear on the site; the other 9 branches go idle → shared 100 CU-hr meter stops draining 10×; 48h self-trim keeps storage tiny.

---

## ⭐ 0. DECISION LOCKED — one project, shared quota

You showed the Neon dashboard. These are **10 branches inside ONE project**, all `AWS Asia Pacific / US West`, sharing **ONE 100 CU‑hr meter**:

| Branch (your names) | Size | Role |
|---|---|---|
| realssa bb | **1.29 GB** | ← the BIG one = **snowy-field** (main news, 7,738 rows) |
| crypto, entertainment | 70 MB | side news branch |
| world usa uk | 39.42 MB | side news branch |
| ai model database | 37.34 MB | AI brain (sweet-brook) |
| ghana kenya southafrica | 37.1 MB | side news branch |
| movie / movie 2 / movie 3 | ~33 MB each | cinema branches |
| realssa nigeria news ×2 | ~33 MB each | duplicated nigeria branch |

**This is the critical fact:** because it's ONE project, **every branch shares the same 100 CU‑hr compute budget.** So the more branches you keep awake, the FASTER you burn the single quota.

### What this means for your strategy (important, please read)
Your plan — "create more databases and spread the feeds so no single one runs out" — **cannot work on a single-project setup**, because:
- Branches do **not** get separate quotas. They all draw from the **same** 100 CU‑hrs.
- Every branch you spread to is **another compute that wakes up** and eats the shared budget.
- So spreading across 10 branches = up to **10× the compute drain** on the SAME meter → you hit the limit *faster*, which is exactly what happened last month.

**The winning move here is the OPPOSITE of spreading: use ONE branch, let the rest sleep.** Storage was never the issue (realssa bb is 1.29 GB but Neon storage limit is generous and news self-trims). **Compute is the only thing that ran out — and consolidating is how you protect it.**

---
> v2 note (kept for history): rewritten after understanding the compute‑spreading intent + Rust learning bot.


---

## 0. Correction to my earlier advice
My v1 said "consolidate to one DB." That assumed **all databases share ONE compute quota.**
Your explanation says the opposite goal: you deliberately made **extra databases and spread the cron across them** because last month a single DB hit its limit and "went off."

**If each of these databases is a separate Neon project/account, then each has its OWN free quota — and spreading is the correct strategy, not the wrong one.** So v1's "merge to one" was based on a bad assumption. This v2 is built around *your* design. The one fact that decides the whole plan is in Section 5.

---

## 1. Your actual architecture (as I now understand it)
- **Goal:** keep the site alive on Neon free tier by **spreading load across many databases**, so no single one exhausts its compute and "goes off."
- **News is disposable:** every ~24h the old `rss_articles` are deleted and fresh ones ingested. (This is why storage stays tiny — 0.12 GB.)
- **A Rust "silent" bot** you're building **queries the DB every 90 seconds** to read + learn. ← almost certainly the main compute consumer.
- **Cron jobs** ingest news and are meant to be shared across the databases.

---

## 2. What the live audit found (facts)
| Nickname | Endpoint | rss_articles | Role today |
|----------|----------|-------------:|------------|
| **snowy-field** | `ep-snowy-field-azwdymwg` | **7,738** | Real, full news DB |
| sweet-field | `ep-sweet-field-azj0x1ei` | 289 | Some news + feed_health/rates |
| icy-glitter | `ep-icy-glitter-az3nsoqd` | 11 | Barely any news |
| royal-dream | `ep-royal-dream-azab2rs9` | 0 | Config/users, **no news** |
| green-butterfly | `ep-green-butterfly-azlp8ez4` | ~24 | **DEAD — endpoint won't resolve** |
| long-mode | `ep-long-mode-azq5clsj` | — | **No `rss_articles` table** |
| sweet-brook (AI) | `ep-sweet-brook-az3jbxv3` | 3 | AI brain |

**Where news is packed:** ~99% in **snowy-field only**. The other DBs are NOT getting the shared news — so your spread strategy is *configured* but **not actually working.**

---

## 3. Why your spread isn't working (the real bugs)
Your idea is fine; the implementation is broken in `backend/config/multiDb.js`:
1. **DB1 and DB2 point to the SAME url** (both `ep-sweet-field`). So "5 databases" is really fewer — two entries are one DB duplicated.
2. **DB3 (green-butterfly) is DEAD.** Every category routed there (`world`, `usa`, `uk`, `africa`) fails, then `queryMultiDb` **retries across all pools**, waking others — burning MORE compute for nothing.
3. **long-mode has no `rss_articles` table**, royal-dream has 0 news — they can't serve news even though they're "in the pool."
4. So instead of 5 healthy shards sharing load, you effectively have **1 real news DB (snowy-field) + a dead one causing retry storms.** That's likely why a DB "went off": the load never actually spread.

---

## 4. The real compute driver: the 90s Rust poll
- Neon auto-suspends a compute after **~5 min (300s) idle**.
- A bot polling **every 90s never lets the DB sleep** → that DB runs **24/7** → ~11 CU‑hrs/day (matches your 32.86 in 3 days).
- **Lever:** if the bot rotates its 90s poll across several *healthy* DBs, each DB is hit only every ~7–8 min → longer than 300s → they can **auto-suspend between polls** → big compute savings **per project**.
- This only multiplies your free allowance **if the DBs are separate Neon projects** (see Section 5).

---

## 5. THE ONE QUESTION THAT DECIDES EVERYTHING
**Are these databases separate Neon projects/accounts (each with its own 100 CU‑hr free quota), or branches inside ONE project (sharing one 100 CU‑hr quota)?**

- **If SEPARATE projects → your spread strategy is CORRECT.** Plan = make the spread actually work (replicate news to all, rotate bot+cron, fix dead/dup DBs). Effective quota becomes ~6×100.
- **If ONE project (shared quota) → spreading does NOT add quota** and just wakes more computes. Plan = one DB + slow the 90s poll.

I can't tell for certain from the connection strings alone. Your Neon dashboard answers it: does the "32.86/100 CU‑hrs" meter cover ALL these DBs, or just one?

---

## 6. Plan IF SEPARATE PROJECTS (make your spread real)
- [ ] S1. Ensure **every** target DB has the full schema (`rss_articles` + indexes). long-mode/royal-dream currently can't hold news.
- [ ] S2. Fix `multiDb.js`: remove the **duplicate** DB1==DB2, remove/replace **dead** green-butterfly, only keep DBs that actually resolve + have the schema.
- [ ] S3. **Replicate the 24h news batch to all healthy DBs** (so any of them can serve the site).
- [ ] S4. **Rotate the Rust bot's 90s poll** across the healthy DBs (round‑robin) so each can auto-suspend between hits.
- [ ] S5. Rotate cron ingestion the same way.
- [ ] S6. Move creds to env + rotate exposed passwords.

## 7. Plan IF ONE SHARED QUOTA (spreading can't help)
- [ ] O1. Point reads/writes at snowy-field (the real news DB).
- [ ] O2. **Slow the Rust poll** from 90s to ≥ 6 min (news only changes on ingest, so 90s is wasteful) → lets the DB sleep → compute drops hard.
- [ ] O3. Batch the bot's learning instead of per-90s reads.
- [ ] O4. Remove dead green-butterfly so retries stop.
- [ ] O5. Move creds to env + rotate passwords.

---

## 8. Regardless of the answer (safe wins now)
- Green-butterfly is **dead** → it can't be part of any working spread. Must be replaced or removed.
- DB1==DB2 duplicate → not real redundancy; fix it.
- Hardcoded plaintext passwords → move to env + rotate.
- The Rust 90s poll is the compute hog → at minimum it should skip dead DBs.

---

### What I need from you
Answer Section 5: **separate Neon projects, or one shared quota?**
Then I'll execute Plan 6 or Plan 7 accordingly. Nothing has been changed yet.

---

## 9. ANSWER TO "why only UK / USA / Nigerian / Sports show on homepage?"
This is the smoking gun that proves the diagnosis. Look at the category routing in `multiDb.js`:

| Category group | Routed to DB | That DB's status | Result on homepage |
|----------------|--------------|------------------|--------------------|
| nigerian-news, **sports**, business, politics | DB1 → sweet-field | alive-ish | **shows** ✅ |
| crypto, entertainment, culture, lifestyle | DB2 → sweet-field (DUPLICATE) | alive-ish | partial |
| **world, usa, uk, africa** | DB3 → **green-butterfly (DEAD)** | ENOTFOUND | should FAIL ❌ |
| ghana, kenya, south-africa, jobs, tech | DB4 → icy-glitter (11 rows) | nearly empty | **empty** |

But the homepage reads mostly from **snowy-field** (the real DB, `DATABASE_URL`), where UK/USA/Nigerian/Sports happen to be the biggest buckets (924/46/644/1378). So:

- **The categories you SEE** = the ones that happen to sit in snowy-field in large numbers.
- **The categories that "disappear"** = the RSS bot wrote them to a shard (green-butterfly/icy-glitter/long-mode) that the homepage **never reads from**, OR the write failed because the shard is dead.
- **"Lots of RSS feeds but not coming in"** = the feeds ARE fetched, but `getPoolForCategory()` scatters the inserts to dead/stray DBs, so they vanish from the site's view. The news isn't lost to the internet — it's landing in databases the frontend never queries.

**In one line:** your reads come from snowy-field, but your writes are sprayed across 4 mismatched DBs. Only the categories that overlap (big in snowy-field) survive the mismatch — that's why it's always UK/USA/Nigerian/Sports.

This is fixable and it's the #1 thing making the site feel empty.

---

## 10. ANSWER: does snowy-field delete every 24h and refill? (checked the code)
**Almost — but it's 48 hours, not 24.** Facts from the source:

- `services/rssBot.js`:
  ```sql
  DELETE FROM rss_articles WHERE published_at < NOW() - INTERVAL '2 days'
  ```
- `services/ingestion.js` — comment says *"Self-Cleaning Database Across ALL 5 Databases … Delete articles older than 48 hours (2 days)"*, then loops:
  ```js
  for (item of allPools)  // includes the DEAD green-butterfly
     item.pool.query(`DELETE FROM rss_articles WHERE published_at < NOW() - INTERVAL '2 days'`)
  ```
- The frontend also only *reads* `published_at > NOW() - INTERVAL '2 days'` (and 48h/72h in places).

**What this means:**
1. **Retention = 48h, not 24h.** Old news is purged after 2 days and fresh news is ingested continuously. So yes, snowy-field self-empties and refills — just on a 2-day rolling window.
2. **This is why storage stays tiny (0.12 GB)** and why storage will never be your problem — the DB trims itself.
3. **⚠️ The cleanup loop runs the DELETE across ALL 5 pools every cycle — including the DEAD green-butterfly and the empty ones.** Each cycle it tries to connect to databases that don't resolve → connection attempts + retries → **wakes computes / wastes compute hours** on databases that hold nothing. This is a direct contributor to your compute burn.
4. Because writes scatter but the 48h purge + reads both target snowy-field, the *other* DBs never accumulate a real 48h window of news → they stay empty → "spread" never takes hold.

**Bottom line on your question:** snowy-field IS doing the 48h delete-and-refill correctly. The problem was never snowy-field's cycle — it's that (a) new articles for half your categories get written to dead/empty DBs, and (b) the self-cleaning routine keeps pinging dead DBs, burning compute. Fixing the routing (Section 9) + skipping dead DBs in the cleanup loop solves both the "missing categories" and a chunk of the "compute filling up."



