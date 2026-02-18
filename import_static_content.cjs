// Script to import static content into the admin database
// This will move all static content to the backend so it can be managed by admin

const fs = require('fs');
const path = require('path');

// Static content from src/data/newsData.ts
const staticContent = [
  // Latest Stories
  {
    id: '1',
    title: 'Shatta Wale Announces Major Collaboration with International Superstar',
    excerpt: 'The dancehall king teams up with global icon for groundbreaking track that promises to redefine African music on world stage.',
    category: 'afrobeats',
    image: 'https://via.placeholder.com/400x250?text=Producer+Studio',
    readTime: '5 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '2',
    title: 'Ghanaian Film \'The Ancestral Call\' Wins Best Picture at Pan-African Film Festival',
    excerpt: 'Historic victory for Ghanaian cinema as cultural masterpiece takes top honor, showcasing authentic storytelling and stunning visuals.',
    category: 'culture',
    image: 'https://via.placeholder.com/400x250?text=Cinema+Scene',
    readTime: '7 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '3',
    title: 'Best Dressed at the 2025 Ghana Music Awards',
    excerpt: 'Fashion icons stole the show with stunning outfits blending traditional kente patterns with modern haute couture designs.',
    category: 'fashion',
    image: 'https://via.placeholder.com/400x250?text=Fashion+Runway',
    readTime: '8 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '4',
    title: 'New Generation of Ghanaian Artists Redefining Afrobeats Sound',
    excerpt: 'Young talents bring fresh perspectives and innovative sounds to the ever-evolving genre, gaining global attention.',
    category: 'afrobeats',
    image: 'https://via.placeholder.com/400x250?text=Producer+Studio',
    readTime: '6 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '5',
    title: 'Traditional Festivals Experience Revival in Modern Ghana',
    excerpt: 'Communities across Ghana find innovative ways to celebrate heritage while embracing contemporary values and global audiences.',
    category: 'culture',
    image: 'https://via.placeholder.com/400x250?text=Culture+Festival',
    readTime: '5 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '6',
    title: 'Streaming Platforms Boost Ghanaian Content Visibility',
    excerpt: 'Local productions gain international recognition through digital distribution, challenging global streaming giants.',
    category: 'tech',
    image: 'https://via.placeholder.com/400x250?text=Tech+Startup',
    readTime: '4 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '7',
    title: 'Ghanaian Cuisine Gains Global Recognition',
    excerpt: 'Chefs worldwide incorporate traditional Ghanaian flavors into menus, bringing international attention to West Africa\'s culinary heritage.',
    category: 'culture',
    image: 'https://via.placeholder.com/400x250?text=Ghanaian+Food',
    readTime: '6 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: '8',
    title: 'AI Revolutionizes African Entertainment Industry',
    excerpt: 'From music production to visual effects, artificial intelligence transforms how African creators produce and distribute content.',
    category: 'tech',
    image: 'https://via.placeholder.com/400x250?text=Tech+Startup',
    readTime: '7 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  
  // Nigeria News
  {
    id: 'n1',
    title: 'Nollywood\'s Global Dominance Continues in 2026',
    excerpt: 'Nigerian films break box office records worldwide as industry sets new standards for African storytelling and production quality.',
    category: 'nollywood',
    image: 'https://via.placeholder.com/400x250?text=Nollywood+Set',
    readTime: '8 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: 'n2',
    title: 'Nigerian Artists Dominate Global Music Charts',
    excerpt: 'From Lagos to London, Nigerian musicians set new records and influence global music trends with their unique Afrobeats sound.',
    category: 'afrobeats',
    image: 'https://via.placeholder.com/400x250?text=Producer+Studio',
    readTime: '6 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: 'n3',
    title: 'Lagos Fashion Week 2026 Goes Global',
    excerpt: 'Nigerian designers showcase innovative collections that blend traditional aesthetics with contemporary styles, attracting international buyers.',
    category: 'fashion',
    image: 'https://via.placeholder.com/400x250?text=Fashion+Runway',
    readTime: '5 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: 'n4',
    title: 'Lagos Tech Scene Revolutionizes Entertainment Industry',
    excerpt: 'Nigerian startups develop innovative solutions for music distribution, film production, and digital content creation.',
    category: 'tech',
    image: 'https://via.placeholder.com/400x250?text=Tech+Startup',
    readTime: '7 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  },
  {
    id: 'n5',
    title: 'New Generation of Nigerian Producers Shaping Global Sound',
    excerpt: 'Young Nigerian producers gain international recognition for their innovative beats and production techniques.',
    category: 'music',
    image: 'https://via.placeholder.com/400x250?text=Producer+Studio',
    readTime: '6 min read',
    date: new Date().toISOString(),
    author: 'Admin',
    source: 'static',
    contentType: 'article',
    status: 'published',
    featured: false
  }
];

// Function to import static content
async function importStaticContent() {
  console.log('Importing static content to admin database...');
  
  try {
    // Read existing articles
    const articlesFilePath = path.join(__dirname, 'backend', 'data', 'articles.json');
    let existingArticles = [];
    
    try {
      const data = fs.readFileSync(articlesFilePath, 'utf-8');
      existingArticles = JSON.parse(data);
    } catch (err) {
      console.log('No existing articles found, starting fresh');
    }
    
    // Filter out any existing static content to avoid duplicates
    const existingStaticIds = existingArticles
      .filter(article => article.source === 'static')
      .map(article => article.id);
    
    const newStaticContent = staticContent.filter(article => !existingStaticIds.includes(article.id));
    
    if (newStaticContent.length > 0) {
      // Add new static content to existing articles
      const updatedArticles = [...existingArticles, ...newStaticContent];
      
      // Write back to file
      fs.writeFileSync(articlesFilePath, JSON.stringify(updatedArticles, null, 2));
      
      console.log(`✅ Successfully imported ${newStaticContent.length} static articles to admin database`);
      console.log('Static content is now managed through the admin dashboard!');
    } else {
      console.log('✅ All static content already imported');
    }
    
  } catch (error) {
    console.error('❌ Error importing static content:', error);
  }
}

// Run the import
importStaticContent();