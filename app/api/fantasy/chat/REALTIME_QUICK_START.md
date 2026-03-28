# Fantasy Chat Real-time - Quick Start Guide

## 🚀 Quick Start

### 1. Backend: Send a Message with Real-time Sync

```typescript
// The API automatically syncs to Firebase
const response = await fetch('/api/fantasy/chat/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    league_id: 'league_1',
    team_id: 'team_1',
    user_id: 'user_1',
    message_text: 'Hello everyone!'
  })
});

// Message is now in PostgreSQL AND Firebase
// All connected clients receive instant update
```

### 2. Frontend: Subscribe to Real-time Updates

```typescript
import { useFantasyChat } from '@/hooks/useFantasyChatRealtime';

function MyChatComponent() {
  const {
    messages,        // Array of messages
    isConnected,     // Firebase connection status
    sendMessage,     // Function to send message
    loadMore,        // Load older messages
    hasMore          // More messages available?
  } = useFantasyChat({
    leagueId: 'league_1',
    enabled: true
  });

  return (
    <div>
      {/* Connection indicator */}
      {isConnected ? '🟢 Live' : '🔴 Offline'}
      
      {/* Messages */}
      {messages.map(msg => (
        <div key={msg.message_id}>
          {msg.message_text}
        </div>
      ))}
      
      {/* Send message */}
      <button onClick={() => sendMessage('Hi!', 'team_1', 'user_1')}>
        Send
      </button>
    </div>
  );
}
```

### 3. Manual Firebase Operations (Advanced)

```typescript
import {
  syncMessageToFirebase,
  subscribeToNewMessages,
  updateMessageReactions
} from '@/lib/fantasy/chat-realtime';

// Sync a message
await syncMessageToFirebase({
  message_id: 'msg_123',
  league_id: 'league_1',
  team_id: 'team_1',
  team_name: 'Team Name',
  user_id: 'user_1',
  message_text: 'Hello!',
  reactions: {},
  is_deleted: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Subscribe to new messages
const unsubscribe = subscribeToNewMessages('league_1', (message) => {
  console.log('New message:', message);
  // Show notification, play sound, etc.
});

// Cleanup
unsubscribe();
```

## 📦 What's Included

### Files
- `lib/fantasy/chat-realtime.ts` - Core real-time module
- `hooks/useFantasyChatRealtime.ts` - React hooks
- `components/fantasy/ChatRealtimeExample.tsx` - Example component
- `app/api/fantasy/chat/REALTIME_DOCUMENTATION.md` - Full docs

### APIs (Auto-sync to Firebase)
- `POST /api/fantasy/chat/send` - Send message
- `DELETE /api/fantasy/chat/delete` - Delete message
- `POST /api/fantasy/chat/reactions` - Add/remove reaction

### Tests
- 20 unit tests (all passing ✅)
- 7 integration tests (all passing ✅)

## 🎯 Key Concepts

### 1. Dual Storage
- **PostgreSQL**: Source of truth, complete history
- **Firebase**: Real-time sync, last 100 messages

### 2. Write Flow
```
Client → API → PostgreSQL (write) → Firebase (sync) → All Clients (update)
```

### 3. Read Flow
```
Client → PostgreSQL (initial load) + Firebase (real-time updates)
```

### 4. Graceful Degradation
- Firebase fails? PostgreSQL still works ✅
- Connection lost? Auto-reconnect ✅
- No data loss ever ✅

## 🔧 Configuration

### Environment Variables
Already configured in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your-database-url
```

### Firebase Rules (Optional)
```json
{
  "rules": {
    "fantasy_chat": {
      "$league_id": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

## 🐛 Troubleshooting

### Messages not appearing in real-time?
1. Check `isConnected` state
2. Verify Firebase config in `.env.local`
3. Check browser console for errors

### Firebase sync failing?
- Don't worry! PostgreSQL is source of truth
- Messages still saved and retrievable
- Check server logs for details

### Performance issues?
- Run cleanup: `cleanupOldMessages('league_1', 100)`
- Check PostgreSQL indexes
- Monitor Firebase usage

## 📚 Learn More

- Full documentation: `REALTIME_DOCUMENTATION.md`
- Example component: `components/fantasy/ChatRealtimeExample.tsx`
- Tests: `lib/fantasy/chat-realtime.test.ts`

## 🎉 That's It!

You now have real-time chat with:
- ✅ Instant updates
- ✅ No polling
- ✅ Graceful degradation
- ✅ Complete history
- ✅ Auto-cleanup

Happy coding! 🚀
