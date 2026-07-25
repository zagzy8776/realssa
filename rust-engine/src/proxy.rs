use anyhow::{anyhow, Result};

const HISTORY_GUARD: &str = r#"<script>
(function(){
  function safe(fn){
    return function(s,t,u){try{fn.call(history,s,t,u);}catch(e){}};
  }
  if(window.history){
    history.replaceState=safe(history.replaceState);
    history.pushState=safe(history.pushState);
  }
})();
</script>"#;

const LINK_INTERCEPT: &str = r#"<script>
(function(){
  document.addEventListener('click',function(e){
    var el=e.target.closest('a[href]');
    if(!el)return;
    var h=el.getAttribute('href');
    if(!h||h.startsWith('#')||h.startsWith('javascript'))return;
    e.preventDefault();
    try{
      var abs=el.href;
      window.parent.postMessage({type:'REALSSA_NAVIGATE',url:abs},'*');
    }catch(_){}
  },true);
})();
</script>"#;

/// Cloudflare challenge HTML page returned to the iframe when we detect CF.
pub fn cloudflare_fallback(hostname: &str, original_url: &str) -> String {
    format!(r#"<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browser Verification Required</title>
<style>
body{{background:#0b0f17;color:#e5e7eb;font-family:system-ui,sans-serif;
  display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;}}
.card{{text-align:center;max-width:360px;}}
.icon{{font-size:3rem;margin-bottom:1rem;}}
h2{{color:#f59e0b;font-size:1.2rem;margin:0 0 .5rem;}}
p{{color:#9ca3af;font-size:.85rem;line-height:1.6;margin:0 0 1.5rem;}}
a{{display:inline-block;background:#f59e0b;color:#000;font-weight:700;
  padding:.6rem 1.4rem;border-radius:.75rem;text-decoration:none;font-size:.85rem;}}
.domain{{color:#f59e0b;font-weight:600;}}
</style>
</head>
<body>
<div class="card">
  <div class="icon">🛡️</div>
  <h2>Browser Verification Required</h2>
  <p><span class="domain">{hostname}</span> uses Cloudflare bot protection which requires a real browser session.</p>
  <a href="{original_url}" target="_blank" rel="noopener">Open in External Browser ↗</a>
</div>
</body>
</html>"#, hostname = hostname, original_url = original_url)
}

/// Fetch `url`, strip framing headers, inject our scripts, return modified HTML.
pub async fn proxy_page(url: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                     (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
        .redirect(reqwest::redirect::Policy::limited(5))
        .danger_accept_invalid_certs(false)
        .build()?;

    let resp = client
        .get(url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Cache-Control", "no-cache")
        .send()
        .await?;


    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !content_type.contains("text/html") {
        return Err(anyhow!("not HTML: {}", content_type));
    }

    let mut html = resp.text().await?;

    // ── Cloudflare challenge detection ────────────────────────────────────────
    let is_cf = html.contains("__cf_chl_rt_tk")
        || html.contains("cf_chl_")
        || html.contains("cf-chl-bypass")
        || (html.contains("Cloudflare") && html.contains("challenge"));

    if is_cf {
        let parsed = reqwest::Url::parse(url).ok();
        let hostname = parsed.as_ref().and_then(|u| u.host_str()).unwrap_or(url);
        return Ok(cloudflare_fallback(hostname, url));
    }

    // ── Base URL for relative assets ──────────────────────────────────────────
    let origin = reqwest::Url::parse(url)
        .map(|u| format!("{}/", u.origin().ascii_serialization()))
        .unwrap_or_default();

    // 1. Inject <base> tag
    let base_tag = format!("<base href=\"{}\" target=\"_blank\">", origin);
    if let Some(pos) = html.to_lowercase().find("<head") {
        if let Some(close) = html[pos..].find('>') {
            let insert_at = pos + close + 1;
            html.insert_str(insert_at, &format!("\n{}\n{}", base_tag, HISTORY_GUARD));
        }
    } else {
        html = format!("{}\n{}\n{}", base_tag, HISTORY_GUARD, html);
    }

    // 2. Strip meta CSP tags
    // Simple regex-free approach: find and remove common pattern
    while let Some(start) = html.to_lowercase().find("<meta") {
        if let Some(end) = html[start..].find('>') {
            let tag = &html[start..start + end + 1].to_lowercase();
            if tag.contains("http-equiv") && tag.contains("content-security-policy") {
                html.drain(start..start + end + 1);
                continue;
            }
        }
        break; // only strip first match if found, avoid infinite loop
    }

    // 3. Inject link interception before </body>
    if let Some(pos) = html.to_lowercase().rfind("</body>") {
        html.insert_str(pos, &format!("{}\n", LINK_INTERCEPT));
    } else {
        html.push_str(LINK_INTERCEPT);
    }

    Ok(html)
}
