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
        engine
    }

    /// Seed core human conversational patterns into isolated memory
    fn seed_initial_human_memory(&self) {
        let seeds = vec![
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

        self.db
            .entry(key)
            .and_modify(|insight| {
                insight.frequency_count += 1;
                insight.last_updated = timestamp;
            })
            .or_insert(LearnedInsight {
                category: category.to_string(),
                phrase: phrase.trim().to_string(),
                context: context.to_string(),
                human_nuance: nuance.to_string(),
                frequency_count: 1,
                last_updated: timestamp,
            });
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
    pub fn start_silent_worker(self: Arc<Self>) {
        tokio::spawn(async move {
            info!("[Rust HumanBrain] 🦀 Silent autonomous learning worker active");
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default();

            loop {
                tokio::time::sleep(Duration::from_secs(600)).await; // Runs silently every 10 minutes

                // Execute silent background web discovery via Tavily / Exa APIs
                let tavily_key = std::env::var("TAVILY_API_KEY").unwrap_or_default();
                if !tavily_key.is_empty() {
                    let payload = serde_json::json!({
                        "api_key": tavily_key,
                        "query": "trending African culture conversations slang direct questions 2026",
                        "max_results": 3
                    });

                    if let Ok(res) = client
                        .post("https://api.tavily.com/search")
                        .json(&payload)
                        .send()
                        .await
                    {
                        if let Ok(json) = res.json::<serde_json::Value>().await {
                            if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                                for r in results {
                                    if let (Some(title), Some(content)) = (
                                        r.get("title").and_then(|t| t.as_str()),
                                        r.get("content").and_then(|c| c.as_str()),
                                    ) {
                                        let nuance = if content.contains("slang") || content.contains("pidgin") {
                                            "Cultural expression"
                                        } else {
                                            "Natural speech pattern"
                                        };
                                        self.record_insight("discovery", title, content, nuance);
                                    }
                                }
                                info!("[Rust HumanBrain] 🧠 Discovered & ingested web human insights into isolated database");
                            }
                        }
                    }
                }
            }
        });
    }
}
