const express = require('express');
const crypto = require('node:crypto');
const { runGrowth, growthReport, publishDistributionDrafts } = require('../services/growthWorker');
module.exports = function growthRoutes(pool) {
  const router = express.Router();
  router.use((req,res,next) => {
    const secret = process.env.GROWTH_ADMIN_TOKEN;
    if (!secret) return res.status(503).json({error:'GROWTH_ADMIN_TOKEN is not configured'});
    const provided = String(req.headers.authorization || '').replace(/^Bearer /,'');
    const a=Buffer.from(secret), b=Buffer.from(provided);
    if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return res.status(401).json({error:'Unauthorized'});
    res.setHeader('Cache-Control','no-store');
    next();
  });
  router.get('/report',async (_req,res)=>{
    try { res.json(await growthReport(pool)); }
    catch(err) { console.error('[Growth report]',err.message); res.status(500).json({error:'Growth report failed'}); }
  });
  router.post('/run',async (_req,res)=>{
    try {
      const result = await runGrowth(pool);
      // After successful growth run, publish distribution drafts
      if (result?.runId) {
        const publishResult = await publishDistributionDrafts(pool);
        result.draftPublishing = publishResult;
      }
      res.json(result);
    }
    catch(err) { console.error('[Growth run]',err.message); res.status(500).json({error:'Growth run failed'}); }
  });
  return router;
};