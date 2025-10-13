# Bulk Player Photo Upload Guide

## 📸 Features Added

✅ **Bulk Upload** - Upload multiple player photos at once  
✅ **Bulk Delete** - Delete all player photos with one click  
✅ **Auto-naming** - Files named by `player_id`  
✅ **Progress tracking** - See upload/delete results  
✅ **Error handling** - View which uploads failed  

---

## 🎯 Location

**Committee Admin Dashboard** → **Database Management** → **Bulk Player Photo Management**

Or navigate to: `/dashboard/committee/database`

---

## 📤 How to Upload Photos

### Step 1: Prepare Your Photos

Name your photo files using the player's ID:

```
12345.jpg
67890.png
11111.webp
player_54321.jpg  (prefix "player_" is optional)
```

### Step 2: Select Multiple Files

1. Click "Select Photos (Multiple files)"
2. Choose all player photos at once
3. You'll see: "X file(s) selected"

### Step 3: Upload

1. Click "📤 Upload Photos"
2. Wait for upload to complete
3. See results:
   - ✅ Success count
   - ❌ Failed count
   - 📊 Total uploaded

---

## 🗑️ How to Delete All Photos

### ⚠️ Warning
This will **permanently delete ALL player photos**. Cannot be undone!

### Steps:
1. Click "🗑️ Delete All Photos"
2. Confirm first warning
3. Confirm final warning
4. Wait for deletion to complete
5. See results:
   - ✅ Deleted count
   - ❌ Failed count

---

## 📝 File Naming Rules

### Accepted Formats:
| Format | Example | Notes |
|--------|---------|-------|
| `{id}.jpg` | `12345.jpg` | ✅ Recommended |
| `{id}.png` | `67890.png` | ✅ Good |
| `{id}.webp` | `11111.webp` | ✅ Modern format |
| `player_{id}.jpg` | `player_12345.jpg` | ✅ Prefix optional |

### Requirements:
- **File size**: Max 4MB per file
- **Formats**: JPG, PNG, WebP only
- **Naming**: Must contain player ID in filename

---

## 🔍 API Endpoints Created

### 1. Bulk Upload
```
POST /api/players/photos/bulk-upload
Content-Type: multipart/form-data

FormData:
  files: File[]
```

**Response:**
```json
{
  "success": true,
  "message": "Uploaded 10 photos successfully",
  "summary": {
    "total": 10,
    "success": 10,
    "failed": 0
  },
  "results": [...],
  "errors": []
}
```

### 2. Bulk Delete
```
POST /api/players/photos/bulk-delete
Content-Type: application/json

Body:
{
  "deleteAll": true
}
// OR
{
  "playerIds": ["12345", "67890"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deleted 10 photos",
  "summary": {
    "total": 10,
    "success": 10,
    "failed": 0
  }
}
```

---

## 🚨 Troubleshooting

### "No files provided"
- Make sure you selected files before clicking upload

### "File too large"
- Compress images to under 4MB
- Use online tools like TinyPNG

### "Upload failed for some files"
- Check file naming (must include player_id)
- Verify file format (JPG/PNG/WebP only)
- Check error details in results

### "BLOB_READ_WRITE_TOKEN is not defined"
- Restart dev server: `npm run dev`
- Check `.env.local` has the token

---

## 💡 Tips

1. **Batch Processing**: Upload 50-100 photos at a time
2. **File Organization**: Keep photos in a folder named by player_id
3. **Consistent Format**: Use same file format (e.g., all JPG)
4. **Optimize Images**: Compress before upload to save storage
5. **Backup**: Keep original photos before bulk delete

---

## 📊 Storage Limits (Vercel Blob - FREE Tier)

- **Storage**: 1 GB (~10,000 photos at 100KB each)
- **Bandwidth**: 100 GB/month
- **Cost**: **FREE** (no credit card required)

---

## 🎓 Example Workflow

```bash
# 1. Organize photos in a folder
photos/
  ├── 12345.jpg
  ├── 67890.jpg
  └── 11111.jpg

# 2. Select all files in dashboard
# 3. Upload
# 4. See results
# ✅ Uploaded 3 photos successfully

# 5. Photos now accessible at:
# https://blob.vercel.com/.../player-photos/12345.jpg
```

---

## 🔗 Related Links

- [Vercel Blob Setup Guide](./VERCEL_BLOB_SETUP.md)
- [Player Photo Upload Component](./components/BulkPhotoUpload.tsx)
- [API Routes](./app/api/players/photos/)
