# RealSSA News - African & Global News Aggregator

## 🌍 Project Overview

**RealSSA News** is a comprehensive AI-powered news aggregation platform delivering real-time news from Africa and around the world. The platform automatically fetches, summarizes, and publishes news from 195+ countries using Google Gemini AI.

## 🚀 Features

### Public Features
- ✅ **AI-Powered Summaries**: Every article gets a branded 2-sentence RealSSA summary
- ✅ **Global Coverage**: 195+ countries with automated RSS ingestion
- ✅ **Real-Time Updates**: News updated every 30 minutes
- ✅ **World Directory**: Browse news by country and continent
- ✅ **Category Browsing**: Nigerian News, World News, Sports, Crypto, Culture, Jobs
- ✅ **Live TV**: Embedded Arise News live stream
- ✅ **PWA Support**: Install as mobile app (Android/iOS)
- ✅ **Push Notifications**: OneSignal integration for breaking news
- ✅ **Video News**: YouTube integration for video content
- ✅ **Responsive Design**: Optimized for mobile, tablet, and desktop

### AI Features 🤖
- ✅ **Automated Summarization**: Google Gemini 2.0 Flash Lite integration
- ✅ **On-Demand Generation**: Summaries generated when users view articles
- ✅ **Background Processing**: Hourly cron job pre-generates summaries
- ✅ **Smart Caching**: Once generated, summaries are stored in database
- ✅ **Zero Admin Work**: Fully automated pipeline

### Admin Features
- ✅ Secure admin login system
- ✅ Complete article management dashboard
- ✅ Create, edit, and delete manual articles
- ✅ RSS article analytics
- ✅ User management
- ✅ Statistics and analytics

## 🛠️ Technologies Used

### Frontend
- **Framework**: React 18, TypeScript, Vite
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS + CSS Modules
- **State Management**: React Context, TanStack Query
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Mobile**: Capacitor (Android/iOS apps)

### Backend
- **Runtime**: Node.js (Vercel Serverless Functions)
- **Database**: Neon PostgreSQL (serverless)
- **RSS Parsing**: rss-parser
- **Authentication**: JWT + bcrypt
- **AI**: Google Gemini 2.0 Flash Lite
- **Push Notifications**: OneSignal

### Infrastructure
- **Hosting**: Vercel (Frontend + API)
- **Database**: Neon (PostgreSQL)
- **Cron Jobs**: cron-job.org
- **CDN**: Vercel Edge Network
- **SEO**: Google Indexing API, IndexNow, WebSub

## 📁 Project Structure

```
realssa/
├── src/                      # Frontend React app
│   ├── components/           # Reusable UI components
│   ├── pages/                # Page components
│   │   ├── WorldDirectory.tsx    # 195+ country directory
│   │   ├── CountryNews.tsx       # Country-specific news
│   │   ├── NigerianNews.tsx      # Nigerian news feed
│   │   └── ...
│   ├── data/                 # Static data
│   │   └── world_feeds.json      # RSS feeds for all countries
│   ├── lib/                  # Utility functions
│   └── assets/               # Images and media
│
├── backend/                  # Express API server
│   ├── server.js             # Main API with on-demand AI
│   ├── services/             # Business logic
│   │   ├── ingestion.js      # RSS feed ingestion
│   │   ├── summariser.js     # Google Gemini AI integration
│   │   ├── googleIndexing.js # SEO automation
│   │   └── notificationService.js  # Push notifications
│   ├── data/                 # JSON fallback storage
│   └── db_schema.sql         # PostgreSQL schema
│
├── api/                      # Vercel Serverless Functions
│   ├── index.js              # Main API wrapper
│   └── cron/                 # Automated jobs
│       ├── ingest.js         # RSS ingestion (every 30 min)
│       └── summarize.js      # AI summarization (every hour)
│
├── android/                  # Capacitor Android app
├── ios/                      # Capacitor iOS app
└── public/                   # Static assets
```

## 💻 Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/zagzy8776/EntertainmenGhc.git

# Navigate to project directory
cd EntertainmenGhc

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## 🎯 Admin Access

### Default Credentials
- **Username**: admin
- **Password**: EntertainmentGHC2026!

### Admin Features
1. **Dashboard**: Manage all articles (static + user)
2. **Post News**: Create new articles
3. **Edit Articles**: Modify existing content
4. **Make Editable**: Convert static articles to editable
5. **Delete Articles**: Remove unwanted content

## 🔧 Customization

### Change Admin Credentials
Edit `src/pages/AdminLogin.tsx`:

```typescript
// Update these values
const ADMIN_USERNAME = "YourUsername";
const ADMIN_PASSWORD = "YourSecurePassword";
```

### Update Site Information
Edit `src/components/Header.tsx` and `src/pages/Index.tsx` for site branding.

## 🌐 Deployment

### Quick Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables (Vercel Dashboard)

**Required:**
```env
DATABASE_URL=postgresql://neondb_owner:...@ep-curly-art-aol2g9ib-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=your_google_gemini_api_key
CRON_SECRET=your_secure_random_secret
JWT_SECRET=your_jwt_secret_key
```

**Optional:**
```env
VITE_ONESIGNAL_APP_ID=055b6596-a96c-48e2-8cda-ff4bb6d61009
VITE_YOUTUBE_API_KEY=your_youtube_api_key
GOOGLE_CREDENTIALS={"type":"service_account",...}
BUFFER_S_TOKEN=your_buffer_token
BUFFER_FILE_IDS=your_buffer_profile_ids
```

### Database Setup (Neon)

1. Create a Neon project at [console.neon.tech](https://console.neon.tech)
2. Run the SQL schema:
   ```bash
   # Copy contents from backend/db_schema.sql
   # AND backend/rss_articles_schema.sql
   # Paste into Neon SQL Editor
   ```

### Cron Jobs Setup

Use [cron-job.org](https://cron-job.org) or similar:

**Job 1: RSS Ingestion (Every 30 minutes)**
```
URL: https://www.realssanews.com.ng/api/cron/ingest?secret=YOUR_CRON_SECRET
Schedule: */30 * * * *
```

**Job 2: AI Summarization (Every hour)**
```
URL: https://www.realssanews.com.ng/api/cron/summarize?secret=YOUR_CRON_SECRET
Schedule: 0 * * * *
```

See [AI_SUMMARIZATION_SETUP.md](./AI_SUMMARIZATION_SETUP.md) for detailed setup instructions.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

## 📞 Contact

For questions or support, please contact the project maintainer.

## 🤖 AI Summarization System

This platform features a **fully automated AI summarization pipeline**:

1. **RSS Ingestion** (every 30 min): Fetches articles from 195+ countries
2. **AI Summarization** (every hour): Generates branded RealSSA summaries using Google Gemini
3. **On-Demand Generation**: If a user views an article before batch processing, summary is generated in real-time
4. **Smart Caching**: Summaries are cached in PostgreSQL after generation

**No admin intervention required!** The system is fully autonomous.

📖 **Full Setup Guide**: [AI_SUMMARIZATION_SETUP.md](./AI_SUMMARIZATION_SETUP.md)

---

## 📱 Mobile Apps

### Android
```bash
npx cap sync android
npx cap open android
# Build in Android Studio
```

### iOS
```bash
npx cap sync ios
npx cap open ios
# Build in Xcode
```

---

## 🔍 SEO & Indexing

The platform automatically notifies search engines when new content is published:

- ✅ **Google Indexing API**: Direct indexing requests
- ✅ **IndexNow**: Bing, Yandex, Seznam instant indexing
- ✅ **WebSub**: RSS feed subscriber notifications
- ✅ **Sitemap**: Auto-generated XML sitemap
- ✅ **RSS Feeds**: Per-category and global feeds

---

## 📊 Analytics

Track platform performance:
- Article views and engagement
- Category popularity
- Country-specific traffic
- AI summary generation stats
- RSS feed health monitoring

---

**RealSSA News** - The Pulse of Africa & The World! 🌍📰🤖