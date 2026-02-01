# Implementation Plan for Ads, Database, and Mobile Fit

## Phase 1: Ads Integration ✅
- [x] Complete Monetag script in index.html with proper CDN script tag
- [x] Create src/components/SocialBar.tsx with Breaking News banner and SmartLink fallback
- [x] Integrate SocialBar into main layout

## Phase 2: Database Migration ✅
- [x] Add pg to backend/package.json
- [x] Create backend/migration.js script for fact_checks table with 10 dummy investigative stories
- [x] Update backend/server.js to add PostgreSQL connection and /api/fact-check endpoint
- [x] Create src/components/SearchBar.tsx component
- [x] Connect SearchBar to /api/fact-check endpoint

## Phase 3: Mobile Styling ✅
- [x] Update NewsCard.tsx to ensure object-fit: cover on thumbnails
- [x] Add explicit overflow-hidden and text-overflow ellipsis to text containers
- [x] Ensure consistent card heights

## Deployment Fixes ✅
- [x] Remove merge conflict markers from src/pages/Index.tsx
- [x] Clean up import statements for successful Vercel build

## Followup Steps
- [ ] Install backend dependencies
- [ ] Run migration script
- [ ] Test all endpoints and components
- [ ] Verify mobile responsiveness
