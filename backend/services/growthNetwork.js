const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');

// Pin each request to its checked DNS answer, including every redirect.
function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)));
  }
  // Only global unicast IPv6; excludes local, mapped and transition addresses.
  return net.isIP(address) === 6 && /^[23]/i.test(address) &&
    !/^200[12]:/i.test(address);
}

async function request(url, { timeout = 6000, maxBytes = 2097152, method = 'GET',
  headers = {}, body, redirects = 3 } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
    throw new Error('Unsupported URL');
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  let dnsTimer;
  const addresses = await Promise.race([
    dns.lookup(hostname, { all: true }),
    new Promise((_, reject) => {
      dnsTimer = setTimeout(() => reject(new Error('DNS lookup timed out')), timeout);
    })
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(a => !publicAddress(a.address)))
    throw new Error('Non-public destination');
  const chosen = addresses[0];
  const transport = target.protocol === 'https:' ? https : http;
  const result = await new Promise((resolve, reject) => {
    const req = transport.request(target, {
      method,
      headers: { 'User-Agent': 'RealSSA-Growth/1.0 (+https://www.realssanews.com.ng)', ...headers },
      lookup: (_host, options, callback) => options.all
        ? callback(null, [chosen]) : callback(null, chosen.address, chosen.family),
    }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) req.destroy(new Error('Response exceeds size limit'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({
        status: res.statusCode, headers: res.headers,
        body: Buffer.concat(chunks), url: target.href
      }));
    });
    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), timeout);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end(body);
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
    if (!redirects || method !== 'GET') throw new Error('Redirect limit');
    const next = new URL(result.headers.location, target);
    if (next.origin !== target.origin && headers.Authorization) throw new Error('Cross-origin credential redirect');
    return request(next.href, { timeout, maxBytes, method, headers, redirects: redirects - 1 });
  }
  return result;
}
module.exports = { request, publicAddress };
