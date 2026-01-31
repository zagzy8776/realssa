# Fix News API 502 Bad Gateway Issue

## Information Gathered
- Production server at https://realssa-production.up.railway.app has /api/news/world and /api/news/nigerian routes
- These routes are failing with 502 Bad Gateway error
- The backend/server.js file is corrupted with UTF-16 characters
- RSS feeds from external sources (BBC, Al Jazeera, etc.) are being fetched but likely timing out or failing
- Frontend expects specific article data structure with fields like id, title, excerpt, category, image, readTime, author, source, date

## Plan
- [ ] Create new backend/server.js with proper RSS news fetching routes
- [ ] Add error handling and timeouts for RSS feed fetching
- [ ] Include fallback/cached data when feeds fail
- [ ] Ensure data structure matches frontend expectations
- [ ] Test locally before deployment

## Dependent Files
- backend/server.js (create new)

## Followup Steps
- [ ] Test new server locally
- [ ] Deploy to Railway
- [ ] Verify World News and Nigerian News pages work
- [ ] Monitor for any remaining issues
