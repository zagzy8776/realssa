const decode = s => String(s || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").trim();
function imageUrl(value, base) { try { if (!value) return null; const u = new URL(decode(value), base); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || /\.(mp4|mp3|webm|m3u8|pdf|svg)$/i.test(u.pathname) || /(?:^|[\/_.-])(?:logo|favicon|avatar|sprite|placeholder|pixel)(?:[\/_.-]|$)/i.test(u.pathname)) return null; return u.href; } catch { return null; } }
function attrs(tag) { const a = {}; for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) a[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4]); return a; }
function htmlImages(html, base) {
 const list = []; const add = (v, score) => { const url = imageUrl(v, base); if (url) list.push({url, score}); };
 const text = String(html || '').slice(0, 2097152);
 for (const m of text.matchAll(/<(?:meta|link|img|source)\b[^>]*>/gi)) { const a = attrs(m[0]);
 if (/^(og:image(?::url|:secure_url)?|twitter:image(?::src)?|thumbnail)$/.test((a.property || a.name || '').toLowerCase())) add(a.content, 100);
 if (a.rel === 'image_src') add(a.href, 90);
 if (/^<(img|source)\b/i.test(m[0])) { if ((a.width && Number(a.width) <= 2) || (a.height && Number(a.height) <= 2)) continue;
 for (const k of ['data-srcset','srcset']) for (const entry of (a[k] || '').split(',')) { const [u, size] = entry.trim().split(/\s+/); add(u, 60 + Math.min(parseFloat(size) || 0, 4000)/4000); }
 for (const k of ['data-src','data-original','data-lazy-src','src']) add(a[k], 50); } }
 const addImage = v => { if (typeof v === 'string') add(v,95); else if (Array.isArray(v)) v.forEach(addImage); else if (v && typeof v === 'object') addImage(v.url || v.contentUrl); };
 const walk = (v, depth=0) => { if (!v || typeof v !== 'object' || depth>15) return; if ([].concat(v['@type'] || []).some(t => /Article|BlogPosting/.test(t))) addImage(v.image); for (const child of Object.values(v)) if (child && typeof child === 'object') walk(child,depth+1); };
 for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) if (attrs(m[1]).type === 'application/ld+json') { try { walk(JSON.parse(m[2])); } catch {} }
 return [...new Set(list.sort((a,b)=>b.score-a.score).map(c=>c.url))]; }
function feedImages(item={}, base=item.link) { const list=[]; const visit=(v,depth=0)=> { if (!v || depth>10) return; if (Array.isArray(v)) { v.forEach(x=>visit(x,depth+1)); return; } if (typeof v !== 'object') return; const a=v.$ || v; if ((!a.type || /^image\//i.test(a.type)) && (!a.medium || a.medium==='image')) { const u=imageUrl(a.url || a.href,base); if(u) list.push(u); } for(const k of ['media:group','media:content','media:thumbnail','enclosure']) visit(v[k],depth+1); }; visit(item); for(const k of ['content:encoded','content','description','summary']) list.push(...htmlImages(item[k],base)); return [...new Set(list)]; }
module.exports = { imageUrl, htmlImages, feedImages };