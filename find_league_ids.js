const https = require('https');
let b = '';
https.get('https://api.football-data-api.com/league-list?key=example', r => {
  r.on('data', c => b += c);
  r.on('end', () => {
    const parsed = JSON.parse(b);
    // The API wraps data in a 'data' property
    const d = parsed.data || parsed;
    const arr = Array.isArray(d) ? d : Object.values(d);
    arr.forEach(l => {
      if (l.country === 'Greece' || (l.country === 'England' && ['League One', 'League Two'].includes(l.league_name))) {
        const latest = l.season[l.season.length - 1];
        console.log(`${l.country} | ${l.league_name} | latest season ID: ${latest.id} (${latest.year})`);
      }
    });
  });
});
