use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::info;
use tokio_postgres::Client;
use postgres_native_tls::MakeTlsConnector;
use native_tls::TlsConnector;

use crate::neural_network::{TransformerConfig, TransformerWeights};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnedInsight {
    pub category: String,
    pub phrase: String,
    pub context: String,
    pub human_nuance: String,
    pub frequency_count: u32,
    pub last_updated: u64,
    pub rl_reward_score: f32,
    pub embedding_vector: Vec<f32>,
}

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

/// Shard/hash helper to determine which database gets a phrase
fn get_db_index(phrase: &str) -> usize {
    let mut sum = 0usize;
    for b in phrase.as_bytes() {
        sum = sum.wrapping_add(*b as usize);
    }
    sum % 6
}

// ─────────────────────────────────────────────────────────────────────────────
// NEON DATABASE CLIENT WRAPPER (Auto-Reconnection & SSL Support)
// ─────────────────────────────────────────────────────────────────────────────
pub struct NeonDbClient {
    url: String,
    client: Arc<tokio::sync::Mutex<Option<Arc<Client>>>>,
}

impl NeonDbClient {
    pub fn new(url: &str) -> Self {
        Self {
            url: url.to_string(),
            client: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    pub async fn get_client(&self) -> Result<Arc<Client>, String> {
        let mut client_lock = self.client.lock().await;
        if client_lock.is_none() {
            let client = self.connect().await?;
            *client_lock = Some(Arc::new(client));
        }
        let client = client_lock.as_ref().unwrap();
        if client.is_closed() {
            let client = self.connect().await?;
            *client_lock = Some(Arc::new(client));
        }
        Ok(client_lock.as_ref().unwrap().clone())
    }

    async fn connect(&self) -> Result<Client, String> {
        let config = self.url.parse::<tokio_postgres::Config>()
            .map_err(|e| e.to_string())?;

        let mut builder = TlsConnector::builder();
        builder.danger_accept_invalid_certs(true); // Ignore self-signed/custom cert warnings on Neon
        let tls = MakeTlsConnector::new(builder.build().unwrap());

        let (client, connection) = config.connect(tls).await
            .map_err(|e| e.to_string())?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("Postgres execution connection closed: {}", e);
            }
        });

        Ok(client)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN BRAIN ENGINE (Distributed Neon Vector Database Model)
// ─────────────────────────────────────────────────────────────────────────────
pub struct HumanBrainEngine {
    dbs: Vec<NeonDbClient>,
    transformer: Arc<tokio::sync::Mutex<TransformerWeights>>,
}

impl HumanBrainEngine {
    pub fn new() -> Self {
        let urls = vec![
            std::env::var("NEON_DB_1").unwrap_or_else(|_| "postgresql://neondb_owner:npg_F5JtynEwNQR2@ep-patient-sound-ay29jpmw-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_2").unwrap_or_else(|_| "postgresql://neondb_owner:npg_42oUIniLKtfE@ep-wispy-mouse-axmt4fbb-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_3").unwrap_or_else(|_| "postgresql://neondb_owner:npg_4zP2yCFRbpJo@ep-holy-frog-ayrs1h3b-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_4").unwrap_or_else(|_| "postgresql://neondb_owner:npg_y14EVPTOHBjc@ep-curly-dust-ayd3m715-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_5").unwrap_or_else(|_| "postgresql://neondb_owner:npg_dO0PJenx3ESm@ep-rough-rain-aydyxpv0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_6").unwrap_or_else(|_| "postgresql://neondb_owner:npg_aJ5g2vUuCnSm@ep-tiny-paper-ayzq4zjj-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
        ];

        let dbs = urls.into_iter().map(|url| NeonDbClient::new(&url)).collect::<Vec<_>>();
        
        // Initialize or load custom Transformer brain file
        let transformer = if let Ok(tf) = TransformerWeights::load_from_file("brain_weights.bin") {
            info!("[Neon Brain] Loaded existing custom Transformer weights");
            Arc::new(tokio::sync::Mutex::new(tf))
        } else {
            info!("[Neon Brain] Initializing fresh custom Transformer weights");
            let tf = TransformerWeights::new(TransformerConfig::default());
            let _ = tf.save_to_file("brain_weights.bin");
            Arc::new(tokio::sync::Mutex::new(tf))
        };

        let engine = Self { dbs, transformer };
        
        // Asynchronously check and seed the database in the background to avoid blocking server boot
        engine.seed_initial_memory_async();
        
        engine
    }

    /// Asynchronously check database count and seed initial memory
    fn seed_initial_memory_async(&self) {
        let urls = vec![
            std::env::var("NEON_DB_1").unwrap_or_else(|_| "postgresql://neondb_owner:npg_F5JtynEwNQR2@ep-patient-sound-ay29jpmw-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_2").unwrap_or_else(|_| "postgresql://neondb_owner:npg_42oUIniLKtfE@ep-wispy-mouse-axmt4fbb-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_3").unwrap_or_else(|_| "postgresql://neondb_owner:npg_4zP2yCFRbpJo@ep-holy-frog-ayrs1h3b-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_4").unwrap_or_else(|_| "postgresql://neondb_owner:npg_y14EVPTOHBjc@ep-curly-dust-ayd3m715-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_5").unwrap_or_else(|_| "postgresql://neondb_owner:npg_dO0PJenx3ESm@ep-rough-rain-aydyxpv0-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
            std::env::var("NEON_DB_6").unwrap_or_else(|_| "postgresql://neondb_owner:npg_aJ5g2vUuCnSm@ep-tiny-paper-ayzq4zjj-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require".to_string()),
        ];
        
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(5)).await; // Wait for initial server setup
            
            // Connect to DB1 to check if database has seeded insights
            let client_wrapper = NeonDbClient::new(&urls[0]);
            if let Ok(client) = client_wrapper.get_client().await {
                let _ = client.execute("CREATE EXTENSION IF NOT EXISTS vector;", &[]).await;
                let _ = client.execute("CREATE TABLE IF NOT EXISTS human_learning_vectors (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(100) NOT NULL,
                    phrase TEXT NOT NULL,
                    context TEXT,
                    human_nuance TEXT,
                    frequency_count INTEGER DEFAULT 1,
                    last_updated BIGINT,
                    rl_reward_score REAL DEFAULT 1.0,
                    embedding vector(64),
                    UNIQUE(category, phrase)
                );", &[]).await;
                
                if let Ok(row) = client.query_one("SELECT COUNT(*) FROM human_learning_vectors", &[]).await {
                    let count: i64 = row.get(0);
                    if count == 0 {
                        info!("[Neon Brain] Seeding initial core conversational templates...");
                        let seeds = vec![
                            ("greeting_warm", "Hey, good to see you here.", "Warm & relational opener", "Friendly and welcoming"),
                            ("greeting_warm", "Hope your day's going well so far.", "Empathetic check-in", "Caring and thoughtful"),
                            ("greeting_warm", "Glad we got a chance to connect.", "Relational appreciation", "Warm and authentic"),
                            ("greeting_professional", "Thanks for reaching out.", "Polite professional opener", "Accessible and courteous"),
                            ("greeting_professional", "Appreciate you taking the time.", "Respectful time acknowledgment", "Professional and warm"),
                            ("greeting_professional", "Looking forward to this conversation.", "Positive engagement signal", "Eager and constructive"),
                            ("greeting_curious", "Quick question for you...", "Engaging soft opener", "Invites immediate dialog"),
                            ("greeting_curious", "Curious what brought you here today.", "Interest-driven query", "Thought-provoking"),
                            ("greeting_curious", "What's the biggest thing on your mind right now?", "Deep focus question", "Empathetic listener signal"),
                            ("greeting_contextual", "Morning — hope the day's starting strong.", "Morning time-aware opener", "Running with high energy"),
                            ("greeting_contextual", "Evening check-in — still got energy left?", "Evening time-aware opener", "Caring status inquiry"),
                            ("greeting_playful", "What's good?", "Casual playful opener", "Modern and friendly"),
                            ("greeting_playful", "Ready when you are.", "Action-ready personality prompt", "Direct and confident"),
                            ("greeting_respect", "Appreciate the opportunity to chat.", "Respectful status opener", "Humble and polite"),
                            ("domain_tech", "African tech hubs across Lagos, Nairobi, Accra, and Jo'burg are revolutionizing global fintech and digital infrastructure.", "African Tech Domain Knowledge", "High-growth, innovative, and impactful"),
                            ("domain_politics", "African & Global Geopolitics and Leadership details across ECOWAS, Nigeria, Ghana, Kenya, and global platforms.", "Geopolitical Domain Knowledge", "Factual, current, and objective"),
                            ("domain_sports", "RealSSA Sports Centre delivers real-time scores, standings, and match breakdowns for Premier League, Champions League, NPFL, La Liga.", "Sports & Live Match Centre", "Data-driven, live, and energetic"),
                            ("greeting", "How far bro", "Warm, authentic Nigerian informal greeting", "Very natural, casual"),
                            ("nuance", "No caps, this is actually big news", "Gen-Z emphasis phrase", "Expresses genuine excitement"),
                            ("banter", "Omo, this one touch body o!", "Pidgin expression for impactful news", "Relatable cultural humor"),
                        ];
                        
                        let now_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
                        
                        for (cat, phrase, context, nuance) in seeds {
                            let db_idx = get_db_index(phrase);
                            let target_url = &urls[db_idx];
                            let c = NeonDbClient::new(target_url);
                            if let Ok(cl) = c.get_client().await {
                                let _ = cl.execute("CREATE EXTENSION IF NOT EXISTS vector;", &[]).await;
                                let _ = cl.execute("CREATE TABLE IF NOT EXISTS human_learning_vectors (
                                    id SERIAL PRIMARY KEY,
                                    category VARCHAR(100) NOT NULL,
                                    phrase TEXT NOT NULL,
                                    context TEXT,
                                    human_nuance TEXT,
                                    frequency_count INTEGER DEFAULT 1,
                                    last_updated BIGINT,
                                    rl_reward_score REAL DEFAULT 1.0,
                                    embedding vector(64),
                                    UNIQUE(category, phrase)
                                );", &[]).await;
                                
                                let emb = compute_embedding(phrase);
                                let vector_str = format!("[{}]", emb.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(","));
                                let _ = cl.execute(
                                    "INSERT INTO human_learning_vectors (category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score, embedding)
                                     VALUES ($1, $2, $3, $4, 1, $5, 1.0, $6::vector)
                                     ON CONFLICT (category, phrase) DO NOTHING",
                                    &[&cat.to_string(), &phrase.to_string(), &context.to_string(), &nuance.to_string(), &now_ts, &vector_str]
                                ).await;
                            }
                        }
                        info!("[Neon Brain] Initial conversational templates seeded successfully.");
                    }
                }
            }
        });
    }

    /// Generates a response using the v2 multi-layer Transformer with BPE tokenization
    async fn generate_text_from_insights(&self, insights: &[LearnedInsight], user_msg: &str) -> String {
        if insights.is_empty() {
            return "RealSSA intelligence active and processing.".to_string();
        }

        let tf = self.transformer.lock().await;

        // Wrap user message in conversation prompt format for the Transformer
        let prompt = format!("User: {}\nBot:", user_msg);
        let input_tokens = tf.tokenize(&prompt);

        let mut generated_tokens = if input_tokens.is_empty() {
            // Fallback: tokenize first insight
            tf.tokenize(&insights[0].phrase)
        } else {
            input_tokens
        };

        // Context truncation
        if generated_tokens.len() > tf.config.seq_len - 10 {
            generated_tokens = generated_tokens[generated_tokens.len() - (tf.config.seq_len - 10)..].to_vec();
        }

        // Autoregressive generation: predict tokens one-by-one
        let max_new_tokens = 60;
        let mut new_token_ids = Vec::new();

        for _ in 0..max_new_tokens {
            let context = if generated_tokens.len() > tf.config.seq_len {
                &generated_tokens[generated_tokens.len() - tf.config.seq_len..]
            } else {
                &generated_tokens
            };

            let logits = tf.forward(context);
            let next_id = tf.sample_next_token_id(&logits, 0.7);

            generated_tokens.push(next_id);
            new_token_ids.push(next_id);

            let next_token_str = tf.detokenize(&[next_id]);
            if next_token_str.contains('\n') || next_token_str.contains("User:") {
                break;
            }
        }

        // Decode only the newly generated tokens (not the prompt)
        let mut text = tf.detokenize(&new_token_ids);

        // Strip any leftover "Bot:" prefix from decoded text
        if let Some(stripped) = text.strip_prefix("Bot:") {
            text = stripped.trim().to_string();
        }
        if let Some(stripped) = text.strip_prefix("bot:") {
            text = stripped.trim().to_string();
        }

        // Fallback: if generation produced nothing useful, return best matching insight
        if text.trim().is_empty() || text.trim().len() < 5 {
            text = insights[0].phrase.clone();
            // If the insight is a conversation pair, extract just the Bot answer
            if text.contains("Bot:") {
                if let Some(bot_part) = text.split("Bot:").nth(1) {
                    text = bot_part.trim().to_string();
                }
            }
        }

        // Capitalize first letter
        if !text.is_empty() {
            let mut chars = text.chars();
            text = chars.next().unwrap().to_uppercase().collect::<String>() + chars.as_str();
        }

        // Ensure sentence ends with punctuation
        if !text.ends_with('.') && !text.ends_with('!') && !text.ends_with('?') && !text.ends_with(',') {
            text.push('.');
        }

        text
    }

    /// Save or increment a learned human phrase in the sharded database and run an offline backprop training step
    pub async fn record_insight(&self, category: &str, phrase: &str, context: &str, nuance: &str) {
        let db_idx = get_db_index(phrase);
        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
            
        let embedding = compute_embedding(phrase);
        let vector_str = format!("[{}]", embedding.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(","));
        
        if let Ok(client) = self.dbs[db_idx].get_client().await {
            let q = "INSERT INTO human_learning_vectors (category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score, embedding)
                     VALUES ($1, $2, $3, $4, 1, $5, 1.0, $6::vector)
                     ON CONFLICT (category, phrase)
                     DO UPDATE SET frequency_count = human_learning_vectors.frequency_count + 1, last_updated = EXCLUDED.last_updated";
            let _ = client.execute(
                q,
                &[&category.to_string(), &phrase.trim().to_string(), &context.to_string(), &nuance.to_string(), &now_ts, &vector_str]
            ).await;
        }

        // Asynchronously backprop-train the Transformer weights on the newly taught phrase
        let sentence = phrase.to_string();
        let tf_clone = self.transformer.clone();
        tokio::spawn(async move {
            let mut tf = tf_clone.lock().await;
            tf.update_vocabulary(&[sentence.clone()]);
            let tokens = tf.tokenize(&sentence);
            if tokens.len() > 1 {
                for i in 0..tokens.len() - 1 {
                    let _loss = tf.train_step(&tokens[0..=i], tokens[i+1], 0.01);
                }
                let _ = tf.save_to_file("brain_weights.bin");
            }
        });
    }

    /// Apply RLHF reward signal feedback to database entry
    pub async fn apply_rlhf_feedback(&self, category: &str, phrase: &str, reward: f32) {
        let db_idx = get_db_index(phrase);
        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
            
        if let Ok(client) = self.dbs[db_idx].get_client().await {
            let q = "UPDATE human_learning_vectors
                     SET rl_reward_score = rl_reward_score + 0.2 * ($3 - rl_reward_score), last_updated = $4
                     WHERE category = $1 AND LOWER(TRIM(phrase)) = LOWER(TRIM($2))";
            let _ = client.execute(q, &[&category.to_string(), &phrase.to_string(), &(reward as f64), &now_ts]).await;
            info!("[Neon RLHF] 🎯 Reward signal feedback applied to db index {}", db_idx);
        }
    }

    /// Perform parallel distributed vector similarity search across all 6 databases
    pub async fn native_rust_inference(&self, user_msg: &str) -> (String, f32) {
        let user_embedding = compute_embedding(user_msg);
        let query_vector_str = format!("[{}]", user_embedding.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(","));
        
        let mut tasks = Vec::new();
        for db in &self.dbs {
            let client_wrapper = NeonDbClient { url: db.url.clone(), client: db.client.clone() };
            let q_vec = query_vector_str.clone();
            tasks.push(tokio::spawn(async move {
                if let Ok(client) = client_wrapper.get_client().await {
                    if let Ok(rows) = client.query(
                        "SELECT category, phrase, context, human_nuance, rl_reward_score,
                                (1.0 - (embedding <=> $1::vector)) as similarity
                         FROM human_learning_vectors
                         ORDER BY (0.7 * (1.0 - (embedding <=> $1::vector)) + 0.3 * LEAST(GREATEST(rl_reward_score, 0.0), 2.0)) DESC
                         LIMIT 1",
                        &[&q_vec]
                    ).await {
                        if let Some(row) = rows.first() {
                            let sim: f64 = row.get("similarity");
                            let score = (0.7 * sim) + (0.3 * row.get::<_, f64>("rl_reward_score").clamp(0.0, 2.0));
                            return Some((
                                score as f32,
                                row.get::<_, String>("category"),
                                row.get::<_, String>("phrase"),
                                row.get::<_, String>("human_nuance")
                            ));
                        }
                    }
                }
                None
            }));
        }

        let results = futures::future::join_all(tasks).await;
        let mut best: Option<(f32, String, String, String)> = None;
        for res in results {
            if let Ok(Some(item)) = res {
                if best.is_none() || item.0 > best.as_ref().unwrap().0 {
                    best = Some(item);
                }
            }
        }

        if let Some((score, category, phrase, nuance)) = best {
            let reply = match category.as_str() {
                cat if cat.starts_with("greeting") => {
                    format!("{} Great to connect with you! How can I assist you on RealSSA today?", phrase)
                }
                "discussion" => {
                    format!("That's a deep question. \"{}\" — I'm analyzing the context: {}.", phrase, nuance)
                }
                _ => {
                    format!("\"{}\" ({}) — My Neon vector engine matched this with combined score {:.2}.", phrase, nuance, score)
                }
            };
            (reply, score)
        } else {
            ("RealSSA Neon Distributed Neural Engine active. High-frequency vector space initialized.".to_string(), 0.5)
        }
    }

    /// Retrieve top human insights formatted for system prompt injection (reads from all 6 databases)
    pub async fn get_formatted_human_context(&self, limit: usize) -> String {
        let mut tasks = Vec::new();
        for db in &self.dbs {
            let client_wrapper = NeonDbClient { url: db.url.clone(), client: db.client.clone() };
            tasks.push(tokio::spawn(async move {
                if let Ok(client) = client_wrapper.get_client().await {
                    if let Ok(rows) = client.query(
                        "SELECT category, phrase, human_nuance FROM human_learning_vectors
                         ORDER BY frequency_count DESC, last_updated DESC LIMIT 15",
                        &[]
                    ).await {
                        let mut items = Vec::new();
                        for row in rows {
                            items.push(format!(
                                "- [{}] \"{}\" (Nuance: {})",
                                row.get::<_, String>("category"),
                                row.get::<_, String>("phrase"),
                                row.get::<_, String>("human_nuance")
                            ));
                        }
                        return items;
                    }
                }
                Vec::new()
            }));
        }

        let results = futures::future::join_all(tasks).await;
        let mut all_formatted = Vec::new();
        for res in results {
            if let Ok(items) = res {
                all_formatted.extend(items);
            }
        }
        all_formatted.truncate(limit);
        all_formatted.join("\n")
    }

    /// Get combined stats from all 6 databases
    pub async fn get_stats(&self) -> (usize, u32) {
        let mut tasks = Vec::new();
        for db in &self.dbs {
            let client_wrapper = NeonDbClient { url: db.url.clone(), client: db.client.clone() };
            tasks.push(tokio::spawn(async move {
                if let Ok(client) = client_wrapper.get_client().await {
                    if let Ok(row) = client.query_one(
                        "SELECT COUNT(*), COALESCE(SUM(frequency_count), 0) FROM human_learning_vectors",
                        &[]
                    ).await {
                        let count: i64 = row.get(0);
                        let sum: i64 = row.get(1);
                        return (count as usize, sum as u32);
                    }
                }
                (0, 0)
            }));
        }

        let results = futures::future::join_all(tasks).await;
        let mut total_insights = 0;
        let mut total_occurrences = 0;
        for res in results {
            if let Ok((c, s)) = res {
                total_insights += c;
                total_occurrences += s;
            }
        }
        (total_insights, total_occurrences)
    }

    /// Process interactive chat request using Neon pgvector similarity scores and local Bigram synthesis
    pub async fn chat(&self, user_msg: &str) -> (String, String) {
        let user_embedding = compute_embedding(user_msg);
        let query_vector_str = format!("[{}]", user_embedding.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(","));
        let lower_msg = user_msg.to_lowercase();

        // 1. Fetch top similarity matches from all 6 databases in parallel
        let mut tasks = Vec::new();
        for db in &self.dbs {
            let client_wrapper = NeonDbClient { url: db.url.clone(), client: db.client.clone() };
            let q_vec = query_vector_str.clone();
            tasks.push(tokio::spawn(async move {
                if let Ok(client) = client_wrapper.get_client().await {
                    if let Ok(rows) = client.query(
                        "SELECT category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score,
                                (1.0 - (embedding <=> $1::vector)) as similarity
                         FROM human_learning_vectors
                         WHERE category != 'user_history'
                         ORDER BY (1.0 - (embedding <=> $1::vector)) DESC
                         LIMIT 20",
                        &[&q_vec]
                    ).await {
                        let mut items = Vec::new();
                        for row in rows {
                            let sim: f64 = row.get("similarity");
                            let rl: f64 = row.get("rl_reward_score");
                            let cat: String = row.get("category");
                            
                            let category_boost = match cat.as_str() {
                                "domain_tech" | "domain_politics" | "domain_sports" => 0.15,
                                "discovery" | "exa_discovery" | "site_article" | "site_headline" => 0.10,
                                "ai_building" | "manual_teach" | "taught_knowledge" => 0.12,
                                "greeting" | "greeting_warm" => 0.05,
                                _ => 0.0,
                            };
                            
                            let combined = (0.7 * sim) + (0.3 * rl.clamp(0.0, 2.0)) + category_boost;
                            items.push((
                                combined as f32,
                                LearnedInsight {
                                    category: cat,
                                    phrase: row.get("phrase"),
                                    context: row.get("context"),
                                    human_nuance: row.get("human_nuance"),
                                    frequency_count: row.get::<_, i32>("frequency_count") as u32,
                                    last_updated: row.get::<_, i64>("last_updated") as u64,
                                    rl_reward_score: rl as f32,
                                    embedding_vector: vec![],
                                }
                            ));
                        }
                        return items;
                    }
                }
                Vec::new()
            }));
        }

        let results = futures::future::join_all(tasks).await;
        let mut scored = Vec::new();
        for res in results {
            if let Ok(items) = res {
                scored.extend(items);
            }
        }
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // Record conversational history asynchronously
        let self_clone = self.dbs[get_db_index(user_msg)].url.clone();
        let msg_str = user_msg.to_string();
        tokio::spawn(async move {
            let c = NeonDbClient::new(&self_clone);
            if let Ok(client) = c.get_client().await {
                let now_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
                let _ = client.execute(
                    "INSERT INTO human_learning_vectors (category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score)
                     VALUES ('user_history', $1, 'User conversational history', 'User input', 1, $2, 1.0)
                     ON CONFLICT (category, phrase) DO NOTHING",
                    &[&msg_str, &now_ts]
                ).await;
            }
        });

        // 2. Greeting / status check
        let is_greeting = lower_msg.contains("hi") || lower_msg.contains("hello") || lower_msg.contains("hey")
            || lower_msg.contains("how far") || lower_msg.contains("good morning")
            || lower_msg.contains("good evening") || lower_msg.contains("good afternoon")
            || lower_msg.contains("sabbi") || lower_msg.contains("wetin dey")
            || lower_msg.contains("how are you") || lower_msg.contains("how you dey")
            || lower_msg.contains("welcome") || lower_msg.contains("yo ");

        let (total_insights, _) = self.get_stats().await;

        if is_greeting {
            let mut greeting = "Hey, good to see you here.".to_string();
            if let Some((_, m)) = scored.iter().find(|(_, m)| m.category.starts_with("greeting")) {
                greeting = m.phrase.clone();
            }
            let reply = format!(
                "{} 😄 I'm doing great, thanks for asking! I'm RealSSA — my Rust distributed vector neural engine is fully active with {} learned insights sharded across 6 Neon databases. Ask me anything!",
                greeting,
                total_insights
            );
            return (reply, self.get_formatted_human_context(10).await);
        }

        // 3. Question check
        let is_question = lower_msg.contains("what") || lower_msg.contains("how") || lower_msg.contains("why")
            || lower_msg.contains("who") || lower_msg.contains("when") || lower_msg.contains("where")
            || lower_msg.contains("explain") || lower_msg.contains("tell me") || lower_msg.contains("?");

        if is_question {
            // Category intent checks (proverbs/slang)
            let wants_proverb = lower_msg.contains("proverb") || lower_msg.contains("saying");
            let wants_slang = lower_msg.contains("slang") || lower_msg.contains("pidgin");

            if wants_proverb {
                let proverbs: Vec<&LearnedInsight> = scored.iter()
                    .filter(|(_, e)| e.category.starts_with("proverb"))
                    .map(|(_, e)| e).take(3).collect();
                if !proverbs.is_empty() {
                    let text = proverbs.iter().map(|p| format!("\"{}\" — {}", p.phrase, p.human_nuance)).collect::<Vec<_>>().join("\n\n");
                    return (format!("Here are some African proverbs from my brain:\n\n{}", text), self.get_formatted_human_context(10).await);
                }
            }

            if wants_slang {
                let slangs: Vec<&LearnedInsight> = scored.iter()
                    .filter(|(_, e)| e.category.contains("culture") || e.category.contains("language"))
                    .map(|(_, e)| e).take(4).collect();
                if !slangs.is_empty() {
                    let text = slangs.iter().map(|s| s.phrase.clone()).collect::<Vec<_>>().join("\n\n");
                    return (format!("Here is some Nigerian slang I know:\n\n{}", text), self.get_formatted_human_context(10).await);
                }
            }

            // Keyword / name direct matches
            let stop_words = ["what", "who", "is", "are", "the", "a", "an", "how", "why", "about", "does", "mean", "explain", "meaning"];
            let keywords: Vec<String> = lower_msg.split_whitespace()
                .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
                .filter(|w| w.len() > 2 && !stop_words.contains(&w.as_str()))
                .collect();

            if !keywords.is_empty() {
                // Fetch direct keyword matching rows across all databases
                let mut kw_tasks = Vec::new();
                for db in &self.dbs {
                    let client_wrapper = NeonDbClient { url: db.url.clone(), client: db.client.clone() };
                    let kws_clone: Vec<String> = keywords.iter().map(|s| format!("%{}%", s)).collect();
                    kw_tasks.push(tokio::spawn(async move {
                        if let Ok(client) = client_wrapper.get_client().await {
                            if let Ok(rows) = client.query(
                                "SELECT category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score
                                 FROM human_learning_vectors
                                 WHERE category != 'user_history'
                                   AND (phrase ILIKE ANY($1) OR context ILIKE ANY($1))
                                 LIMIT 10",
                                &[&kws_clone]
                            ).await {
                                let mut items = Vec::new();
                                for row in rows {
                                    items.push(LearnedInsight {
                                        category: row.get("category"),
                                        phrase: row.get("phrase"),
                                        context: row.get("context"),
                                        human_nuance: row.get("human_nuance"),
                                        frequency_count: row.get::<_, i32>("frequency_count") as u32,
                                        last_updated: row.get::<_, i64>("last_updated") as u64,
                                        rl_reward_score: row.get("rl_reward_score"),
                                        embedding_vector: vec![],
                                    });
                                }
                                return items;
                            }
                        }
                        Vec::new()
                    }));
                }

                let kw_results = futures::future::join_all(kw_tasks).await;
                let mut matched_insights = Vec::new();
                for res in kw_results {
                    if let Ok(items) = res {
                        matched_insights.extend(items);
                    }
                }

                if !matched_insights.is_empty() {
                    // Build local Transformer memory context and generate response
                    let generated_reply = self.generate_text_from_insights(&matched_insights, user_msg).await;
                    let reply = format!(
                        "{} (Synthesized dynamically from sharded memory | {} total insights)",
                        generated_reply,
                        total_insights
                    );
                    return (reply, self.get_formatted_human_context(10).await);
                }
            }

            // Vector similarity fallback
            if let Some((score, _best)) = scored.first() {
                if *score > 0.35 {
                    let matching_insights: Vec<LearnedInsight> = scored.iter()
                        .take(15)
                        .map(|(_, item)| item.clone())
                        .collect();
                    let generated_reply = self.generate_text_from_insights(&matching_insights, user_msg).await;
                    let reply = format!(
                        "{} (Synthesized dynamically | match score {:.2})",
                        generated_reply,
                        score
                    );
                    return (reply, self.get_formatted_human_context(10).await);
                }
            }

            let reply = format!(
                "I don't have enough details on that yet. I have {} insights sharded across my Neon cluster. I'm actively crawling the web every few minutes. Try asking again soon!",

                total_insights
            );
            return (reply, self.get_formatted_human_context(10).await);
        }

        // 4. Default best score
        if let Some((score, _best)) = scored.first() {
            if *score > 0.30 {
                let matching_insights: Vec<LearnedInsight> = scored.iter()
                    .take(15)
                    .map(|(_, item)| item.clone())
                    .collect();
                let generated_reply = self.generate_text_from_insights(&matching_insights, user_msg).await;
                let reply = format!(
                    "\"{}\" — (Match score: {:.2})",
                    generated_reply,
                    score
                );
                return (reply, self.get_formatted_human_context(10).await);
            }
        }

        let reply = format!(
            "Hmm, I haven't fully learned about that yet. 🤔 I'm a self-learning distributed Rust engine. I have {} insights sharded across 6 Neon databases. I will crawl the web to learn more. Ask me again after my next cycle!",
            total_insights
        );
        (reply, self.get_formatted_human_context(10).await)
    }

    /// Start silent background web discovery worker
    pub fn start_silent_worker(self: Arc<Self>) {
        tokio::spawn(async move {
            info!("[Rust HumanBrain] Distributed crawl active — 6 Neon vector stores connected");
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(20))
                .user_agent("Mozilla/5.0 (compatible; RealSSABot/1.0)")
                .build()
                .unwrap_or_default();

            let own_sources = [
                "https://www.realssanews.com.ng/sitemap.xml",
                "https://realssanews.com.ng/sitemap.xml",
                "https://www.realssanews.com.ng/feed",
                "https://realssanews.com.ng/feed",
            ];

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
            ];

            let mut cycle: usize = 0;

            loop {
                // Plan 7: poll every 6 min (360s) instead of 90s. Neon suspends a
                // compute after ~5 min (300s) idle, so a 90s poll kept snowy-field
                // awake 24/7 and drained the shared 100 CU-hr meter. 360s lets it
                // auto-suspend between reads. News only changes on ingest, so a
                // slower poll loses no meaningful freshness.
                tokio::time::sleep(Duration::from_secs(360)).await;
                cycle = cycle.wrapping_add(1);


                // own site check
                for source in own_sources.iter() {
                    if let Ok(res) = client.get(*source).send().await {
                        if let Ok(text) = res.text().await {
                            for line in text.lines() {
                                let t = line.trim();
                                if t.starts_with("<loc>") && t.ends_with("</loc>") {
                                    let url = t.trim_start_matches("<loc>").trim_end_matches("</loc>");
                                    if url.contains("realssanews") && url.len() > 30 {
                                        self.record_insight("site_article", url, "Crawled from RealSSA sitemap", "Site knowledge").await;
                                    }
                                }
                                if t.starts_with("<title>") && t.ends_with("</title>") {
                                    let title = t.trim_start_matches("<title>").trim_end_matches("</title>");
                                    if title.len() > 10 && !title.contains("RealSSA") {
                                        self.record_insight("site_headline", title, "Crawled from RealSSA RSS feed", "News headline").await;
                                    }
                                }
                            }
                        }
                    }
                }

                // external RSS check (rotate 2 feeds per cycle)
                let rss_idx = (cycle * 2) % external_rss.len();
                let rss_batch = &external_rss[rss_idx..std::cmp::min(rss_idx + 2, external_rss.len())];
                for (rss_url, _source_name) in rss_batch {
                    if let Ok(res) = client.get(*rss_url).send().await {
                        if let Ok(text) = res.text().await {
                            for line in text.lines() {
                                let t = line.trim();
                                if t.starts_with("<title>") && t.ends_with("</title>") {
                                    let title = t.trim_start_matches("<title>").trim_end_matches("</title>");
                                    if title.len() > 12 && !title.contains("Vanguard") && !title.contains("Punch") {
                                        self.record_insight("discovery", title, "Crawled from regional RSS feed", "African news headline").await;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_brain_generation() {
        let engine = HumanBrainEngine::new();
        let test_prompts = vec!["who are you", "who built you", "hello"];

        for prompt in test_prompts {
            let reply = engine.generate_text_from_insights(&[], prompt).await;
            println!("\n[PROMPT]: \"{}\"\n[REPLY]:  \"{}\"", prompt, reply);
        }
    }
}
