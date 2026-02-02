# RSS Feed Expansion Task

## Backend Changes
- [x] Add new RSS feed arrays for crypto, sports, and country-specific feeds
- [x] Create new API endpoints: /api/news/crypto, /api/news/sports, /api/news/ghana, /api/news/kenya, /api/news/south-africa, /api/news/uk, /api/news/usa
- [x] Update homepage aggregator to include diverse global content

## Frontend Changes
- [x] Create new page components: Crypto.tsx, Sports.tsx, Ghana.tsx, Kenya.tsx, SouthAfrica.tsx, UK.tsx, USA.tsx
- [x] Add routes in App.tsx for all new pages
- [ ] Update Header.tsx navigation to include new categories
- [ ] Modify HeroSection to show global content instead of Nigeria-centric
- [ ] Update homepage to aggregate from all categories

## Testing
- [ ] Test new RSS feeds and endpoints
- [ ] Verify navigation works
- [ ] Check homepage diversity
