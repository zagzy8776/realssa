# Newssection Refactor TODO

## Tasks:

### 1. Update Header Component (Mobile Layout)
- [x] Move PushNotificationManager and DarkModeToggle to top of mobile header
- [x] Position them before the hamburger menu button


### 2. Refactor Newssection.tsx
- [x] Add hero section with gradient overlay (news-themed colors)
- [x] Replace EnhancedImage with SimpleImage for faster loading
- [x] Change from 3-column to clean 2-column grid layout
- [x] Remove infinite scroll complexity (IntersectionObserver, pagination states)
- [x] Simplify card design to match Ghana.tsx style
- [x] Add category inference logic from article titles
- [x] Improve error and empty state messaging
- [x] Add auto-refresh every 30 minutes
- [x] Ensure backend images and RSS feed images display properly
- [x] Add proper image fallbacks


### 3. Testing
- [x] Test news loading from backend
- [x] Test RSS feed image display
- [x] Test mobile layout with notification/dark toggle at top
- [x] Test error states
- [x] Verify fast loading performance

## Summary of Changes

### Header Component (src/components/Header.tsx)
- Moved PushNotificationManager and DarkModeToggle to the top of mobile header
- Positioned before the hamburger menu button for easy access
- Removed duplicate settings section from mobile menu

### Newssection Page (src/pages/Newssection.tsx)
- **Hero Section**: Added clean hero with blue-purple-pink gradient overlay, newspaper icon, and clear CTAs
- **Image Loading**: Replaced EnhancedImage with SimpleImage for faster loading
- **Layout**: Changed from 3-column to clean 2-column grid (better readability)
- **Simplified State**: Removed infinite scroll, IntersectionObserver, and complex pagination
- **Smart Categories**: Added category inference based on article title/content
- **Better Error Handling**: Improved error and empty state messaging
- **Auto-refresh**: Added 30-minute auto-refresh interval
- **Image Handling**: Proper support for backend and RSS feed images with fallbacks
- **Performance**: Faster load times with simplified component structure
