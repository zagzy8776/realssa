require('dotenv').config();
const { Pool } = require('pg');

// Railway automatically provides the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Railway/Heroku connections
  }
});

const newsStories = [
  {
    title: "Investigative: The 'Audio Projects' of Abuja Uncovered",
    description: "Realssa team visits Kagini to verify government claims on new primary health centers.",
    image: "https://placehold.co/800x450?text=Kagini+Investigation",
    category: "Politics",
    content: "Full report on the missing budget allocations..."
  },
  {
    title: "Naira Stability: What the Central Bank Isn't Telling You",
    description: "An inside look at the current currency fluctuations and the impact on local markets.",
    image: "https://placehold.co/800x450?text=Economy+Update",
    category: "Finance",
    content: "Analysis of market trends for February 2026..."
  },
  {
    title: "Crypto Update: Nigeria Leads Africa in P2P Adoption",
    description: "New data shows Nigerian youth are bypassing traditional banks despite regulations.",
    image: "https://placehold.co/800x450?text=Crypto+News",
    category: "Tech",
    content: "Detailed stats on transaction volumes..."
  },
  {
    title: "EntertainmentGHC: Top 10 Naija Artists to Watch in 2026",
    description: "Who is taking over the Afrobeats scene this year? We rank the rising stars.",
    image: "https://placehold.co/800x450?text=Entertainment+Top+10",
    category: "Entertainment",
    content: "Review of recent album drops and tours..."
  },
  {
    title: "Security Alert: New Tactics in Cybercrime Targeting Abuja Residents",
    description: "Stay safe online with these verified tips from cybersecurity experts.",
    image: "https://placehold.co/800x450?text=Security+Alert",
    category: "Safety",
    content: "Protecting your digital identity in 2026..."
  }
];

async function seedDatabase() {
  try {
    console.log("Connecting to Railway Database...");

    // Create the table if it doesn't exist (Adjust schema as needed)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        image TEXT,
        category TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Table verified. Inserting stories...");

    for (const story of newsStories) {
      await pool.query(
        'INSERT INTO articles (title, description, image, category, content) VALUES ($1, $2, $3, $4, $5)',
        [story.title, story.description, story.image, story.category, story.content]
      );
    }

    console.log("Success! 5 Stories added to Railway.");
  } catch (err) {
    console.error("Error seeding database:", err);
  } finally {
    await pool.end();
  }
}

seedDatabase();
