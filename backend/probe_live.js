const https = require('https');

function fetchJson(path) {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: 'www.realssanews.com.ng',
            path: path,
            timeout: 25000,
            headers: { 'Accept': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data });
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

(async () => {
    console.log('Probing live site: https://www.realssanews.com.ng\n');

    // 1. Health check
    try {
        const health = await fetchJson('/api/health');
        console.log('GET /api/health →', health.status);
        console.log('   ', health.body.slice(0, 200));
    } catch (e) { console.log('GET /api/health ERROR:', e.message); }

    // 2. Breaking news
    try {
        const br = await fetchJson('/api/news/breaking?diverse=true');
        console.log('\nGET /api/news/breaking →', br.status);
        if (br.status === 200) {
            const arr = JSON.parse(br.body);
            console.log('   Returned', Array.isArray(arr) ? arr.length : 'non-array', 'articles');
            if (Array.isArray(arr) && arr.length > 0) {
                console.log('   First article:', arr[0].title ? arr[0].title.slice(0, 70) : 'no title');
                console.log('   Has editorial_reason field:', arr[0].editorial_reason !== undefined);
            } else {
                console.log('   BODY:', br.body.slice(0, 300));
            }
        } else {
            console.log('   BODY:', br.body.slice(0, 300));
        }
    } catch (e) { console.log('GET /api/news/breaking ERROR:', e.message); }

    // 3. AI health
    try {
        const ai = await fetchJson('/api/ai/health');
        console.log('\nGET /api/ai/health →', ai.status);
        if (ai.status === 200) {
            const j = JSON.parse(ai.body);
            console.log('   gemini_api_key_set:', j.gemini_api_key_set);
            console.log('   agents:', j.agents.length);
        } else {
            console.log('   BODY:', ai.body.slice(0, 200));
        }
    } catch (e) { console.log('GET /api/ai/health ERROR:', e.message); }

    // 4. AI audit
    try {
        const audit = await fetchJson('/api/ai/audit');
        console.log('\nGET /api/ai/audit →', audit.status);
        if (audit.status === 200) {
            const j = JSON.parse(audit.body);
            console.log('   source:', j.source);
            console.log('   total_articles:', j.total_articles);
            console.log('   article categories:', j.articles_by_category ? j.articles_by_category.length : 'n/a');
            if (j.articles_by_category) {
                j.articles_by_category.slice(0, 5).forEach(c => console.log('     -', c.category, ':', c.count));
            }
        } else {
            console.log('   BODY:', audit.body.slice(0, 300));
        }
    } catch (e) { console.log('GET /api/ai/audit ERROR:', e.message); }

    console.log('\nDone.');
})();