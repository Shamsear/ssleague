# 🚀 Vercel Deployment Guide

Complete guide to deploy your Next.js app to Vercel.

---

## ✅ Pre-Deployment Checklist

### 1. Code is Ready
- [x] Build script updated (removed --turbopack)
- [x] All optimizations applied
- [x] Firebase cache system integrated
- [ ] Git repository created
- [ ] Code pushed to GitHub/GitLab/Bitbucket

### 2. Services Ready
- [ ] Firebase project created
- [ ] Neon database created
- [ ] All credentials available

---

## Step 1: Push to Git Repository

If you haven't already, initialize git and push to GitHub:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for Vercel deployment"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/your-repo.git

# Push
git push -u origin main
```

---

## Step 2: Connect to Vercel

### 2.1 Sign Up / Log In
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended)
3. Authorize Vercel to access your repositories

### 2.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Select your repository
3. Click **"Import"**

---

## Step 3: Configure Build Settings

Vercel will auto-detect Next.js. Use these settings:

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next (auto-detected)
Install Command: npm install
```

---

## Step 4: Environment Variables

Add ALL environment variables from your `.env.local` file:

### Required Variables:

#### Firebase (Client-side)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### Firebase Admin (Server-side)
```
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important for Private Key:**
- Keep the quotes: `"-----BEGIN..."`
- Keep `\n` for line breaks (don't replace with actual newlines)
- Copy the entire key including BEGIN and END lines

#### Neon Database
```
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

#### Other (if applicable)
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### How to Add Variables:
1. In Vercel dashboard, go to your project
2. Click **"Settings"** tab
3. Click **"Environment Variables"** in sidebar
4. Add each variable:
   - **Key:** Variable name
   - **Value:** Variable value
   - **Environments:** Select all (Production, Preview, Development)
5. Click **"Save"**

---

## Step 5: Deploy

1. Click **"Deploy"** button
2. Wait for build to complete (3-5 minutes)
3. Vercel will provide a URL like: `https://your-app.vercel.app`

---

## Step 6: Verify Deployment

### Check these pages:
- [ ] Homepage loads
- [ ] Login works
- [ ] Dashboard accessible
- [ ] Firebase reads/writes work
- [ ] Neon database queries work
- [ ] Player pages load correctly

### Check Logs:
1. Go to **Deployments** tab
2. Click on your deployment
3. Click **"Build Logs"** to see build process
4. Click **"Function Logs"** to see runtime logs

---

## Step 7: Configure Custom Domain (Optional)

### Add Your Domain:
1. Go to **Settings** → **Domains**
2. Click **"Add"**
3. Enter your domain name
4. Follow DNS configuration instructions

### SSL Certificate:
- Vercel automatically provides SSL certificate
- Takes 24-48 hours to propagate

---

## Common Issues & Solutions

### Issue 1: Build Fails

**Error:** `Module not found` or `Cannot find module`

**Solution:**
```bash
# Clean install locally first
rm -rf node_modules package-lock.json
npm install
npm run build

# If it works locally, push changes
git add .
git commit -m "Fix dependencies"
git push
```

### Issue 2: Environment Variables Not Working

**Error:** `Firebase config missing` or similar

**Solution:**
1. Double-check all env vars in Vercel dashboard
2. Ensure `NEXT_PUBLIC_` prefix for client-side vars
3. Redeploy after adding/changing env vars

### Issue 3: Firebase Admin Key Error

**Error:** `Error parsing private key`

**Solution:**
```javascript
// In Vercel, the private key format should be:
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR\nKEY\nHERE\n-----END PRIVATE KEY-----\n"

// Make sure to:
// 1. Keep the quotes
// 2. Keep \n as literal text (not actual newlines)
// 3. Include BEGIN and END lines
```

### Issue 4: Function Timeout

**Error:** `Function execution timeout`

**Solution:**
```javascript
// In vercel.json, increase timeout (Hobby plan: 10s, Pro: 60s)
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10
    }
  }
}
```

### Issue 5: Database Connection Fails

**Error:** `Connection timeout` or `ECONNREFUSED`

**Solution:**
1. Check Neon database is not paused
2. Verify connection string has `?sslmode=require`
3. Check Neon IP allowlist if enabled

---

## Performance Optimizations for Vercel

### 1. Enable Edge Functions (Optional)
For faster response times globally:

```javascript
// In route files
export const runtime = 'edge';
```

### 2. Configure Caching
In `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },
};
```

### 3. Monitor Performance
1. Go to **Analytics** tab in Vercel
2. Check response times
3. Monitor Firebase reads (should be low with cache!)

---

## Monitoring & Maintenance

### Daily Checks:
- [ ] Check Vercel function logs for errors
- [ ] Monitor Firebase usage (should be ~1-2K reads/day)
- [ ] Check Neon database usage

### Weekly:
- [ ] Review Vercel analytics
- [ ] Check cache hit rates (in logs)
- [ ] Monitor response times

### Monthly:
- [ ] Review Firebase costs
- [ ] Review Neon database costs
- [ ] Update dependencies if needed

---

## Deployment Checklist

### Before First Deploy:
- [ ] All environment variables added to Vercel
- [ ] serviceAccountKey.json is in .gitignore (NEVER commit this!)
- [ ] .env.local is in .gitignore
- [ ] Code pushed to Git repository
- [ ] Firebase project is in Blaze (pay-as-you-go) plan if needed
- [ ] Neon database is accessible

### After Deploy:
- [ ] Test login functionality
- [ ] Test database operations
- [ ] Test file uploads (if applicable)
- [ ] Test all API routes
- [ ] Check Firebase console for errors
- [ ] Monitor initial traffic

---

## Automatic Deployments

Vercel automatically deploys when you push to your repository:

- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment
- **Pull requests** → Automatic preview deployments

---

## Rollback if Needed

If something goes wrong:

1. Go to **Deployments** tab
2. Find previous working deployment
3. Click **"•••"** → **"Promote to Production"**
4. Previous version is now live!

---

## Cost Estimation

### Vercel Free Plan:
- ✅ 100 GB bandwidth/month
- ✅ 6,000 build minutes/month
- ✅ Unlimited static sites
- ✅ 10 serverless functions
- ⚠️ 10-second function timeout

### If You Exceed Free Plan:
**Vercel Pro:** $20/month
- 1 TB bandwidth
- 60-second function timeout
- Better support

---

## Support Resources

### Vercel:
- Docs: [vercel.com/docs](https://vercel.com/docs)
- Discord: [vercel.com/discord](https://vercel.com/discord)

### Your Project:
- Check function logs in Vercel dashboard
- Check Firebase console for database errors
- Check Neon dashboard for database issues

---

## Summary

✅ **Update package.json** build script  
✅ **Push code** to Git repository  
✅ **Import project** to Vercel  
✅ **Add environment variables**  
✅ **Deploy** and test  
✅ **Monitor** performance  

**Your app is now live on Vercel! 🎉**

---

## Next Steps After Deployment

1. **Test Everything:**
   - Login/Logout
   - Create/Read/Update/Delete operations
   - Historical season imports
   - Player pages
   - Team dashboards

2. **Monitor Performance:**
   - Check Vercel analytics
   - Monitor Firebase reads (should be ~1K/day with cache)
   - Check response times

3. **Set Up Alerts:**
   - Vercel deployment notifications
   - Firebase budget alerts
   - Uptime monitoring (UptimeRobot, Pingdom)

4. **Share Your App:**
   - Your app is now live at: `https://your-app.vercel.app`
   - Share with users
   - Collect feedback

**Congratulations on deploying to production! 🚀**
