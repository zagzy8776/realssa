const fetch = require('node-fetch');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'realssa_articles';

/**
 * Helper to call Qdrant REST API
 */
async function callQdrant(path, method = 'GET', body = null) {
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    console.warn('[Qdrant] Client not configured. QDRANT_URL or QDRANT_API_KEY missing.');
    return null;
  }

  // Format base URL
  const baseUrl = QDRANT_URL.endsWith('/') ? QDRANT_URL.slice(0, -1) : QDRANT_URL;
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : null,
      timeout: 10000
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Qdrant API Error] ${method} ${path} - Status: ${response.status}`, errorText);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error(`[Qdrant Connection Error] ${method} ${path}:`, err.message);
    return null;
  }
}

/**
 * Initializes the collection with Cosine distance and 768 size
 */
async function initCollection() {
  if (!QDRANT_URL || !QDRANT_API_KEY) return;

  console.log(`🤖 [Qdrant] Verifying collection "${COLLECTION_NAME}" exists...`);
  try {
    const checkRes = await callQdrant(`/collections/${COLLECTION_NAME}`, 'GET');
    if (checkRes && checkRes.result) {
      console.log(`✅ [Qdrant] Collection "${COLLECTION_NAME}" is ready.`);
      return;
    }

    console.log(`🤖 [Qdrant] Creating new collection "${COLLECTION_NAME}" with 768-dim vectors & Cosine distance...`);
    const createRes = await callQdrant(`/collections/${COLLECTION_NAME}`, 'PUT', {
      vectors: {
        size: 768,
        distance: 'Cosine'
      }
    });

    if (createRes && createRes.result) {
      console.log(`✅ [Qdrant] Collection "${COLLECTION_NAME}" created successfully.`);
    } else {
      console.error(`❌ [Qdrant] Failed to create collection "${COLLECTION_NAME}".`);
    }
  } catch (err) {
    console.error(`❌ [Qdrant] Collection initialization error:`, err.message);
  }
}

/**
 * Upserts an article vector to Qdrant.
 * @param {number} articleId - Numerical ID of the article
 * @param {Array<number>} vector - 768-dimensional float array
 */
async function upsertArticleVector(articleId, vector) {
  const numId = parseInt(articleId, 10);
  if (isNaN(numId)) {
    console.warn(`[Qdrant Upsert] Skipped article ID ${articleId} (must be a valid integer)`);
    return false;
  }

  if (!Array.isArray(vector) || vector.length !== 768) {
    console.warn(`[Qdrant Upsert] Skipped article ID ${articleId} (vector length must be 768)`);
    return false;
  }

  const payload = {
    points: [{
      id: numId,
      vector: vector,
      payload: {
        id: numId
      }
    }]
  };

  const res = await callQdrant(`/collections/${COLLECTION_NAME}/points?wait=true`, 'PUT', payload);
  return res && res.result ? true : false;
}

/**
 * Searches Qdrant for similar article IDs.
 * @param {Array<number>} vector - Query vector (768-dim float array)
 * @param {number} limit - Number of matches to return
 * @returns {Promise<Array<number>>} Array of matching article IDs
 */
async function searchArticleVectors(vector, limit = 10) {
  if (!Array.isArray(vector) || vector.length !== 768) {
    console.warn(`[Qdrant Search] Invalid query vector length (must be 768)`);
    return [];
  }

  const payload = {
    vector: vector,
    limit: limit,
    with_payload: true
  };

  const res = await callQdrant(`/collections/${COLLECTION_NAME}/points/search`, 'POST', payload);
  if (res && res.result && Array.isArray(res.result)) {
    // Map scores and extract the IDs
    return res.result.map(hit => parseInt(hit.id, 10)).filter(id => !isNaN(id));
  }
  return [];
}

// Automatically trigger collection verification on load (runs on startup)
initCollection().catch(err => console.error('[Qdrant Startup Error]:', err.message));

module.exports = {
  initCollection,
  upsertArticleVector,
  searchArticleVectors
};
