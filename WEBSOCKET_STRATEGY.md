# WebSocket Real-Time Update Strategy

## Current Implementation Status

### ✅ Already Using WebSocket
1. **Bulk Tiebreaker Page** (`team/bulk-tiebreaker/[id]/page.tsx`)
   - Channel: `tiebreaker:{id}`
   - Updates: Bid updates, winner announcements
   - Status: ✅ Fixed and optimized

2. **Bulk Auction Round** (`team/bulk-round/[id]/page.tsx`)
   - Channel: `round:{id}`
   - Updates: Bid additions/removals, round status changes
   - Status: ✅ Working with `useAuctionWebSocket`

3. **Regular Auction Round** (`team/round/[id]/page.tsx`)
   - Channel: `round:{id}`
   - Updates: Bid updates, round status
   - Status: ✅ Working with React Query + WebSocket

---

## 🎯 High-Priority Pages for WebSocket Implementation

### 1. Team Dashboard (CRITICAL)
**File**: `app/dashboard/team/RegisteredTeamDashboard.tsx`
**Current**: Uses polling with `setInterval` every 5 seconds
**Needs**:
- Wallet balance updates when bids placed/players won
- Active rounds list (when new rounds start)
- Squad status changes
- Real-time tiebreaker notifications

**Proposed Channel**: `team:{teamId}`
**Message Types**:
```typescript
{
  type: 'wallet_update',
  data: { balance: number, change: number }
}
{
  type: 'squad_update',
  data: { current: number, max: number }
}
{
  type: 'new_round',
  data: { round_id: string, type: 'bulk' | 'regular' }
}
{
  type: 'tiebreaker_created',
  data: { tiebreaker_id: string, player_name: string }
}
```

---

### 2. Committee Bulk Round Management
**File**: `app/dashboard/committee/bulk-rounds/[id]/page.tsx`
**Current**: Uses polling with `setInterval`
**Needs**:
- Real-time bid count updates
- Team participation tracking
- Timer synchronization across all committee members

**Proposed Channel**: `admin:bulk_round:{id}`
**Message Types**:
```typescript
{
  type: 'team_bid_update',
  data: { team_id: string, bid_count: number }
}
{
  type: 'round_extended',
  data: { new_end_time: string }
}
```

---

### 3. Committee Rounds Dashboard
**File**: `app/dashboard/committee/rounds/page.tsx`
**Current**: Uses polling
**Needs**:
- Round creation notifications
- Round status changes (started, completed)
- Live participant counts

**Proposed Channel**: `admin:rounds`

---

### 4. Regular Tiebreaker (Old System)
**File**: `app/dashboard/team/tiebreaker/[id]/page.tsx`
**Current**: Uses polling
**Needs**: Same as bulk tiebreaker - real-time bid updates

---

### 5. Live Fixture/Match Updates
**File**: `app/dashboard/team/fixture/[fixtureId]/page.tsx`
**Current**: Polling for scores
**Needs**: Real-time score updates, goal notifications

**Proposed Channel**: `fixture:{fixtureId}`

---

## 📋 Broadcast Helper Utility

### Create: `lib/websocket/broadcast.ts`
```typescript
/**
 * Broadcast helper for API routes to send WebSocket messages
 */
export async function broadcastWebSocket(channel: string, data: any) {
  try {
    const wsPort = process.env.WS_PORT || 3001;
    const response = await fetch(`http://localhost:${wsPort}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, data }),
    });
    
    if (!response.ok) {
      throw new Error(`Broadcast failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
    // Don't throw - failing broadcast shouldn't break API requests
    return { success: false, error };
  }
}
```

---

## 🔧 Implementation Priority

### Phase 1: Core Auction Features (DONE ✅)
- [x] Bulk tiebreaker real-time bids
- [x] Bulk auction round bid updates
- [x] Regular auction round bid updates

### Phase 2: Dashboard Real-Time (HIGH PRIORITY)
- [ ] Team dashboard wallet/balance updates
- [ ] Committee bulk round management
- [ ] Active rounds notifications

### Phase 3: Secondary Features (MEDIUM)
- [ ] Regular tiebreaker updates
- [ ] Committee rounds dashboard
- [ ] Round creation notifications

### Phase 4: Nice-to-Have (LOW)
- [ ] Live fixture score updates
- [ ] Fantasy draft live updates
- [ ] Tournament bracket live updates

---

## 📡 WebSocket Channels Map

| Channel Pattern | Page(s) | Purpose |
|----------------|---------|---------|
| `tiebreaker:{id}` | Bulk & Regular Tiebreaker | Live bid updates |
| `round:{id}` | Bulk & Regular Auction | Bid updates, status |
| `team:{teamId}` | Team Dashboard | Wallet, squad, notifications |
| `admin:bulk_round:{id}` | Committee Bulk Round Mgmt | Admin-only stats |
| `admin:rounds` | Committee Rounds Dashboard | Round list updates |
| `fixture:{id}` | Live Fixtures | Score updates |
| `draft:{leagueId}` | Fantasy Draft | Pick updates |

---

## 🚀 Benefits

### Performance
- **Eliminates polling**: Saves 80%+ server requests
- **Instant updates**: <100ms latency vs 5-second polling
- **Reduced server load**: Push vs pull architecture

### User Experience  
- **Real-time competition**: See other teams' bids instantly
- **No page refreshes**: Smooth, app-like experience
- **Live notifications**: Instant alerts for important events

### Scalability
- **Better resource usage**: One WebSocket vs many HTTP polls
- **Handles concurrent users**: Efficient broadcast to all clients
- **Lower bandwidth**: Smaller message payloads

---

## ⚠️ Important Notes

1. **Server Setup**: WebSocket server must run alongside Next.js (`npm run dev` starts both)
2. **HTTP Bridge**: API routes use HTTP POST to `/broadcast` endpoint (cross-process communication)
3. **Fallback**: If WebSocket fails, pages should fall back to polling
4. **Security**: Consider adding auth token validation for WebSocket connections
5. **Production**: For Vercel deployment, consider using:
   - Pusher (easier, costs money)
   - Ably (free tier available)
   - Socket.io with separate server
   - Server-Sent Events (SSE) as alternative
