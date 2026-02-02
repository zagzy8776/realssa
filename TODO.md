# Add Gradient Overlay to Slider Image

## Tasks
- [ ] Modify the slider image container in src/pages/Index.tsx to add a gradient overlay
- [ ] Wrap the image in a container with bg-gradient-to-t from-black/90 to-transparent
- [ ] Ensure the gradient improves text readability

## Implementation Details
- Located the image div in the slider section
- Added a relative container around the image
- Added an absolute overlay div with the gradient class: bg-gradient-to-t from-black/90 to-transparent
- The gradient goes from black (90% opacity) at the bottom to transparent at the top
- This should improve readability of the white text over the image
