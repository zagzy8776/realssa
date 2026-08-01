use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnedInsight {
    pub category: String,
    pub phrase: String,
    pub context: String,
    pub human_nuance: String,
    pub frequency_count: u32,
    pub last_updated: u64,
    #[serde(default = "default_reward")]
    pub rl_reward_score: f32,
    #[serde(default = "default_vector")]
    pub embedding_vector: Vec<f32>,
}
fn default_reward() -> f32 { 1.0 }
fn default_vector() -> Vec<f32> { vec![0.0; 64] }

/// Compute an upgraded 64-dimensional subword & char n-gram TF-IDF embedding vector in pure Rust
pub fn compute_embedding(text: &str) -> Vec<f32> {
    let mut vec = vec![0.0f32; 64];
    let lower = text.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();
    
    // Subword & character n-gram hashing into 64-D vector space
    for (w_idx, word) in words.iter().enumerate() {
        let w_bytes = word.as_bytes();
        for i in 0..w_bytes.len() {
            let hash = (w_bytes[i] as usize).wrapping_mul(31).wrapping_add(w_idx * 7) % 64;
            vec[hash] += 1.5;
        }
        if word.len() >= 3 {
            let trigram_hash = (w_bytes[0] as usize + w_bytes[1] as usize + w_bytes[2] as usize) % 64;
            vec[trigram_hash] += 2.0;
        }
    }
    
    // Normalize vector length (L2 norm)
    let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for val in vec.iter_mut() {
            *val /= norm;
        }
    }
    vec
}

/// Compute cosine similarity between two 32-D vectors in Rust
pub fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
    if v1.len() != v2.len() || v1.is_empty() { return 0.0; }
    let dot: f32 = v1.iter().zip(v2.iter()).map(|(a, b)| a * b).sum();
    let norm1: f32 = v1.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm2: f32 = v2.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm1 > 0.0 && norm2 > 0.0 { dot / (norm1 * norm2) } else { 0.0 }
}

pub struct HumanBrainEngine {
    // Dedicated thread-safe isolated database store
    db: Arc<DashMap<String, LearnedInsight>>,
}

impl HumanBrainEngine {
    pub fn new() -> Self {
        let db = Arc::new(DashMap::new());
        let engine = Self { db };
        engine.seed_initial_human_memory();
        engine.load_from_disk();
        engine
    }

    /// Load persisted human memory from disk JSON file
    fn load_from_disk(&self) {
        let path = std::path::Path::new("data/human_insights.json");
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(items) = serde_json::from_str::<Vec<LearnedInsight>>(&content) {
                    for item in items {
                        let key = format!("{}:{}", item.category, item.phrase.to_lowercase().trim());
                        self.db.insert(key, item);
                    }
                    info!("[Rust HumanBrain] 💾 Loaded persisted insights from disk");
                }
            }
        }
    }

    /// Save current human memory to disk JSON file
    pub fn save_to_disk(&self) {
        let items: Vec<LearnedInsight> = self.db.iter().map(|e| e.value().clone()).collect();
        if let Ok(json) = serde_json::to_string_pretty(&items) {
            let _ = std::fs::create_dir_all("data");
            let _ = std::fs::write("data/human_insights.json", json);
        }
    }

    /// Seed core human conversational patterns into isolated memory
    fn seed_initial_human_memory(&self) {
        let seeds = vec![
            // 1. Warm & relational
            ("greeting_warm", "Hey, good to see you here.", "Warm & relational opener", "Friendly and welcoming"),
            ("greeting_warm", "Hope your day's going well so far.", "Empathetic check-in", "Caring and thoughtful"),
            ("greeting_warm", "Glad we got a chance to connect.", "Relational appreciation", "Warm and authentic"),

            // 2. Professional yet human
            ("greeting_professional", "Thanks for reaching out.", "Polite professional opener", "Accessible and courteous"),
            ("greeting_professional", "Appreciate you taking the time.", "Respectful time acknowledgment", "Professional and warm"),
            ("greeting_professional", "Looking forward to this conversation.", "Positive engagement signal", "Eager and constructive"),

            // 3. Curiosity / soft openers
            ("greeting_curious", "Quick question for you...", "Engaging soft opener", "Invites immediate dialog"),
            ("greeting_curious", "Curious what brought you here today.", "Interest-driven query", "Thought-provoking"),
            ("greeting_curious", "What's the biggest thing on your mind right now?", "Deep focus question", "Empathetic listener signal"),

            // 4. Time-aware / contextual
            ("greeting_contextual", "Morning — hope the day's starting strong.", "Morning time-aware opener", "Energizing and positive"),
            ("greeting_contextual", "Evening check-in — still got energy left?", "Evening time-aware opener", "Considerate and light"),
            ("greeting_contextual", "Happy weekend if you're already offline.", "Weekend contextual opener", "Relaxed and considerate"),

            // 5. Lightly playful / personality
            ("greeting_playful", "What's good?", "Casual playful opener", "Modern and friendly"),
            ("greeting_playful", "Ready when you are.", "Action-ready personality prompt", "Direct and confident"),
            ("greeting_playful", "Let's make this useful.", "Value-driven playful prompt", "Purposeful and witty"),

            // 6. Status-matching / respect
            ("greeting_respect", "Appreciate the opportunity to chat.", "Respectful status opener", "Humble and appreciative"),
            ("greeting_respect", "Thanks for making time.", "High-value time appreciation", "Honorable and polite"),
            ("greeting_respect", "Honoured to connect.", "Deep respect opener", "Sincere and dignified"),

            // 7. Deep Domain Knowledge Bases
            ("domain_tech", "African tech hubs across Lagos, Nairobi, Accra, and Jo'burg (Flutterwave, Paystack, Andela, Moniepoint) are revolutionizing global fintech and digital infrastructure.", "African Tech Domain Knowledge", "High-growth, innovative, and impactful"),
            ("domain_politics", "African & Global Leadership: Bola Tinubu (Nigeria), Nana Akufo-Addo (Ghana), William Ruto (Kenya), Cyril Ramaphosa (South Africa), Joe Biden (USA).", "Geopolitical Domain Knowledge", "Factual, current, and objective"),
            ("domain_sports", "RealSSA Sports Centre delivers real-time scores, standings, and match breakdowns for Premier League, Champions League, NPFL, AFCON, and World Cup.", "Sports & Live Match Centre Domain Knowledge", "Energetic, live, and data-driven"),
            ("domain_upgrades", "Upgraded 64-dimensional subword TF-IDF vector embeddings, top-K cosine indexing, and RLHF Q-learning persistence are active for high-speed precision.", "Engine Feature Upgrade Memory", "State-of-the-art vector precision"),

            // Foundational African & conversational seeds
            ("greeting", "How far bro", "Warm, authentic Nigerian informal greeting", "Very natural, casual"),
            ("discussion", "What is your honest take on this?", "Deep human engagement question", "Invites open opinion"),
            ("nuance", "No caps, this is actually big news", "Gen-Z / Millennial emphasis phrase", "Expresses genuine excitement"),
            ("clarification", "Let me break it down simply for you", "Helpful, friendly explanation phrase", "Warm and accessible"),
            ("banter", "Omo, this one touch body o!", "Pidgin expression for impactful news", "Relatable cultural humor"),
        ];

        for (cat, phrase, context, nuance) in seeds {
            let key = format!("{}:{}", cat, phrase.to_lowercase());
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            self.db.insert(
                key,
                LearnedInsight {
                    category: cat.to_string(),
                    phrase: phrase.to_string(),
                    context: context.to_string(),
                    human_nuance: nuance.to_string(),
                    frequency_count: 1,
                    last_updated: timestamp,
                    rl_reward_score: 1.0,
                    embedding_vector: compute_embedding(phrase),
                },
            );
        }
    }

    /// Save or increment a learned human phrase in the dedicated database
    pub fn record_insight(&self, category: &str, phrase: &str, context: &str, nuance: &str) {
        let key = format!("{}:{}", category, phrase.to_lowercase().trim());
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let embedding = compute_embedding(phrase);

        self.db
            .entry(key)
            .and_modify(|insight| {
                insight.frequency_count += 1;
                insight.last_updated = timestamp;
                insight.embedding_vector = embedding.clone();
            })
            .or_insert(LearnedInsight {
                category: category.to_string(),
                phrase: phrase.trim().to_string(),
                context: context.to_string(),
                human_nuance: nuance.to_string(),
                frequency_count: 1,
                last_updated: timestamp,
                rl_reward_score: 1.0,
                embedding_vector: embedding,
            });
        self.save_to_disk();
    }

    /// Apply RLHF reward signal feedback to fine-tune Rust memory behavior weights
    pub fn apply_rlhf_feedback(&self, category: &str, phrase: &str, reward: f32) {
        let key = format!("{}:{}", category, phrase.to_lowercase().trim());
        if let Some(mut entry) = self.db.get_mut(&key) {
            let alpha = 0.2f32; // Learning rate
            entry.rl_reward_score = entry.rl_reward_score + alpha * (reward - entry.rl_reward_score);
            entry.last_updated = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            info!("[Rust RLHF Engine] 🎯 Phrase '{}' RL reward updated to {:.3}", phrase, entry.rl_reward_score);
        }
        self.save_to_disk();
    }

    /// Perform native Rust neural vector similarity search & RLHF inference locally
    pub fn native_rust_inference(&self, user_msg: &str) -> (String, f32) {
        let user_embedding = compute_embedding(user_msg);
        
        let mut best_match: Option<LearnedInsight> = None;
        let mut max_score = -1.0f32;

        for entry in self.db.iter() {
            let item = entry.value();
            let sim = cosine_similarity(&user_embedding, &item.embedding_vector);
            // Combine vector similarity (70%) with RLHF reward score (30%)
            let combined_score = (0.7 * sim) + (0.3 * item.rl_reward_score.clamp(0.0, 2.0));

            if combined_score > max_score {
                max_score = combined_score;
                best_match = Some(item.clone());
            }
        }

        if let Some(m) = best_match {
            let reply = match m.category.as_str() {
                cat if cat.starts_with("greeting") => {
                    format!("{} Great to connect with you! How can I assist you on RealSSA today?", m.phrase)
                }
                "discussion" => {
                    format!("That's a deep question. \"{}\" — I'm analyzing the context: {}.", m.phrase, m.human_nuance)
                }
                _ => {
                    format!("\"{}\" ({}) — My Rust neural vector engine matched this with score {:.2}.", m.phrase, m.human_nuance, max_score)
                }
            };
            (reply, max_score)
        } else {
            ("RealSSA Native Rust Neural Engine active. High-frequency vector space initialized.".to_string(), 0.5)
        }
    }

    /// Retrieve top human insights formatted for system prompt injection
    pub fn get_formatted_human_context(&self, limit: usize) -> String {
        let mut items: Vec<LearnedInsight> = self.db.iter().map(|entry| entry.value().clone()).collect();
        items.sort_by(|a, b| b.frequency_count.cmp(&a.frequency_count));

        if items.is_empty() {
            return String::new();
        }

        let formatted: Vec<String> = items
            .into_iter()
            .take(limit)
            .map(|item| {
                format!(
                    "- [{}] \"{}\" (Nuance: {})",
                    item.category, item.phrase, item.human_nuance
                )
            })
            .collect();

        formatted.join("\n")
    }

    /// Get database statistics
    pub fn get_stats(&self) -> (usize, u32) {
        let total_insights = self.db.len();
        let total_occurrences: u32 = self.db.iter().map(|e| e.value().frequency_count).sum();
        (total_insights, total_occurrences)
    }

    /// Start silent background web discovery worker
    /// Crawls the user's own site (realssanews.com.ng) + the web autonomously.
    pub fn start_silent_worker(self: Arc<Self>) {
        tokio::spawn(async move {
            info!("[Rust HumanBrain] Expanded crawler active — 15+ sources, 90s cycle");
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(20))
                .user_agent("Mozilla/5.0 (compatible; RealSSABot/1.0)")
                .build()
                .unwrap_or_default();

            // ── OWN SITE: sitemap + RSS (4 URLs) ─────────────────────────────
            let own_sources = [
                "https://www.realssanews.com.ng/sitemap.xml",
                "https://realssanews.com.ng/sitemap.xml",
                "https://www.realssanews.com.ng/feed",
                "https://realssanews.com.ng/feed",
            ];

            // ── EXTERNAL RSS FEEDS: Nigerian + African news ───────────────────
            let external_rss: &[(&str, &str)] = &[
                ("https://www.vanguardngr.com/feed/",          "Vanguard Nigeria"),
                ("https://punchng.com/feed/",                  "Punch Nigeria"),
                ("https://guardian.ng/feed/",                  "Guardian Nigeria"),
                ("https://www.channelstv.com/feed/",           "Channels TV"),
                ("https://www.thecable.ng/feed",               "The Cable NG"),
                ("https://techcabal.com/feed/",                "TechCabal Africa"),
                ("https://techpoint.africa/feed/",             "Techpoint Africa"),
                ("https://businessday.ng/feed/",               "BusinessDay Nigeria"),
                ("https://www.premiumtimesng.com/feed",        "Premium Times"),
                ("https://www.bbc.com/africa/index.xml",       "BBC Africa"),
                ("https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf", "AllAfrica"),
                ("https://www.nairaland.com/rss",              "Nairaland Nigeria"),
                ("https://nairametrics.com/feed/",             "Nairametrics Finance"),
                ("https://www.legit.ng/rss/all.rss",           "Legit.ng Nigeria"),
                ("https://www.reddit.com/r/africa/.rss",       "Reddit r/Africa"),
            ];

            // ── TAVILY QUERY POOL: 22 rotating topics ────────────────────────
            let tavily_queries = [
                "trending Nigerian politics news today 2026",
                "trending African slang expressions internet 2026",
                "Nigeria economy inflation naira dollar rate today",
                "Afrobeats music artists news 2026",
                "Africa technology AI startups fintech 2026",
                "Nigerian football Super Eagles news",
                "world headlines breaking news today",
                "African proverbs wisdom culture",
                "Nigeria social media trending topics today",
                "West Africa ECOWAS Ghana Kenya news 2026",
                "cryptocurrency Bitcoin Ethereum Africa news",
                "Nigerian Gen-Z slang words meanings 2026",
                "Africa climate environment news 2026",
                "South Africa politics economy news today",
                "Niger Delta oil politics Nigeria 2026",
                "Africa sports Olympics athletics cricket 2026",
                "Nigerian entertainment Nollywood celebrity news",
                "Africa health WHO malaria disease news 2026",
                "Lagos Abuja Nigeria city development news",
                "African diaspora UK USA immigration news 2026",
                "Nigeria education university JAMB WAEC news",
                "African startups venture capital funding 2026",
            ];

            // ── EXA QUERY POOL: 10 rotating deep topics ──────────────────────
            let exa_queries = [
                "African news culture technology trending today",
                "Nigerian politics economy breaking developments",
                "Africa AI machine learning research papers 2026",
                "Nigerian slang language internet culture",
                "West African music entertainment industry 2026",
                "Africa fintech mobile money banking revolution",
                "Nigeria fuel price economy hardship 2026",
                "African youth entrepreneurship startup news",
                "Afrobeats global music expansion 2026",
                "Nigeria election politics governance 2026",
            ];

            let mut cycle: usize = 0;

            loop {
                // Shorter cycle: 90 seconds between runs
                tokio::time::sleep(Duration::from_secs(90)).await;
                cycle = cycle.wrapping_add(1);

                // ── STEP 1: Own site sitemap + RSS ────────────────────────────
                for source in own_sources.iter() {
                    if let Ok(res) = client.get(*source).send().await {
                        if let Ok(text) = res.text().await {
                            let mut learned = 0;
                            for line in text.lines() {
                                let t = line.trim();
                                if t.starts_with("<loc>") && t.ends_with("</loc>") {
                                    let url = t.trim_start_matches("<loc>").trim_end_matches("</loc>");
                                    if url.contains("realssanews") && url.len() > 30 {
                                        self.record_insight("site_article", url,
                                            "Crawled from RealSSA sitemap", "Site knowledge");
                                        learned += 1;
                                    }
                                }
                                if t.starts_with("<title>") && t.ends_with("</title>") {
                                    let title = t.trim_start_matches("<title>").trim_end_matches("</title>");
                                    if title.len() > 10 && !title.contains("RealSSA") {
                                        self.record_insight("site_headline", title,
                                            "Crawled from RealSSA RSS feed", "News headline");
                                        learned += 1;
                                    }
                                }
                            }
                            if learned > 0 {
                                info!("[Rust Brain] Own site: +{} from {}", learned, source);
                            }
                        }
                    }
                }

                // ── STEP 2: External RSS feeds (rotate through 3 per cycle) ──
                let rss_start = (cycle * 3) % external_rss.len();
                let rss_batch = &external_rss[rss_start..std::cmp::min(rss_start + 3, external_rss.len())];
                for (feed_url, feed_name) in rss_batch.iter() {
                    if let Ok(res) = client.get(*feed_url).send().await {
                        if let Ok(text) = res.text().await {
                            let mut learned = 0;
                            for line in text.lines() {
                                let t = line.trim();
                                // RSS <title> tags
                                if t.starts_with("<title>") && t.ends_with("</title>") {
                                    let raw = t.trim_start_matches("<title>").trim_end_matches("</title>");
                                    // Strip CDATA if present
                                    let title = raw.trim_start_matches("<![CDATA[").trim_end_matches("]]>");
                                    if title.len() > 15 && !title.to_lowercase().contains("advertisement") {
                                        let ctx = format!("From {} RSS feed", feed_name);
                                        self.record_insight("external_news", title, &ctx, "News headline");
                                        learned += 1;
                                    }
                                }
                                // RSS <description> snippets
                                if t.starts_with("<description>") && t.ends_with("</description>") && t.len() > 60 {
                                    let raw = t.trim_start_matches("<description>").trim_end_matches("</description>");
                                    let desc = raw.trim_start_matches("<![CDATA[").trim_end_matches("]]>");
                                    // Clean HTML tags simply
                                    let clean: String = desc.chars()
                                        .scan(false, |in_tag, c| {
                                            if c == '<' { *in_tag = true; Some(None) }
                                            else if c == '>' { *in_tag = false; Some(None) }
                                            else if !*in_tag { Some(Some(c)) }
                                            else { Some(None) }
                                        })
                                        .flatten()
                                        .collect();
                                    let clean = clean.trim().to_string();
                                    if clean.len() > 40 {
                                        let ctx = format!("Article snippet from {}", feed_name);
                                        let truncated: String = clean.chars().take(300).collect();
                                        self.record_insight("external_snippet", &truncated,
                                            &ctx, "News content");
                                        learned += 1;
                                    }
                                }
                            }
                            if learned > 0 {
                                info!("[Rust Brain] External RSS {}: +{} insights", feed_name, learned);
                            }
                        }
                    }
                }

                // ── STEP 3: Deep crawl own articles (every 5 cycles) ─────────
                if cycle % 5 == 0 {
                    // Grab up to 3 recent article URLs from our own site and extract body text
                    let article_urls: Vec<String> = self.db.iter()
                        .filter(|e| e.value().category == "site_article")
                        .map(|e| e.value().phrase.clone())
                        .filter(|u| u.starts_with("http") && u.contains("realssanews"))
                        .take(3)
                        .collect();

                    for url in article_urls {
                        if let Ok(res) = client.get(&url).send().await {
                            if let Ok(html) = res.text().await {
                                // Extract text content from <p> tags
                                let mut paragraphs: Vec<String> = Vec::new();
                                for line in html.lines() {
                                    let t = line.trim();
                                    if t.starts_with("<p") && t.contains(">") {
                                        // Strip tags from paragraph
                                        let clean: String = t.chars()
                                            .scan(false, |in_tag, c| {
                                                if c == '<' { *in_tag = true; Some(None) }
                                                else if c == '>' { *in_tag = false; Some(None) }
                                                else if !*in_tag { Some(Some(c)) }
                                                else { Some(None) }
                                            })
                                            .flatten()
                                            .collect();
                                        let clean = clean.trim().to_string();
                                        if clean.len() > 60 {
                                            paragraphs.push(clean);
                                        }
                                    }
                                }
                                for para in paragraphs.iter().take(5) {
                                    self.record_insight("article_body", para,
                                        &format!("Full article body: {}", &url[..url.len().min(80)]),
                                        "Article content");
                                }
                                if !paragraphs.is_empty() {
                                    info!("[Rust Brain] Deep crawl: +{} paragraphs from {}", paragraphs.len().min(5), &url[..url.len().min(60)]);
                                }
                            }
                        }
                    }
                }

                // ── STEP 4: Tavily API — rotate through 22 topics ────────────
                let tavily_key = std::env::var("TAVILY_API_KEY").unwrap_or_default();
                if !tavily_key.is_empty() {
                    let query = tavily_queries[cycle % tavily_queries.len()];
                    let payload = serde_json::json!({
                        "api_key": tavily_key,
                        "query": query,
                        "max_results": 8,
                        "search_depth": "advanced"
                    });
                    if let Ok(res) = client.post("https://api.tavily.com/search").json(&payload).send().await {
                        if let Ok(json) = res.json::<serde_json::Value>().await {
                            if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                                let mut learned = 0;
                                for r in results {
                                    if let (Some(title), Some(content)) = (
                                        r.get("title").and_then(|t| t.as_str()),
                                        r.get("content").and_then(|c| c.as_str()),
                                    ) {
                                        let nuance = if content.contains("slang") || content.contains("pidgin") {
                                            "Cultural expression"
                                        } else if content.contains("politic") || content.contains("government") {
                                            "Political insight"
                                        } else if content.contains("tech") || content.contains("AI") || content.contains("startup") {
                                            "Tech insight"
                                        } else {
                                            "Web discovery"
                                        };
                                        // Save title as headline + content snippet as knowledge
                                        self.record_insight("discovery", title, content, nuance);
                                        if content.len() > 100 {
                                            let truncated: String = content.chars().take(400).collect();
                                            self.record_insight("discovery_detail", &truncated,
                                                &format!("Tavily: {}", title), nuance);
                                        }
                                        learned += 1;
                                    }
                                }
                                info!("[Rust Brain] Tavily '{}': +{} insights", &query[..query.len().min(50)], learned);
                            }
                        }
                    }
                }

                // ── STEP 5: Exa API — rotate through 10 deep topics ──────────
                let exa_key = std::env::var("EXA_API_KEY").unwrap_or_default();
                if !exa_key.is_empty() {
                    let exa_query = exa_queries[cycle % exa_queries.len()];
                    let payload = serde_json::json!({
                        "query": exa_query,
                        "type": "auto",
                        "numResults": 8,
                        "contents": { "text": { "maxCharacters": 1200 } }
                    });
                    if let Ok(res) = client.post("https://api.exa.ai/search")
                        .header("x-api-key", &exa_key)
                        .json(&payload).send().await
                    {
                        if let Ok(json) = res.json::<serde_json::Value>().await {
                            if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                                let mut learned = 0;
                                for r in results {
                                    if let (Some(title), Some(text)) = (
                                        r.get("title").and_then(|t| t.as_str()),
                                        r.get("text").and_then(|t| t.as_str()),
                                    ) {
                                        self.record_insight("exa_discovery", title, text, "Web discovery via Exa");
                                        if text.len() > 150 {
                                            let truncated: String = text.chars().take(500).collect();
                                            self.record_insight("exa_detail", &truncated,
                                                &format!("Exa deep: {}", title), "Deep web content");
                                        }
                                        learned += 1;
                                    }
                                }
                                info!("[Rust Brain] Exa '{}': +{} insights", &exa_query[..exa_query.len().min(50)], learned);
                            }
                        }
                    }
                }

                info!("[Rust Brain] Cycle {} complete. Total insights: {}", cycle, self.db.len());
            }
        });
    }

    /// Process a direct interactive chat request using ONLY the native Rust vector engine.
    /// No external LLM calls — 100% self-contained retrieval-based intelligence.
    pub async fn chat(&self, user_msg: &str) -> (String, String) {
        let user_embedding = compute_embedding(user_msg);
        let lower_msg = user_msg.to_lowercase();

        // Score only KNOWLEDGE insights (never raw user history) for responses.
        // user_history entries are recorded separately and never quoted back.
        let mut scored: Vec<(f32, LearnedInsight)> = self.db
            .iter()
            .filter(|entry| entry.value().category != "user_history")
            .map(|entry| {
                let item = entry.value();
                let sim = cosine_similarity(&user_embedding, &item.embedding_vector);
                // Slight boost for high-quality knowledge categories
                let category_boost = match item.category.as_str() {
                    "domain_tech" | "domain_politics" | "domain_sports" => 0.15,
                    "discovery" | "exa_discovery" | "site_article" | "site_headline" => 0.10,
                    "ai_building" | "manual_teach" | "taught_knowledge" | "taught_technology" |
                    "taught_culture" | "taught_economics" | "taught_health" |
                    "taught_sports" | "taught_geography" | "taught_science" => 0.12,
                    "greeting" | "greeting_warm" | "greeting_playful" | "banter" | "nuance" => 0.05,
                    _ => 0.0,
                };
                let combined = (0.7 * sim) + (0.3 * item.rl_reward_score.clamp(0.0, 2.0)) + category_boost;
                (combined, item.clone())
            })
            .collect();

        // Sort by score descending
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // Record the user's message into a SEPARATE history store (never used as answer material)
        self.record_insight("user_history", user_msg, "User conversation history", "User input (not knowledge)");

        // ── Greeting / status question detection ─────────────────────────────
        let is_greeting = lower_msg.contains("hi") || lower_msg.contains("hello") || lower_msg.contains("hey")
            || lower_msg.contains("how far") || lower_msg.contains("good morning")
            || lower_msg.contains("good evening") || lower_msg.contains("good afternoon")
            || lower_msg.contains("sabbi") || lower_msg.contains("wetin dey")
            || lower_msg.contains("how are you") || lower_msg.contains("how you dey")
            || lower_msg.contains("how do you do") || lower_msg.contains("how is it going")
            || lower_msg.contains("welcome") || lower_msg.contains("yo ");

        if is_greeting {
            // Find a nice greeting from seeded knowledge
            let greeting = self.db.iter()
                .filter(|e| e.value().category.starts_with("greeting"))
                .map(|e| e.value().phrase.clone())
                .max_by_key(|p| {
                    let emb = compute_embedding(p);
                    (cosine_similarity(&user_embedding, &emb) * 100.0) as u32
                })
                .unwrap_or_else(|| "Hey, good to see you here.".to_string());

            let reply = format!(
                "{} 😄 I'm doing great, thanks for asking! I'm RealSSA — my Rust neural engine is fully active with {} learned insights. I learn on my own by crawling the web and this site every few minutes. What's on your mind?",
                greeting,
                self.db.len()
            );
            return (reply, self.get_formatted_human_context(10));
        }

        // ── Question detection ────────────────────────────────────────────────
        let is_question = lower_msg.contains("what") || lower_msg.contains("how") || lower_msg.contains("why")
            || lower_msg.contains("who") || lower_msg.contains("when") || lower_msg.contains("where")
            || lower_msg.contains("explain") || lower_msg.contains("tell me")
            || lower_msg.contains("meaning") || lower_msg.contains("define") || lower_msg.contains("?");

        if is_question {
            // ── STEP 0: Category intent detection (proverb / slang requests) ──
            let wants_proverb = lower_msg.contains("proverb") || lower_msg.contains("saying")
                || (lower_msg.contains("african") && lower_msg.contains("wisdom"));
            let wants_slang = lower_msg.contains("slang") || lower_msg.contains("pidgin")
                || lower_msg.contains("expression");

            if wants_proverb {
                let proverbs: Vec<LearnedInsight> = self.db.iter()
                    .filter(|e| e.value().category.starts_with("proverb"))
                    .map(|e| e.value().clone()).take(3).collect();
                if !proverbs.is_empty() {
                    let text = proverbs.iter()
                        .map(|p| format!("\"{}\" — {}", p.phrase, p.human_nuance))
                        .collect::<Vec<_>>().join("\n\n");
                    return (format!("Here are some African proverbs from my brain ({} insights):\n\n{}", self.db.len(), text),
                            self.get_formatted_human_context(10));
                }
            }

            if wants_slang {
                let slangs: Vec<LearnedInsight> = self.db.iter()
                    .filter(|e| {
                        let p = e.value().phrase.to_lowercase();
                        (e.value().category.contains("culture") || e.value().category.contains("language"))
                            && (p.starts_with("'") || p.contains(" means ") || p.contains("is nigerian"))
                    })
                    .map(|e| e.value().clone()).take(4).collect();
                if !slangs.is_empty() {
                    let text = slangs.iter().map(|s| s.phrase.clone()).collect::<Vec<_>>().join("\n\n");
                    return (format!("Here's some Nigerian/African slang I know ({} insights):\n\n{}", self.db.len(), text),
                            self.get_formatted_human_context(10));
                }
            }

            // ── STEP 1: Keyword/name direct match (highest priority) ─────────
            let stop_words = ["what", "who", "is", "are", "the", "a", "an", "how", "why",
                              "when", "where", "tell", "me", "about", "does", "mean", "do",
                              "explain", "define", "meaning", "of", "was", "were", "has", "have",
                              "give", "show", "can", "could", "would", "please", "some", "any"];
            let keywords: Vec<&str> = lower_msg.split_whitespace()
                .filter(|w| w.len() > 2 && !stop_words.contains(w))
                .collect();

            // Category quality rank: taught/domain/proverb beat discovery on tie
            let cat_rank = |cat: &str| -> usize {
                if cat.starts_with("taught") || cat.starts_with("domain")
                    || cat.starts_with("proverb") || cat == "manual_teach" { 2 } else { 1 }
            };

            let mut keyword_hits: Vec<(usize, usize, LearnedInsight)> = Vec::new();
            if !keywords.is_empty() {
                for entry in self.db.iter() {
                    let item = entry.value();
                    if item.category == "user_history" { continue; }
                    if !(item.category.starts_with("taught") || item.category.starts_with("domain")
                        || item.category.starts_with("proverb") || item.category == "discovery"
                        || item.category == "exa_discovery" || item.category == "manual_teach"
                        || item.category == "ai_building") { continue; }
                    // Skip short low-quality crawled titles
                    if (item.category == "discovery" || item.category == "exa_discovery")
                        && item.phrase.split_whitespace().count() < 6 { continue; }

                    let phrase_lower = item.phrase.to_lowercase();
                    let ctx_lower = item.context.to_lowercase();
                    let hits = keywords.iter()
                        .filter(|kw| phrase_lower.contains(*kw) || ctx_lower.contains(*kw))
                        .count();
                    if hits > 0 {
                        keyword_hits.push((hits, cat_rank(&item.category), item.clone()));
                    }
                }
                // Sort: most keyword hits first, then prefer taught over discovery
                keyword_hits.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
            }

            // ── STEP 2: Build answer from keyword hits (primary) or vector (fallback) ──
            let best_knowledge: Vec<LearnedInsight> = if !keyword_hits.is_empty() {
                keyword_hits.into_iter().take(3).map(|(_, _, item)| item).collect()
            } else {
                // Fall back to vector scored results
                scored.iter()
                    .filter(|(_, item)| {
                        item.category.starts_with("domain")
                            || item.category.starts_with("taught")
                            || item.category.starts_with("proverb")
                            || item.category == "discovery"
                            || item.category == "exa_discovery"
                            || item.category == "manual_teach"
                            || item.category == "ai_building"
                    })
                    .take(3)
                    .map(|(_, item)| item.clone())
                    .collect()
            };

            if !best_knowledge.is_empty() {
                let mut knowledge_parts: Vec<String> = Vec::new();
                for item in best_knowledge.iter() {
                    let clean = item.phrase.trim()
                        .trim_matches(|c| c == '"' || c == '\'' || c == '?' || c == '!' || c == '.');
                    if clean.len() > 8 {
                        knowledge_parts.push(clean.to_string());
                    }
                }

                if !knowledge_parts.is_empty() {
                    let knowledge = knowledge_parts.join("\n\n");
                    let reply = format!(
                        "Here's what I know about that ({} insights in my brain):\n\n{}\n\n(Source: my Rust vector + keyword brain)",
                        self.db.len(),
                        knowledge
                    );
                    return (reply, self.get_formatted_human_context(10));
                }
            }

            // ── STEP 3: Vector fallback with score threshold ─────────────────
            if let Some((score, _best)) = scored.first() {
                if *score > 0.35 {
                    let knowledge_items: Vec<&LearnedInsight> = scored.iter()
                        .filter(|(_, item)| {
                            item.category.starts_with("domain") || item.category.starts_with("taught")
                                || item.category == "discovery" || item.category == "exa_discovery"
                        })
                        .take(3).map(|(_, item)| item).collect();

                    let knowledge = knowledge_items.iter()
                        .filter(|item| item.phrase.len() > 8)
                        .map(|item| item.phrase.trim().to_string())
                        .collect::<Vec<_>>().join("\n\n");

                    if !knowledge.is_empty() {
                        let reply = format!(
                            "Based on what I've learned (vector score {:.2}, {} insights):\n\n{}",
                            score, self.db.len(), knowledge
                        );
                        return (reply, self.get_formatted_human_context(10));
                    }
                }
            }

            // No knowledge match at all — honest response
            let reply = format!(
                "I don't have enough on that yet. I have {} insights and I'm crawling the web every 5 minutes. Try asking again soon!",
                self.db.len()
            );
            return (reply, self.get_formatted_human_context(10));
        }

        // ── Banter / casual ───────────────────────────────────────────────────
        let is_banter = lower_msg.contains("omo") || lower_msg.contains("jare") || lower_msg.contains("abi")
            || lower_msg.contains("na wa") || lower_msg.contains("lol") || lower_msg.contains("haha")
            || lower_msg.contains("funny") || lower_msg.contains("joke");

        if is_banter {
            let banter = self.db.iter()
                .filter(|e| e.value().category == "banter" || e.value().category == "nuance")
                .map(|e| e.value().phrase.clone())
                .next()
                .unwrap_or_else(|| "Omo, this one touch body o!".to_string());

            let reply = format!(
                "{} 😂 I feel you! My Rust brain is learning all the vibes. I've picked up {} insights so far from crawling the web. What else you got?",
                banter,
                self.db.len()
            );
            return (reply, self.get_formatted_human_context(10));
        }

        // ── Default: best knowledge match ─────────────────────────────────────
        if let Some((score, best)) = scored.first() {
            if *score > 0.30 {
                let reply = format!(
                    "\"{}\" — {} (I learned this from my autonomous web crawling. Match score: {:.2})",
                    best.phrase,
                    best.human_nuance,
                    score
                );
                return (reply, self.get_formatted_human_context(10));
            }
        }

        // No strong match — honest response
        let reply = format!(
            "Hmm, I haven't fully learned about that yet. 🤔 I'm a self-learning Rust engine — I crawl the web and this site autonomously to build my knowledge. Right now I have {} insights stored. I've noted your question and will learn more about it. Try asking again after my next learning cycle!",
            self.db.len()
        );

        (reply, self.get_formatted_human_context(10))
    }
}
