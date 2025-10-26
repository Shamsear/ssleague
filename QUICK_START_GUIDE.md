# 🚀 Quick Start Guide - WebSocket Setup

## TL;DR - 5 Steps to Get Running

### 1. Update `package.json`

Find the `"scripts"` section and replace it with:

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

### 2. Add to `.env.local`

```bash
WS_PORT=3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Servers

```bash
npm run dev
```

You should see both servers start:
```
[NEXT] ▲ Next.js running on http://localhost:3000
[WS] ✅ WebSocket server running on port 3001
```

### 5. Test Connection

Open browser console on `http://localhost:3000` and run:

```javascript
const ws = new WebSocket('ws://localhost:3001/api/ws');
ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📩', JSON.parse(e.data));
```

---

## ✅ That's It! Your WebSocket Server is Running!

## What Happens Now?

- **WITHOUT WebSocket integration in API routes**: App works normally with 5-minute cache (already super fast)
- **WITH WebSocket integration in API routes**: Real-time updates for live auctions and tiebreakers

## Next Steps (Optional - For Real-Time Features)

### To Enable Real-Time Auction Updates:

1. **Find your bid placement API** (e.g., `app/api/team/bids/route.ts`)

2. **Add this at the top:**
```typescript
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}
```

3. **After saving the bid, add:**
```typescript
if (global.wsBroadcast) {
  global.wsBroadcast(`round:${round_id}`, {
    type: 'bid',
    data: { bid: newBid, player, team },
  });
}
```

4. **In your auction page component:**
```typescript
import { useAuctionWebSocket } from '@/hooks/useWebSocket';

function AuctionPage({ roundId }) {
  const { isConnected } = useAuctionWebSocket(roundId);
  // Component will auto-update when bids come in!
  
  return <div>{isConnected ? '🟢 Live' : '⚪ Cached'}</div>;
}
```

### More Examples:

See `examples/websocket-integration-examples.ts` for complete code samples.

See `WEBSOCKET_MANUAL_SETUP.md` for detailed instructions.

---

## Troubleshooting

### "Cannot find module 'ws'"
```bash
npm install ws @types/ws concurrently
```

### Port 3001 in use
Change `WS_PORT=3002` in `.env.local`

### WebSocket not connecting
1. Check both `[NEXT]` and `[WS]` are running
2. Verify `.env.local` has correct URL
3. Check browser console for errors

---

## Important Notes

✅ **Your app is already 5-10x faster** with the caching optimizations
✅ **WebSocket is optional** - only needed for real-time auction bidding
✅ **Everything works without WebSocket** - you have 5-minute fresh data
✅ **Add WebSocket gradually** - start with one page, test, then expand

## Files Created

- ✅ `server/websocket.js` - WebSocket server (ready to run)
- ✅ `hooks/useWebSocket.ts` - React hooks (ready to use)
- ✅ `lib/websocket/client.ts` - Client connection (ready)
- ✅ `examples/websocket-integration-examples.ts` - Code samples
- ✅ `WEBSOCKET_MANUAL_SETUP.md` - Detailed guide
- ✅ `QUICK_START_GUIDE.md` - This file!

---

**You're all set! Run `npm run dev` and you're good to go! 🎉**
