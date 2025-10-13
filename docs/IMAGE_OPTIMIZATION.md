# Player Image Optimization Guide

## Overview
This document describes the optimizations implemented to improve player image loading performance throughout the application.

## Optimizations Implemented

### 1. **Direct PNG Loading**
- **Problem**: Component was trying multiple extensions (jpg → jpeg → png → webp) causing 3-4 failed HTTP requests per image
- **Solution**: Since all images are `.png`, we now load them directly with the correct extension
- **Impact**: Eliminates 3 unnecessary failed requests per image

### 2. **Next.js Image Component**
- **Before**: Using native `<img>` tag
- **After**: Using Next.js `<Image>` component with optimization
- **Benefits**:
  - Automatic image optimization (WebP/AVIF conversion)
  - Lazy loading for off-screen images
  - Responsive image sizing
  - Built-in blur placeholder support

### 3. **Loading States**
- Added animated skeleton loader while images load
- Provides immediate visual feedback to users
- Reduces perceived loading time

### 4. **Priority Loading**
- Hero images on player detail pages use `priority={true}`
- Tells Next.js to preload these critical images
- Ensures above-the-fold content loads immediately

### 5. **Next.js Configuration**
Added optimal image settings in `next.config.ts`:
```typescript
images: {
  formats: ['image/avif', 'image/webp'],  // Modern formats for better compression
  minimumCacheTTL: 60,                     // Cache images for 60 seconds
  deviceSizes: [...],                       // Responsive breakpoints
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Avatar/thumbnail sizes
}
```

### 6. **Server-Side Utilities**
Created `lib/getPlayerImageUrl.ts` for server-side image URL resolution:
- Checks file existence on the server
- No client-side HTTP requests needed
- Can be used in Server Components for even faster loading

## Component Usage

### Basic Usage
```tsx
import PlayerImage from '@/components/PlayerImage';

<PlayerImage
  playerId={player.player_id}
  playerName={player.name}
  size={100}
/>
```

### Avatar in Lists
```tsx
import { PlayerAvatar } from '@/components/PlayerImage';

<PlayerAvatar
  playerId={player.player_id}
  playerName={player.name}
  size={40}
/>
```

### Card View (Detail Pages)
```tsx
import { PlayerCard } from '@/components/PlayerImage';

<PlayerCard
  playerId={player.player_id}
  playerName={player.name}
  priority={true}  // For above-the-fold images
/>
```

## Performance Metrics

### Before Optimization
- Multiple failed requests (3-4 per image)
- No image optimization
- No loading states
- Using unoptimized `<img>` tags

### After Optimization
- Single successful request per image
- Automatic WebP/AVIF conversion
- Skeleton loading states
- Priority preloading for hero images
- Next.js Image optimization

## Browser Caching

Images are cached by the browser based on:
1. Next.js image optimization cache (60 seconds TTL)
2. Browser HTTP cache
3. Service Worker cache (if PWA is enabled)

## Best Practices

### When to Use `priority={true}`
- Hero images on detail pages
- First visible image on any page
- Images in the viewport on page load

### When NOT to Use `priority={true}`
- Images in scrollable lists
- Images below the fold
- Multiple images on the same page (only use for 1-2 critical images)

## Fallback Behavior

If an image doesn't exist:
1. Component tries to load the PNG
2. On error, shows the player's initial letter
3. Gradient background (blue-400 to blue-600)
4. Initial letter centered and scaled

## Future Improvements

1. **Convert all PNGs to WebP**: Reduce file size by ~30%
2. **Image CDN**: Use Vercel Image Optimization or external CDN
3. **Blur Placeholder**: Generate blur data URLs for all images
4. **Responsive Images**: Generate multiple sizes during upload
5. **Lazy Loading Threshold**: Customize intersection observer settings

## File Locations

- Component: `components/PlayerImage.tsx`
- Server Utility: `lib/getPlayerImageUrl.ts`
- API Endpoint: `app/api/players/image-exists/route.ts`
- Config: `next.config.ts`
- Images Directory: `public/images/players/`

## Troubleshooting

### Images Still Loading Slowly
1. Check network tab for failed requests
2. Verify images exist in `public/images/players/`
3. Clear Next.js cache: `npm run clean` or delete `.next` folder
4. Restart dev server

### Images Not Showing
1. Verify file naming: `{player_id}.png`
2. Check file permissions
3. Verify player_id is correct
4. Check browser console for errors

### Build Issues
If you encounter build errors:
```bash
rm -rf .next
npm run build
```

## Related Documentation

- [Next.js Image Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/images)
- [Web Vitals](https://web.dev/vitals/)
- [Image CDNs](https://web.dev/image-cdns/)
