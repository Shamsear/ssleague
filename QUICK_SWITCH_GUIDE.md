# Quick Database Switch Guide 🚀

## TL;DR - Fast Switch Process

### 1️⃣ Create New Firebase Project (5 minutes)
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it → Create
4. Enable Firestore Database
5. Enable Email/Password Authentication

### 2️⃣ Get Configuration (2 minutes)
1. Settings ⚙️ → Project settings
2. Add web app (</> icon) or find existing app
3. Copy the config values

### 3️⃣ Update .env.local (1 minute)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_new_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-new-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-new-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-new-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 4️⃣ Restart Server (30 seconds)
```powershell
# Press Ctrl+C to stop current server
npm run dev
```

### 5️⃣ Set Security Rules (2 minutes)
Copy rules from `SWITCH_FIREBASE_DATABASE.md` Step 8 → Paste in Firebase Console → Publish

### 6️⃣ Migrate Data (Optional - 5 minutes)
**Before switching `.env.local`:**
1. Go to `/dashboard/committee/database`
2. Click "Create Backup" → Download JSON

**After switching `.env.local`:**
1. Restart server
2. Go to `/dashboard/committee/database`
3. Click "Restore from Backup" → Upload JSON

---

## ⚠️ Important Reminders

- ✅ Backup your old `.env.local` values first
- ✅ Restart the dev server after changing `.env.local`
- ✅ Enable Email/Password auth in new Firebase project
- ✅ Set up Firestore security rules
- ✅ Test login before importing data

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't login | Enable Email/Password in Firebase Console → Authentication |
| Permission denied | Set up security rules in Firestore → Rules tab |
| Changes not working | Restart dev server completely |
| Old data showing | Clear browser cache or use incognito mode |

---

## 📋 Verification Steps

After switching, test these:
- [ ] Register new user works
- [ ] Login works
- [ ] Can view dashboard
- [ ] Can import players

---

## 🔄 Rollback (if needed)

1. Replace `.env.local` with old values
2. Restart server
3. Done! You're back to old database

---

**Full detailed guide:** See `SWITCH_FIREBASE_DATABASE.md`
