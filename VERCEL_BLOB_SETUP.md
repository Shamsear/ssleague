# Vercel Blob Storage Setup Guide

## 📦 What's Included

✅ Package installed: `@vercel/blob`  
✅ API routes created for upload/retrieve  
✅ Upload component ready to use  
✅ Environment variable placeholder added  

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Get Your Vercel Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (or create a new one)
3. Navigate to **Storage** tab
4. Click **Create Database** → Select **Blob**
5. Copy the `BLOB_READ_WRITE_TOKEN`

**Note:** If you don't have a Vercel account yet:
- Sign up at https://vercel.com (free)
- Connect your GitHub repository
- Deploy your Next.js app

### Step 2: Add Token to Environment Variables

Open `.env.local` and replace `your_token_here` with your actual token:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_AbCdEfGh123456
```

### Step 3: Deploy to Vercel

```bash
# Push to GitHub
git add .
git commit -m "Add Vercel Blob Storage for player photos"
git push

# Or deploy directly
vercel deploy
```

---

## 📸 How to Use

### Upload Photo

```typescript
// In your admin/committee panel
import PlayerPhotoUpload from '@/components/PlayerPhotoUpload';

<PlayerPhotoUpload 
  playerId="12345" 
  onUploadSuccess={(url) => console.log('Uploaded:', url)}
/>
```

### Get Photo URL

```typescript
// Fetch photo URL
const response = await fetch(`/api/players/photos/${playerId}`);
const { url } = await response.json();

// Use in img tag
<img src={url} alt="Player photo" />
```

### Upload via API

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('playerId', '12345');

const response = await fetch('/api/players/photos/upload', {
  method: 'POST',
  body: formData,
});
```

---

## 📁 File Structure

Photos are stored as:
```
player-photos/
├── 12345.jpg
├── 67890.png
├── 11111.webp
└── ...
```

---

## 💰 Pricing (FREE Tier)

✅ **1 GB storage** - ~10,000 player photos  
✅ **100 GB bandwidth/month** - millions of views  
✅ **No credit card required**  

---

## 🔒 Security

- Photos are publicly accessible (read-only)
- Upload requires authentication (implement in your admin panel)
- Token should be kept secret (never commit to Git)

---

## 🐛 Troubleshooting

### Error: "BLOB_READ_WRITE_TOKEN is not defined"
- Make sure you added the token to `.env.local`
- Restart your dev server: `npm run dev`

### Error: "File too large"
- Max file size: 4MB
- Compress images before uploading

### Photo not showing
- Check if token is valid
- Verify file was uploaded in Vercel Dashboard → Storage

---

## 🎯 Next Steps

1. ✅ Get your Vercel Blob token
2. ✅ Add to `.env.local`
3. ✅ Deploy to Vercel
4. ✅ Test photo upload
5. ✅ Add upload UI to admin panel

---

## 📚 Resources

- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [Next.js File Upload](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#formdata)
- [Free Tier Details](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing)
