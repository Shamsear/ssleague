# Pusher Setup Guide - Real-Time Updates

## Overview

Your WebSocket system has been configured to use **Pusher** - a production-ready, scalable real-time messaging service. All your existing hooks and code remain unchanged; we've just swapped the backend transport layer.

---

## Why Pusher?

✅ **Production-Ready** - No server setup required  
✅ **Auto-Scaling** - Handles traffic spikes automatically  
✅ **Global CDN** - Low latency worldwide  
✅ **Built-in Reconnection** - Handles network issues  
✅ **Free Tier** - 200k messages/day, 100 concurrent connections  
✅ **Easy Deployment** - No infrastructure to manage  

---

## Step 1: Install Pusher

```bash
npm install pusher pusher-js
# or
yarn add pusher pusher-js
```

---

## Step 2: Get Pusher Credentials

1. **Sign up** at [pusher.com](https://pusher.com)
2. **Create a new Channels app**
3. **Copy your credentials** from the "App Keys" tab:
   - App ID
   - Key (Public)
   - Secret (Private)
   - Cluster (e.g., `us2`, `eu`, `ap1`)

---

## Step 3: Configure Environment Variables

Add to `.env.local`:

```bash
# Pusher Configuration
PUSHER_APP_ID=your_app_id
NEXT_PUBLIC_PUSHER_KEY=your_public_key
PUSHER_SECRET=your_secret_key
NEXT_PUBLIC_PUSHER_CLUSTER=us2  # or your cluster

# Note: NEXT_PUBLIC_* variables are exposed to the browser
# PUSHER_SECRET must be kept server-side only!
```

---

## Step 4: Update package.json (Optional)

Add Pusher types for better TypeScript support:

```bash
npm install --save-dev @types/pusher @types/pusher-js
# or
yarn add -D @types/pusher @types/pusher-js
```

---

## Step 5: Test the Setup

### Frontend Test (Browser Console):

```typescript
// Your existing hooks work without changes!
import { useDashboardWebSocket } from '@/hooks/useWebSocket';

const { isConnected } = useDashboardWebSocket('SSPSLT0001', true);
console.log('Connected:', isConnected); // Should be true
```

### Backend Test (API Route):

```typescript
import { broadcastTeamUpdatePusher } from '@/lib/websocket/pusher-broadcast';

// Test broadcast
await broadcastTeamUpdatePusher('SSPSLT0001', 'wallet', {
  new_balance: 50000,
  amount_spent: 10000,
  currency_type: 'football',
});
```

---

## Architecture

### Frontend (Browser):
```
Component → useDashboardWebSocket → Pusher Client → Pusher Servers → Event Received → Cache Invalidated
```

### Backend (Server):
```
API Route → broadcastTeamUpdatePusher → Pusher Server SDK → Pusher Servers → All Subscribers Notified
```

---

## Channels & Events

### Team Channel: `team:{teamId}`
Events:
- `squad_update` - Player acquired/removed
- `wallet_update` - Budget changed
- `new_round` - New auction round
- `tiebreaker_created` - Tiebreaker created

### Tiebreaker Channel: `tiebreaker:{tiebreakerId}`
Events:
- `tiebreaker_bid` - New bid submitted
- `tiebreaker_finalized` - Tiebreaker resolved

### Round Channel: `round:{roundId}`
Events:
- `bid` - Bid placed
- `player_sold` - Player sold
- `round_status` - Status changed
- `round_update` - General update

---

## Code Changes Summary

### ✅ No Changes Required:
- All React hooks (`useDashboardWebSocket`, etc.) - **work as-is**
- All frontend components - **no changes needed**
- Cache invalidation logic - **unchanged**
- Event types and data structures - **same**

### ✅ What Changed (Automatic):
- WebSocket client uses Pusher instead of raw WebSocket
- Backend broadcasts use Pusher REST API
- Connection management handled by Pusher

---

## Migration From Custom WebSocket (If Needed)

If you had a custom WebSocket server, you can remove it:

### Remove (if exists):
- `server.js` or `ws-server.js`
- WebSocket server process in `package.json` scripts
- Any WebSocket server deployment config

### Keep:
- All hooks in `hooks/useWebSocket.ts`
- All broadcast calls in API routes
- All frontend components

---

## Testing Checklist

- [ ] Install Pusher packages (`pusher`, `pusher-js`)
- [ ] Add environment variables to `.env.local`
- [ ] Restart Next.js dev server
- [ ] Check browser console for "[Pusher] Connected successfully"
- [ ] Test a broadcast (e.g., finalize a round)
- [ ] Verify frontend receives event
- [ ] Check cache invalidation works
- [ ] Monitor Pusher dashboard for message count

---

## Monitoring & Debugging

### Pusher Dashboard:
1. Go to [dashboard.pusher.com](https://dashboard.pusher.com)
2. Select your app
3. View real-time message logs
4. Monitor connection counts
5. Check for errors

### Browser DevTools:
```typescript
// Enable Pusher logging (development only)
Pusher.logToConsole = true;

// Check connection
const { isConnected } = useDashboardWebSocket(teamId, true);
console.log('Pusher connected:', isConnected);
```

### Backend Logs:
```
📢 [Pusher] Broadcast to team:SSPSLT0001: squad_update
📢 [Pusher] Broadcast to tiebreaker:TB123: tiebreaker_bid
```

---

## Pusher Free Tier Limits

- **200,000 messages/day** - More than enough for most apps
- **100 concurrent connections** - ~100 active users
- **Unlimited channels** - Create as many as needed
- **10GB data transfer/month**

### Upgrade When:
- >100 concurrent users
- >200k messages/day
- Need SSL on custom domain
- Want message encryption

---

## Performance

### Latency:
- **Pusher**: <100ms average
- **Custom WebSocket**: 50-200ms (depends on hosting)

### Scalability:
- **Pusher**: Auto-scales to millions
- **Custom WebSocket**: Requires load balancer + Redis

### Reliability:
- **Pusher**: 99.999% uptime SLA
- **Custom WebSocket**: Depends on your infrastructure

---

## Security

### Public Channels (Current Setup):
- No authentication required
- Anyone can subscribe
- Fine for non-sensitive data (public auction updates)

### Private Channels (If Needed):
```typescript
// Use private- prefix
const channel = pusher.subscribe('private-team:SSPSLT0001');

// Requires auth endpoint:
// /api/pusher/auth
```

### Presence Channels (If Needed):
```typescript
// See who else is online
const channel = pusher.subscribe('presence-auction:round123');
```

---

## Cost Estimate

### Free Tier Usage (Typical):
- 100 concurrent users
- 50 events/min × 60 min × 24 hr = **72,000 messages/day**
- **Well within free tier** ✅

### Paid Plans (If Needed):
- **Startup**: $49/month (500 connections, 20M messages)
- **Professional**: $299/month (2000 connections, 100M messages)

---

## Troubleshooting

### Issue: "Pusher credentials not configured"

**Solution**: Add env variables to `.env.local` and restart dev server

### Issue: Events not received on frontend

**Check**:
1. Browser console: "[Pusher] Connected successfully"?
2. Pusher dashboard: Are messages being sent?
3. Channel name matches: `team:${teamId}` (no typos)
4. Event name matches: `squad_update`, `wallet_update`, etc.

### Issue: Backend broadcast fails

**Check**:
1. `PUSHER_SECRET` set in `.env.local`?
2. Check server logs for error details
3. Verify credentials on Pusher dashboard

---

## Rollback Plan (If Needed)

If you need to rollback to custom WebSocket:

1. **Revert imports**:
   ```typescript
   // Change from:
   import { getPusherClient } from '@/lib/websocket/pusher-client';
   
   // Back to:
   import { getWSClient } from '@/lib/websocket/client';
   ```

2. **Revert backend**:
   ```typescript
   // Change from:
   import { broadcastTeamUpdatePusher } from '@/lib/websocket/pusher-broadcast';
   
   // Back to:
   import { broadcastTeamUpdate } from '@/lib/websocket/broadcast';
   ```

3. **Restart WebSocket server** (if you had one)

---

## Summary

✅ **Pusher is configured** - Backend broadcasts use Pusher  
✅ **Hooks work unchanged** - No frontend code changes needed  
✅ **Production-ready** - Scales automatically, handles reconnection  
✅ **Free tier available** - 200k messages/day  
✅ **Easy monitoring** - Dashboard shows real-time metrics  

All you need to do:
1. Install `pusher` and `pusher-js`
2. Add credentials to `.env.local`
3. Restart dev server
4. Done! 🎉

---

## Next Steps

1. **Install Pusher**: `npm install pusher pusher-js`
2. **Add credentials** to `.env.local`
3. **Test connection** (check browser console)
4. **Monitor dashboard** ([dashboard.pusher.com](https://dashboard.pusher.com))
5. **Deploy** - same env vars in production

---

## Support

- **Pusher Docs**: [pusher.com/docs](https://pusher.com/docs)
- **Pusher Support**: [support.pusher.com](https://support.pusher.com)
- **Your Code**: All documented in `WEBSOCKET_FRONTEND_IMPLEMENTATION.md`
