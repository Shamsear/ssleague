# ⏰ Cron Job Setup Guide (Every Minute)

Since you need rounds to finalize every minute (not just daily), you need to use an external cron service.

---

## Option 1: cron-job.org (FREE) ✅ **RECOMMENDED**

### Features:
- ✅ **FREE forever**
- ✅ Runs every **1 minute** minimum
- ✅ Email notifications on failures
- ✅ Execution history
- ✅ SSL/HTTPS support
- ✅ No credit card needed

### Setup Steps:

#### 1. Deploy Your App to Vercel First
```bash
# Your app URL will be something like:
https://your-app.vercel.app
```

#### 2. Create Account at cron-job.org

1. Go to [cron-job.org](https://cron-job.org)
2. Click **"Sign Up"** (free)
3. Verify your email

#### 3. Create Cron Job

1. Click **"Create cronjob"**
2. Fill in:

```
Title: Finalize Rounds
URL: https://your-app.vercel.app/api/cron/finalize-rounds
Schedule: Every 1 minute
Execution: Every minute (* * * * *)
Enabled: ✓ Yes
```

3. Click **"Create cronjob"**

#### 4. Add Security (Recommended)

Add a secret token to your Vercel environment variables:

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add:
   ```
   CRON_SECRET=your_random_secret_here_xyz123
   ```

3. Update cron-job.org:
   - Edit your cron job
   - Under **"Request"**, add header:
   ```
   Authorization: Bearer your_random_secret_here_xyz123
   ```

✅ **Done!** Your rounds will finalize every minute automatically.

---

## Option 2: EasyCron (FREE Tier)

### Features:
- ✅ Free tier: 20 cron jobs
- ✅ Runs every **1 minute**
- ✅ Email alerts

### Setup:

1. Go to [easycron.com](https://www.easycron.com)
2. Sign up (free)
3. Create cron job:
   ```
   URL: https://your-app.vercel.app/api/cron/finalize-rounds
   Cron Expression: * * * * *
   ```

---

## Option 3: GitHub Actions (FREE)

### Features:
- ✅ **Completely FREE**
- ⚠️ Minimum: **Every 5 minutes** (not every 1 minute)
- ✅ Runs on GitHub infrastructure

### Setup:

Create `.github/workflows/cron.yml`:

```yaml
name: Finalize Rounds Cron

on:
  schedule:
    # Runs every 5 minutes (minimum allowed by GitHub)
    - cron: '*/5 * * * *'
  workflow_dispatch: # Manual trigger

jobs:
  finalize:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cron Endpoint
        run: |
          curl -X GET https://your-app.vercel.app/api/cron/finalize-rounds \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secret to GitHub:
1. Go to your repo → Settings → Secrets
2. Add `CRON_SECRET`

---

## Option 4: Vercel Pro ($20/month)

If you upgrade to Vercel Pro, you can use the built-in cron:

Update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/finalize-rounds",
      "schedule": "* * * * *"
    }
  ]
}
```

**Benefits:**
- Integrated with Vercel
- More reliable
- Better logging
- 60-second function timeout

---

## Comparison Table

| Service | Cost | Min Frequency | Reliability | Setup |
|---------|------|--------------|-------------|-------|
| **cron-job.org** | FREE | 1 minute | ⭐⭐⭐⭐⭐ | Easy |
| **EasyCron** | FREE | 1 minute | ⭐⭐⭐⭐ | Easy |
| **GitHub Actions** | FREE | 5 minutes | ⭐⭐⭐⭐ | Medium |
| **Vercel Pro** | $20/mo | 1 minute | ⭐⭐⭐⭐⭐ | Easiest |

---

## Every-Second Execution (Advanced)

If you need **every second** (not just every minute), you have 2 options:

### Option A: Client-Side Polling

Add to your admin dashboard:

```typescript
// In your admin page
useEffect(() => {
  const interval = setInterval(async () => {
    await fetch('/api/cron/finalize-rounds');
  }, 1000); // Every second
  
  return () => clearInterval(interval);
}, []);
```

**Pros:** Free, instant  
**Cons:** Only works when admin page is open

### Option B: Self-Hosted Cron

Run your own cron on a VPS:

```bash
# Add to crontab -e
* * * * * for i in {0..59}; do curl https://your-app.vercel.app/api/cron/finalize-rounds & sleep 1; done
```

**Pros:** Every second execution  
**Cons:** Need to manage a server ($5/mo DigitalOcean Droplet)

---

## Testing Your Cron

### Manual Test:
```bash
# Test the endpoint directly
curl https://your-app.vercel.app/api/cron/finalize-rounds
```

### Check Logs:
1. Go to Vercel → Your Project → Logs
2. Filter for `/api/cron/finalize-rounds`
3. Verify it's being called

---

## Monitoring

### Check if Cron is Working:

Add this to your admin dashboard:

```typescript
// Fetch last cron execution time from logs
useEffect(() => {
  const checkCron = async () => {
    const response = await fetch('/api/cron/finalize-rounds');
    console.log('Cron test:', response.ok ? 'Working ✅' : 'Failed ❌');
  };
  
  checkCron();
}, []);
```

---

## Recommended Setup

**For Production:**

1. **Use cron-job.org** (free, every minute)
2. **Add CRON_SECRET** for security
3. **Enable email notifications** in cron-job.org
4. **Monitor in Vercel logs**

**Total Cost:** $0/month ✅

---

## Security Best Practices

### 1. Add Secret Token

In `.env.local` and Vercel:
```
CRON_SECRET=your_very_long_random_secret_here_min_32_chars
```

### 2. Check Secret in Route

Already implemented in your code:
```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 3. Rate Limiting (Optional)

Add to `vercel.json`:
```json
{
  "routes": [
    {
      "src": "/api/cron/.*",
      "headers": {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      }
    }
  ]
}
```

---

## Summary

✅ **Best Option:** cron-job.org (free, every minute)  
✅ **Setup Time:** 5 minutes  
✅ **Cost:** $0/month  
✅ **Reliability:** Excellent  

Your rounds will finalize within 60 seconds of expiring! 🎉

---

## Next Steps:

1. Deploy your app to Vercel
2. Sign up at [cron-job.org](https://cron-job.org)
3. Create cron job pointing to your app
4. Add CRON_SECRET for security
5. Test and monitor

**Done!** Your cron is set up for every-minute execution.
