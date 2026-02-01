# Implementation Plan for Ads, Database, and Mobile Fit

## Phase 1: Ads Integration ✅
- [x] Complete Monetag script in index.html with proper CDN script tag
- [x] Create src/components/SocialBar.tsx with Breaking News banner and SmartLink fallback
- [x] Integrate SocialBar into main layout

## Phase 2: Database Migration
- [ ] Add pg to backend/package.json
- [ ] Create backend/migration.js script for fact_checks table with 10 dummy investigative stories
- [ ] Update backend/server.js to add PostgreSQL connection and /api/fact-check endpoint
- [ ] Create src/components/SearchBar.tsx component
- [ ] Connect SearchBar to /api/fact-check endpoint

## Phase 3: Mobile Styling
- [ ] Update NewsCard.tsx to ensure object-fit: cover on all thumbnails
- [ ] Add explicit overflow-hidden and text-overflow: ellipsis to text containers
- [ ] Ensure consistent card heights

## Followup Steps
- [ ] Install backend dependencies
- [ ] Run migration script
- [ ] Test all endpoints and components
- [ ] Verify mobile responsiveness
