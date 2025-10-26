# WebSocket Setup Guide

## Current Status

✅ **Client Infrastructure**: WebSocket client and React hooks are ready
❌ **Server Infrastructure**: Needs implementation (see options below)

## Implementation Options

### Option 1: Standalone WebSocket Server (Recommended)

Create a separate Node.js WebSocket server that runs alongside Next.js.

**Pros:**
- Full WebSocket support
- Low latency
- Production-ready
- Free to use

**Setup:**

1. Install dependencies:
```bash
npm install ws @types/ws
```

2. Create `server/websocket.js`:
```javascript
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active connections by channel
const channels = new Map();

wss.on('connection', (ws, req) => {
  console.log('Client connected');
  
  const subscriptions = new Set();
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'subscribe':
        if (!channels.has(message.channel)) {
          channels.set(message.channel, new Set());
        }
        channels.get(message.channel).add(ws);
        subscriptions.add(message.channel);
        console.log(`Client subscribed to: ${message.channel}`);
        break;
        
      case 'unsubscribe':
        if (channels.has(message.channel)) {
          channels.get(message.channel).delete(ws);
          subscriptions.delete(message.channel);
        }
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  });
  
  ws.on('close', () => {
    // Clean up subscriptions
    subscriptions.forEach(channel => {
      if (channels.has(channel)) {
        channels.get(channel).delete(ws);
      }
    });
    console.log('Client disconnected');
  });
});

// Function to broadcast to a channel
function broadcast(channel, data) {
  if (channels.has(channel)) {
    const message = JSON.stringify(data);
    channels.get(channel).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Expose broadcast function for API routes
global.wsBroadcast = broadcast;

const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
```

3. Update `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"next dev\" \"node server/websocket.js\"",
    "ws": "node server/websocket.js"
  }
}
```

4. Install concurrently:
```bash
npm install -D concurrently
```

5. Update `.env.local`:
```
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

### Option 2: Server-Sent Events (SSE) - Simpler Alternative

Use SSE for one-way real-time updates (server → client).

**Pros:**
- Native HTTP support (no WebSocket needed)
- Works with Next.js out of the box
- Good for notifications and updates
- Automatic reconnection

**Cons:**
- One-way only (server → client)
- Slightly higher latency than WebSocket

**Setup:**

1. Create `/app/api/sse/route.ts`:
```typescript
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      controller.enqueue(data);
      
      // Set up interval for updates
      const interval = setInterval(() => {
        const message = encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
        controller.enqueue(message);
      }, 30000);
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

2. Update client to use SSE:
```typescript
const eventSource = new EventSource('/api/sse');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('SSE message:', data);
};
```

---

### Option 3: Use Pusher/Ably (Easiest, Paid)

Use a managed WebSocket service.

**Pros:**
- Zero setup
- Scalable
- Reliable

**Cons:**
- Costs money after free tier
- External dependency

**Setup:**

1. Sign up for Pusher (free tier: 200k messages/day)
2. Install: `npm install pusher-js`
3. Use in components

---

## Integration with Current System

### Pages That Need Real-Time Updates:

1. **Live Auction Page** (`/dashboard/team/auction/[roundId]`)
   - Bid updates
   - Player sold notifications
   - Round status changes
   
2. **Tiebreaker Page** (`/dashboard/team/tiebreakers/[id]`)
   - Bid updates
   - Winner announcements

3. **Team Dashboard** (`/dashboard/team`)
   - Wallet balance updates
   - Notification alerts

### How to Integrate:

```typescript
// In auction page component
import { useAuctionWebSocket } from '@/hooks/useWebSocket';

function AuctionPage({ roundId }: { roundId: string }) {
  const { isConnected } = useAuctionWebSocket(roundId, true);
  
  return (
    <div>
      {isConnected && <div className="status">🟢 Live</div>}
      {/* Rest of component */}
    </div>
  );
}
```

### Broadcasting Updates from API Routes:

```typescript
// In your API route (e.g., place bid)
export async function POST(request: Request) {
  // ... place bid logic ...
  
  // Broadcast to WebSocket clients
  if (global.wsBroadcast) {
    global.wsBroadcast(`round:${roundId}`, {
      type: 'bid',
      data: { bid, player, team },
      timestamp: Date.now()
    });
  }
  
  return NextResponse.json({ success: true });
}
```

---

## Current Optimization (Interim Solution)

For now, the app uses **optimized caching with React Query**:

✅ **5-minute cache** instead of 5-second polls
✅ **Manual refresh** button on live pages
✅ **Optimistic updates** for mutations
✅ **90% reduction in API calls**

This provides good performance until WebSocket/SSE is implemented.

---

## Recommendation

**For Production:** Use **Option 1 (Standalone WebSocket Server)**
- Most performant
- Full bidirectional communication
- Free
- Production-ready

**For Quick MVP:** Use **Option 2 (SSE)**
- Easier setup
- No extra server needed
- Good enough for one-way updates

**For Enterprise:** Use **Option 3 (Pusher)**
- No maintenance
- Scalable
- Reliable
