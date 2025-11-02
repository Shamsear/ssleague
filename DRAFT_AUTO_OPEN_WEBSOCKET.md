# Draft Auto-Open/Close with WebSocket Live Updates

## Overview
The fantasy draft system now automatically opens and closes based on configured time windows, with real-time updates via WebSocket to all connected clients.

## Features

### 1. **Automatic Status Changes**
- **Auto-Open**: Draft changes from `pending` → `active` when `draft_opens_at` time is reached
- **Auto-Close**: Draft changes from `active` → `closed` when `draft_closes_at` time is reached

### 2. **Real-Time Updates via WebSocket**
- All connected clients receive instant notifications when draft status changes
- No page refresh needed - status updates happen live
- Works for both committee admins and team users

### 3. **Client-Side Triggers**
- Status checks happen when users visit the draft page
- Uses `setTimeout` to trigger exactly at the deadline
- Combines with WebSocket for maximum reliability

## How It Works

### Backend (API Routes)

#### 1. Manual Control
**File**: `app/api/fantasy/draft/control/route.ts`
- Committee admins can manually change draft status
- Broadcasts status changes via WebSocket to channel `league:{leagueId}:draft`

#### 2. Automatic Control
**File**: `app/api/fantasy/draft/auto-close/route.ts`
- Checks if opening time has passed and draft is `pending` → opens it
- Checks if closing time has passed and draft is `active` → closes it
- Broadcasts automatic status changes via WebSocket

### Frontend (React Hooks)

#### 1. Timer-Based Hook
**File**: `hooks/useAutoCloseDraft.ts`
- Sets up `setTimeout` to trigger at exact opening/closing times
- Calls the auto-close API endpoint when times are reached
- Provides countdown logs in console

#### 2. WebSocket Hook
**File**: `hooks/useDraftWebSocket.ts`
- Connects to WebSocket server on component mount
- Subscribes to league-specific draft channel
- Listens for `draft_status_update` messages
- Automatically reloads data when status changes

### Pages

#### Team Draft Page
**File**: `app/dashboard/team/fantasy/draft/page.tsx`
- Uses both `useAutoCloseDraft` and `useDraftWebSocket` hooks
- Receives live updates when draft status changes
- Reloads draft data automatically without page refresh

#### Committee Control Page
**File**: `app/dashboard/committee/fantasy/draft-control/[leagueId]/page.tsx`
- Uses both hooks to ensure real-time updates
- Shows current status and allows manual control
- Updates live when changes are made by any admin

## WebSocket Channels

### Channel Format
```
league:{leagueId}:draft
```

### Message Format
```json
{
  "type": "draft_status_update",
  "data": {
    "league_id": "SSPSLFLS16",
    "draft_status": "active",
    "draft_opens_at": "2025-11-02T07:00:00.000Z",
    "draft_closes_at": "2025-11-02T07:05:00.000Z",
    "auto_opened": true
  },
  "timestamp": 1730532000000
}
```

## Setup & Configuration

### 1. Start the Servers
```bash
npm run dev
```
This starts both:
- Next.js server on `http://localhost:3000`
- WebSocket server on `ws://localhost:3001/api/ws`

### 2. Set Draft Times
1. Go to Committee Draft Control page
2. Set "Opens At" and "Closes At" times in IST
3. Click "Update Draft Settings"

### 3. Test Auto-Open/Close
- Set times a few minutes in the future
- Keep the draft page open
- Watch the console logs for countdown timers
- Status will update automatically at the exact time

## Timezone Handling

- All times are stored in **UTC** in the database
- UI displays times in **IST (Indian Standard Time)**
- `datetime-local` inputs automatically handle timezone conversion
- Server uses UTC timestamps for consistency

## Console Logs

### Timer Logs
```
⏰ Draft will auto-open in 300 seconds
⏰ Draft opening time reached, checking status...
```

### WebSocket Logs
```
📡 Subscribed to WebSocket channel: league:SSPSLFLS16:draft
🔔 Draft status update received: { league_id: '...', draft_status: 'active' }
```

### API Logs
```
✅ Draft auto-opened for league SSPSLFLS16 at 2025-11-02T07:00:00.000Z
📢 Broadcast auto-open to league:SSPSLFLS16:draft
```

## Benefits

1. **No Manual Intervention**: Draft opens/closes automatically at scheduled times
2. **Real-Time Updates**: All users see changes instantly without refreshing
3. **Reliable**: Combines client-side timers with server-side checks
4. **Scalable**: WebSocket server handles multiple leagues simultaneously
5. **User-Friendly**: Clear status indicators and countdown timers

## Testing Checklist

- [ ] Set draft to open in 2 minutes
- [ ] Keep draft page open
- [ ] Verify status changes from "Pending" to "Active" automatically
- [ ] Check that WebSocket receives the update
- [ ] Verify other connected clients also receive the update
- [ ] Test closing time as well
- [ ] Test manual status changes from committee control page
- [ ] Verify that manual changes also broadcast via WebSocket

## Troubleshooting

### WebSocket Not Connecting
- Check that `npm run dev` is running both servers
- Check WebSocket server logs for connection attempts
- Verify `WS_PORT` is not blocked (default: 3001)

### Status Not Changing Automatically
- Check browser console for timer logs
- Verify times are set correctly in UTC
- Check API endpoint logs for errors
- Ensure user has the page open (timers only run on active pages)

### Updates Not Live
- Check WebSocket connection status in browser console
- Verify subscription to correct channel
- Check server logs for broadcast messages
- Try refreshing the page to reconnect WebSocket
