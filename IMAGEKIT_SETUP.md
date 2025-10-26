# ImageKit Setup Guide

## 1. Create ImageKit Account

1. Go to [ImageKit.io](https://imagekit.io/)
2. Sign up for a free account
3. Get your credentials from the Dashboard

## 2. Environment Variables

Add these to your `.env.local` file:

```env
# ImageKit Configuration
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=your_public_key_here
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
IMAGEKIT_PRIVATE_KEY=your_private_key_here
```

### Where to find these:

1. **Public Key**: Dashboard → Developer Options → API Keys
2. **URL Endpoint**: Dashboard → URL-endpoint (looks like `https://ik.imagekit.io/your_id`)
3. **Private Key**: Dashboard → Developer Options → API Keys (Keep this secret!)

## 3. Features Implemented

### Upload Images
- Automatic optimization
- CDN delivery
- Unique file names
- Organized in folders (`/team-logos`)
- Tagged for easy management

### Retrieve Images
- Fast CDN delivery
- Automatic format conversion (WebP)
- Lazy loading
- Responsive images

### Delete Images
- Server-side deletion via API
- Cleanup old logos when uploading new ones

## 4. Usage in Code

### Upload Team Logo
```typescript
import { uploadImage } from '@/lib/imagekit/upload';

const result = await uploadImage({
  file: fileObject,
  fileName: 'team_logo.png',
  folder: '/team-logos',
  tags: ['team', 'logo', teamId],
  useUniqueFileName: true,
});

// Save to Firestore
await updateDoc(doc(db, 'users', teamId), {
  teamLogoUrl: result.url,
  teamLogoFileId: result.fileId, // For deletion later
});
```

### Upload Player Photo
```typescript
import { uploadPlayerPhoto } from '@/lib/imagekit/playerPhotos';

const result = await uploadPlayerPhoto(playerId, file);

// Returns: { url: string, fileId: string }
```

### Bulk Upload Player Photos
```typescript
import { bulkUploadPlayerPhotos } from '@/lib/imagekit/playerPhotos';

const uploads = [
  { playerId: 'player1', file: file1 },
  { playerId: 'player2', file: file2 },
];

const results = await bulkUploadPlayerPhotos(uploads);
// Returns array with url, fileId, and optional error for each
```

### Get Optimized URL
```typescript
import { getOptimizedImageUrl } from '@/lib/imagekit/upload';

const optimizedUrl = getOptimizedImageUrl(originalUrl, {
  width: 200,
  height: 200,
  quality: 80,
  format: 'auto', // WebP for supported browsers
  crop: 'maintain_ratio',
});
```

### Use OptimizedImage Component
```tsx
import OptimizedImage from '@/components/OptimizedImage';

<OptimizedImage
  src={logoUrl}
  alt="Team Logo"
  width={200}
  height={200}
  quality={85}
  className="rounded-lg"
  fallback={<div>Logo not available</div>}
/>
```

### Delete Image
```typescript
import { deleteImage } from '@/lib/imagekit/upload';

await deleteImage(fileId);
```

## 5. Benefits Over Firebase Storage

✅ **Free Tier**: 20GB bandwidth/month (vs Firebase's limited free tier)
✅ **Automatic Optimization**: WebP conversion, compression
✅ **CDN**: Global delivery, faster loading
✅ **Transformations**: Resize, crop, format on-the-fly
✅ **No Proxy Issues**: Direct CDN access, no authentication popups
✅ **Better Performance**: Optimized for images specifically

## 6. API Routes Created

- `GET /api/imagekit/auth` - Authentication for uploads
- `DELETE /api/imagekit/delete` - Delete images

## 7. Files Created

**Core ImageKit:**
- `lib/imagekit/config.ts` - Configuration
- `lib/imagekit/upload.ts` - Upload/retrieve/delete functions
- `lib/imagekit/index.ts` - Centralized exports
- `lib/imagekit/playerPhotos.ts` - Player photo utilities

**API Routes:**
- `app/api/imagekit/auth/route.ts` - Auth endpoint
- `app/api/imagekit/delete/route.ts` - Delete endpoint

**Components:**
- `components/OptimizedImage.tsx` - Auto-optimized image component

## 8. Updated Files

**Team Logos:**
- `app/dashboard/team/page.tsx` - Team dashboard logo upload
- `app/dashboard/team/profile/edit/page.tsx` - Team profile edit

**Player Photos:**
- `app/api/players/photos/upload/route.ts` - Single photo upload
- `app/api/players/photos/upload-public/route.ts` - Bulk photo upload

## 9. Testing

1. Add environment variables to `.env.local`
2. Restart dev server: `npm run dev`
3. Go to team dashboard
4. Upload a logo - it will now use ImageKit!
5. Check ImageKit dashboard to see uploaded files

## 10. Migration from Firebase Storage

If you have existing logos in Firebase Storage, you can:
1. Download them
2. Re-upload via the new ImageKit upload feature
3. URLs will automatically update in Firestore

## Support

ImageKit Free Tier:
- 20GB bandwidth/month
- 20GB storage
- Unlimited transformations
- Perfect for small to medium apps!
