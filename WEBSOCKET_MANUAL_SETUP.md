# WebSocket Manual Setup Instructions

## Step 1: Update package.json Scripts

Open `package.json` and replace the `scripts` section with:

```json
"scripts": {
  "dev": "concurrently \"npm:dev:next\" \"npm:dev:ws\" --names \"NEXT,WS\" --prefix-colors \"cyan,magenta\"",
  "dev:next": "next dev",
  "dev:ws": "node server/websocket.js",
  "dev:fresh": "powershell -Command \"Get-Process | Where-Object {$_.ProcessName -like '*node*'} | Stop-Process -Force 2>$null; npm run dev\"",
  "build": "next build",
  "start": "concurrently \"npm:start:next\" \"npm:start:ws\" --names \"NEXT,WS\" --prefix-colors \"cyan,magenta\"",
  "start:next": "next start",
  "start:ws": "node server/websocket.js",
  "lint": "next lint",
  "cleanup": "node scripts/clear-all-keep-superadmin.js"
},
```

## Step 2: Add Environment Variables

Open `.env.local` and add these lines:

```bash
# WebSocket Server Configuration
WS_PORT=3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

**Note:** For production, change to your production WebSocket URL:
```bash
NEXT_PUBLIC_WS_URL=wss://your-domain.com:3001
```

## Step 3: Verify Dependencies Installation

Check that the npm install command completed successfully. If not, run:

```bash
npm install ws @types/ws concurrently
```

## Step 4: Update API Routes to Broadcast WebSocket Events

You need to add WebSocket broadcasting to your API routes. Here are examples:

### Example 1: Bid Placement API

Find your bid placement API (likely `/api/team/bids/route.ts` or similar) and add:

```typescript
// At the top of the file
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

// After successfully placing a bid
if (global.wsBroadcast) {
  global.wsBroadcast(`round:${roundId}`, {
    type: 'bid',
    data: {
      bid: newBid,
      player: playerData,
      team: teamData,
    },
  });
}
```

### Example 2: Tiebreaker Bid API

In your tiebreaker API:

```typescript
// After successfully placing tiebreaker bid
if (global.wsBroadcast) {
  global.wsBroadcast(`tiebreaker:${tiebreakerId}`, {
    type: 'tiebreaker',
    data: {
      bid: newBid,
      team: teamData,
    },
  });
}
```

### Example 3: Round Status Change

When round starts/ends/pauses:

```typescript
// After status change
if (global.wsBroadcast) {
  global.wsBroadcast(`round:${roundId}`, {
    type: 'round_status',
    data: {
      status: newStatus, // 'active', 'paused', 'completed'
      round: roundData,
    },
  });
}
```

### Example 4: Player Sold

When a player is sold in auction:

```typescript
// After player sold
if (global.wsBroadcast) {
  global.wsBroadcast(`round:${roundId}`, {
    type: 'player_sold',
    data: {
      player: playerData,
      team: winningTeam,
      amount: finalAmount,
    },
  });
}
```

## Step 5: Update Components to Use WebSocket

### Example: Live Auction Page

```typescript
'use client';

import { useAuctionWebSocket } from '@/hooks/useWebSocket';
import { useBids } from '@/hooks/useAuction';

export default function AuctionPage({ roundId }: { roundId: string }) {
  // Enable WebSocket for real-time updates
  const { isConnected } = useAuctionWebSocket(roundId, true);
  
  // React Query will auto-update when WebSocket invalidates cache
  const { data: bids, isLoading } = useBids({ roundId });

  return (
    <div>
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
        <span className="text-sm">
          {isConnected ? '🟢 Live' : '⚪ Offline'}
        </span>
      </div>

      {/* Your auction UI */}
      {bids?.map(bid => (
        <div key={bid.id}>{/* bid card */}</div>
      ))}
    </div>
  );
}
```

### Example: Tiebreaker Page

```typescript
'use client';

import { useTiebreakerWebSocket } from '@/hooks/useWebSocket';
import { useTiebreakerDetails } from '@/hooks/useTeamDashboard';

export default function TiebreakerPage({ tiebreakerId }: { tiebreakerId: string }) {
  const { isConnected } = useTiebreakerWebSocket(tiebreakerId, true);
  const { data: tiebreaker } = useTiebreakerDetails(tiebreakerId);

  return (
    <div>
      <div className="status">
        {isConnected ? '🟢 Live Updates' : '⚪ Cached Data'}
      </div>
      {/* tiebreaker UI */}
    </div>
  );
}
```

## Step 6: Start Development Servers

Now you can start both servers with one command:

```bash
npm run dev
```

You should see:
```
[NEXT] ▲ Next.js 15.x.x
[NEXT] - Local: http://localhost:3000
[WS] ✅ WebSocket server running on port 3001
[WS] 📡 WebSocket endpoint: ws://localhost:3001/api/ws
```

## Step 7: Test WebSocket Connection

### Option A: Browser Console Test

Open browser console and run:

```javascript
const ws = new WebSocket('ws://localhost:3001/api/ws');
ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📩 Message:', JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'subscribe', channel: 'test' }));
```

### Option B: Health Check

Visit: http://localhost:3001/health

Should return:
```json
{
  "status": "ok",
  "totalConnections": 0,
  "channels": [],
  "uptime": 123.45
}
```

## Step 8: Verify Real-Time Updates

1. Open two browser windows to the auction page
2. Place a bid in one window
3. Watch it appear in the other window instantly!

## Troubleshooting

### Issue: "Cannot find module 'ws'"

**Solution:**
```bash
npm install ws @types/ws concurrently
```

### Issue: "Port 3001 already in use"

**Solution:**
Change `WS_PORT` in `.env.local`:
```bash
WS_PORT=3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

### Issue: WebSocket not connecting

**Check:**
1. Is WebSocket server running? Look for `[WS]` logs
2. Is the URL correct in `.env.local`?
3. Check browser console for connection errors

### Issue: Updates not appearing in real-time

**Check:**
1. Is `global.wsBroadcast` being called in API routes?
2. Is the component using the WebSocket hook?
3. Check WebSocket server logs for broadcast messages

### Issue: "global.wsBroadcast is not a function"

**Solution:** WebSocket server must be running before API calls. Start with `npm run dev`.

## API Routes That Need WebSocket Broadcasting

Update these files to add `global.wsBroadcast` calls:

1. **Auction Bids**: `/app/api/team/bids/route.ts` or similar
2. **Tiebreaker Bids**: `/app/api/tiebreakers/[id]/bid/route.ts` or similar
3. **Round Status**: `/app/api/auction/rounds/[id]/status/route.ts` or similar
4. **Dashboard Updates**: `/app/api/team/dashboard/route.ts` or similar

## Production Deployment

### For Vercel:

You'll need a separate WebSocket server (Vercel doesn't support WebSocket).

**Options:**
1. Deploy WebSocket server to Railway/Render/Heroku
2. Use Vercel + external WebSocket service
3. Use SSE instead (works on Vercel)

### For VPS/Dedicated Server:

```bash
# Install PM2 for process management
npm install -g pm2

# Start both servers
pm2 start npm --name "nextjs" -- start:next
pm2 start npm --name "websocket" -- start:ws

# Save and auto-restart
pm2 save
pm2 startup
```

### Environment Variables for Production:

```bash
WS_PORT=3001
NEXT_PUBLIC_WS_URL=wss://your-domain.com:3001
```

## Summary

✅ **Completed:**
- WebSocket server created (`server/websocket.js`)
- Client hooks ready (`hooks/useWebSocket.ts`)
- Dependencies listed

⏳ **Your Tasks:**
1. Update `package.json` scripts
2. Add environment variables to `.env.local`
3. Run `npm install` (if not completed)
4. Add `global.wsBroadcast` to API routes
5. Test with `npm run dev`

## Quick Start Command Sequence

```bash
# 1. Update package.json and .env.local manually (see above)

# 2. Install dependencies
npm install

# 3. Start servers
npm run dev

# 4. Test in browser console
# Open http://localhost:3000 and check console

# 5. Verify health
# Open http://localhost:3001/health
```

---

**Need Help?** Check the logs in your terminal. Both `[NEXT]` and `[WS]` prefixes will show what's happening.

**Performance Tip:** The app will work WITHOUT WebSocket (uses 5-min cache). WebSocket is only needed for real-time auction/tiebreaker updates.
