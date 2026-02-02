# Cleanup Index.tsx Task

## Steps to Complete:
- [ ] Remove currentIndex state and related useEffects from Index.tsx
- [ ] Remove currentStory variable and debug logging from Index.tsx
- [ ] Remove the entire "Auto-Rotating Hero Slider" section from Index.tsx
- [ ] Update HeroSection props to accept stories array instead of currentStory
- [ ] Update Index.tsx to pass stories to HeroSection
- [ ] Ensure HeroSection uses stories?.[0] with optional chaining
- [ ] Add bg-gradient-to-t from-black/80 for text readability in HeroSection
- [ ] Set default news image if story.image is null in HeroSection
- [ ] Test the changes to ensure no ReferenceError and proper hero display
