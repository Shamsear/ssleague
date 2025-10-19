# Firebase Read Optimization with ISR + On-Demand Revalidation

## Overview

This optimization reduces Firebase Firestore reads from **52,000/day to ~110/day** (99.8% reduction) by implementing:

1. **Server-side data aggregation** - Combine multiple documents into summary objects
2. **ISR (Incremental Static Regeneration)** - Cache API responses at the edge
3. **On-demand revalidation** - Update cached data within seconds when Firestore changes
4. **Client-side caching** - React Query for efficient client-side data management

## Read Comparison

### Before Optimization
- **Per user**: 260 reads (20 teams + 120 players + 120 stats)
- **200 users/day**: 52,000 reads
- **Result**: ❌ Exceeds 50k free tier limit

### After Optimization
- **Per user**: 0 reads (served from cache)
- **Detail page clicks**: ~100 reads
- **Revalidations**: ~10 reads
- **200 users/day**: ~110 reads total
- **Result**: ✅ 99.8% reduction, well within limits

## Setup Instructions

### 1. Environment Variables

Add these to your `.env.local` file:

```bash
# Revalidation Secret (generate a secure random string)
REVALIDATE_SECRET="your-very-secure-secret-key-here"

# Optional: For manual refresh authentication
MANUAL_REFRESH_SECRET="another-secure-secret"
```

**Generate secure secrets:**
```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 2. Rebuild Your Next.js App

After adding the new files, rebuild:

```bash
npm run build
npm run start
```

Or for development:
```bash
npm run dev
```

### 3. Deploy Firebase Cloud Functions (Optional but Recommended)

Cloud Functions automatically trigger cache updates when data changes.

#### Initialize Firebase Functions:
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize functions (if not already done)
firebase init functions
# Choose TypeScript or JavaScript
# Choose to install dependencies

# Copy the function code
# Copy contents of firebase-functions/index.js to functions/index.js
# Copy contents of firebase-functions/package.json to functions/package.json
```

#### Configure Environment Variables:
```bash
# Set revalidation URL and secret
firebase functions:config:set revalidate.url="https://your-domain.com/api/revalidate"
firebase functions:config:set revalidate.secret="your-revalidate-secret"
firebase functions:config:set revalidate.manual_secret="your-manual-secret"
```

#### Deploy Functions:
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 4. Alternative: Manual Revalidation

If you don't want to set up Cloud Functions, you can manually trigger revalidation after data changes:

```typescript
// In your admin update functions
import { triggerRevalidation } from '@/lib/utils/revalidation';

async function updateTeam(teamId: string, data: any) {
  // Update Firestore
  await updateDoc(doc(db, 'team_seasons', teamId), data);
  
  // Trigger cache revalidation
  await triggerRevalidation('teams');
}
```

Create the revalidation utility:

```typescript
// lib/utils/revalidation.ts
export async function triggerRevalidation(type: 'teams' | 'players' | 'stats' | 'all' = 'all') {
  try {
    const response = await fetch('/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.REVALIDATE_SECRET,
        type,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to revalidate cache');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Revalidation failed:', error);
    throw error;
  }
}
```

## Usage in Your Components

### Replace Direct Firestore Calls

**❌ Before (Direct Firestore):**
```typescript
'use client';
import { getAllTeams } from '@/lib/firebase/teams';
import { useEffect, useState } from 'react';

function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    getAllTeams().then(data => {
      setTeams(data);
      setLoading(false);
    });
  }, []);
  
  // 20 reads × every user = expensive!
}
```

**✅ After (Cached API):**
```typescript
'use client';
import { useCachedTeams } from '@/hooks/useCachedData';

function TeamsPage() {
  const { data: teams, isLoading } = useCachedTeams();
  
  // 0 reads per user! Data served from cache
}
```

### Available Hooks

```typescript
import {
  useCachedTeams,        // Get all teams
  useCachedPlayers,      // Get all players
  useCachedLeagueStats,  // Get full league stats
  useStandings,          // Get team standings
  useTopScorers,         // Get top scorers
  useTeamPlayers,        // Get players for specific team
  useRefreshCache,       // Manual cache refresh
} from '@/hooks/useCachedData';

// Usage examples:
const { data: teams, isLoading, error } = useCachedTeams();
const { data: players } = useCachedPlayers('season123');
const { data: standings } = useStandings();
const { data: topScorers } = useTopScorers();
const { data: teamPlayers } = useTeamPlayers('team0001');

// Manual refresh after admin action
const { refetchAll, refetchTeams } = useRefreshCache();
await refetchAll(); // Refresh all cached data
```

### Server Components (Recommended for Dashboard Pages)

For even better performance, use Server Components:

```typescript
// app/teams/page.tsx
import { buildTeamsSummary } from '@/lib/firebase/aggregates';

export const revalidate = 900; // Revalidate every 15 minutes

export default async function TeamsPage() {
  const teams = await buildTeamsSummary();
  
  return (
    <div>
      <h1>Teams</h1>
      {teams.map(team => (
        <TeamCard key={team.id} team={team} />
      ))}
    </div>
  );
}
```

## API Endpoints

### Cached Data Endpoints

All endpoints support `?seasonId=xxx` query parameter for filtering.

#### GET /api/cached/teams
Returns aggregated teams data with 15-minute cache.

```bash
curl https://your-domain.com/api/cached/teams
curl https://your-domain.com/api/cached/teams?seasonId=season123
```

#### GET /api/cached/players
Returns aggregated players data with 15-minute cache.

```bash
curl https://your-domain.com/api/cached/players
```

#### GET /api/cached/stats
Returns comprehensive league statistics with 15-minute cache.

```bash
curl https://your-domain.com/api/cached/stats
```

### Revalidation Endpoint

#### POST /api/revalidate
Triggers immediate cache refresh.

```bash
curl -X POST https://your-domain.com/api/revalidate \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your-secret-key",
    "type": "all"
  }'
```

**Parameters:**
- `secret` (required): Your REVALIDATE_SECRET
- `type` (optional): `"teams"`, `"players"`, `"stats"`, or `"all"`
- `paths` (optional): Array of specific paths to revalidate

## Monitoring and Testing

### Check Cache Status

```bash
# Test cached endpoints
curl -i https://your-domain.com/api/cached/teams

# Look for these headers:
# Cache-Control: public, s-maxage=900, stale-while-revalidate=1800
# X-Vercel-Cache: HIT (cached) or MISS (fresh)
```

### Test Revalidation

```bash
# Trigger revalidation
curl -X POST https://your-domain.com/api/revalidate \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-secret", "type": "all"}'

# Should return:
# {"success": true, "message": "Cache revalidated successfully"}
```

### Monitor Firebase Reads

1. Go to Firebase Console → Firestore → Usage
2. Check "Read operations" graph
3. Should see dramatic reduction after deploying

## Deployment Checklist

- [ ] Add `REVALIDATE_SECRET` to environment variables
- [ ] Deploy Next.js app with new code
- [ ] (Optional) Deploy Firebase Cloud Functions
- [ ] Configure Firebase Functions environment variables
- [ ] Update components to use `useCachedTeams()` hooks
- [ ] Test cached endpoints
- [ ] Test revalidation endpoint
- [ ] Monitor Firebase read count for 24 hours
- [ ] Verify cache is working (check response headers)

## Troubleshooting

### Cache Not Working

**Problem**: Still seeing high read counts

**Solutions**:
1. Check if components are using cached hooks
2. Verify `revalidate = 900` is set in route handlers
3. Check for direct Firestore imports in client components
4. Review Network tab for API calls (should hit `/api/cached/*`)

### Stale Data

**Problem**: Data not updating after Firestore changes

**Solutions**:
1. Verify Cloud Functions are deployed and running
2. Check Cloud Functions logs: `firebase functions:log`
3. Test revalidation manually: `POST /api/revalidate`
4. Ensure `REVALIDATE_SECRET` matches in both places
5. Check revalidation URL is correct in Firebase config

### Build Errors

**Problem**: Type errors or module not found

**Solutions**:
```bash
# Rebuild with fresh dependencies
rm -rf .next node_modules
npm install
npm run build
```

## Advanced Configuration

### Adjust Cache Duration

In `app/api/cached/*/route.ts`:

```typescript
// Shorter cache for more frequent updates
export const revalidate = 300; // 5 minutes

// Longer cache for static data
export const revalidate = 3600; // 1 hour
```

### Custom Aggregation

Create custom aggregates in `lib/firebase/aggregates.ts`:

```typescript
export async function buildCustomSummary() {
  // Your custom aggregation logic
  const data = await adminDb.collection('your-collection').get();
  // Process and return
  return processedData;
}
```

## Support

For issues or questions:
1. Check Firebase Console for read metrics
2. Review Next.js build logs
3. Check Cloud Functions logs
4. Review Network tab in browser DevTools

## License

This optimization is part of the SS League project.
