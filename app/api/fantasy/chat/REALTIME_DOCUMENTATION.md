# Fantasy Chat Real-time Updates Documentation

## Overview

The Fantasy League chat system uses a hybrid architecture combining PostgreSQL (source of truth) and Firebase Realtime Database (real-time sync layer) to provide instant message updates without polling.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (React)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useFantasyChatRealtime Hook                         │   │
│  │  - Subscribes to Firebase RT DB                      │   │
│  │  - Receives instant updates                          │   │
│  │  - Manages local state                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Firebase Realtime Database                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  fantasy_chat/{league_id}/messages/{message_id}      │   │
│  │  - Real-time sync layer                              │   │
│  │  - Keeps last 100 messages per league               │   │
│  │  - Auto-cleanup old messages                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /api/fantasy/chat/send                         │   │
│  │  1. Write to PostgreSQL                              │   │
│  │  2. Sync to Firebase RT DB                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Source of Truth)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  fantasy_chat_messages                               │   │
│  │  - Persistent storage                                │   │
│  │  - Complete message history                          │   │
│  │  - Pagination support                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Real-time Message Updates
- Messages appear instantly for all users in the league
- No polling required
- Automatic reconnection on network issues
- Optimistic UI updates

### 2. Dual Storage Strategy
- **PostgreSQL**: Source of truth, complete history, pagination
- **Firebase RT DB**: Real-time sync, last 100 messages, instant updates

### 3. Graceful Degradation
- If Firebase fails, PostgreSQL operations still succeed
- Clients can fall back to polling if real-time connection fails
- No data loss even if Firebase is unavailable

### 4. Automatic Cleanup
- Firebase keeps only last 100 messages per league
- Older messages automatically removed
- Full history always available in PostgreSQL

## Implementation

### Backend: Real-time Sync Module

**File**: `lib/fantasy/chat-realtime.ts`

```typescript
import { syncMessageToFirebase } from '@/lib/fantasy/chat-realtime';

// After saving to PostgreSQL
await syncMessageToFirebase({
  message_id: 'msg_123',
  league_id: 'league_1',
  team_id: 'team_1',
  team_name: 'Team Name',
  user_id: 'user_1',
  message_text: 'Hello!',
  reactions: {},
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
});
```

### Frontend: React Hook

**File**: `hooks/useFantasyChatRealtime.ts`

```typescript
import { useFantasyChat } from '@/hooks/useFantasyChatRealtime';

function ChatComponent({ leagueId, teamId, userId }) {
  const {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    loadMore,
    hasMore
  } = useFantasyChat({
    leagueId,
    enabled: true
  });

  const handleSend = async (text: string) => {
    await sendMessage(text, teamId, userId);
  };

  return (
    <div>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      {messages.map(msg => (
        <div key={msg.message_id}>{msg.message_text}</div>
      ))}
    </div>
  );
}
```

## API Endpoints

### Send Message
```
POST /api/fantasy/chat/send
```

**Request**:
```json
{
  "league_id": "league_1",
  "team_id": "team_1",
  "user_id": "user_1",
  "message_text": "Hello everyone!"
}
```

**Response**:
```json
{
  "success": true,
  "message": {
    "message_id": "msg_123",
    "league_id": "league_1",
    "team_id": "team_1",
    "user_id": "user_1",
    "message_text": "Hello everyone!",
    "reactions": {},
    "is_deleted": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Real-time Behavior**:
1. Message saved to PostgreSQL
2. Message synced to Firebase RT DB
3. All connected clients receive instant update
4. Sender sees optimistic update immediately

### Get Messages
```
GET /api/fantasy/chat/messages?league_id=league_1&limit=50&offset=0
```

**Response**:
```json
{
  "success": true,
  "league_id": "league_1",
  "messages": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150,
    "has_more": true
  }
}
```

**Usage**:
- Initial load: Fetch from PostgreSQL
- Real-time updates: Subscribe to Firebase
- Load more: Fetch older messages from PostgreSQL

### Delete Message
```
DELETE /api/fantasy/chat/delete
```

**Request**:
```json
{
  "message_id": "msg_123",
  "user_id": "user_1"
}
```

**Real-time Behavior**:
1. Message marked as deleted in PostgreSQL
2. Deletion synced to Firebase RT DB
3. All clients hide the message instantly

### Manage Reactions
```
POST /api/fantasy/chat/reactions
```

**Request**:
```json
{
  "message_id": "msg_123",
  "user_id": "user_1",
  "emoji": "👍",
  "action": "add"
}
```

**Real-time Behavior**:
1. Reactions updated in PostgreSQL
2. Reactions synced to Firebase RT DB
3. All clients see updated reaction counts instantly

## Firebase Realtime Database Structure

```
fantasy_chat/
  {league_id}/
    messages/
      {message_id}/
        message_id: "msg_123"
        league_id: "league_1"
        team_id: "team_1"
        team_name: "Team Name"
        user_id: "user_1"
        message_text: "Hello!"
        reactions: {
          "👍": ["user_1", "user_2"],
          "❤️": ["user_3"]
        }
        is_deleted: false
        created_at: "2024-01-01T00:00:00Z"
        updated_at: "2024-01-01T00:00:00Z"
        timestamp: 1704067200000
```

## Performance Considerations

### Message Limits
- Firebase: Last 100 messages per league
- PostgreSQL: Unlimited history
- Pagination: 50 messages per page

### Cleanup Strategy
- Automatic cleanup runs periodically
- Keeps last 100 messages in Firebase
- Full history preserved in PostgreSQL

### Connection Management
- Automatic reconnection on disconnect
- Graceful handling of network issues
- Fallback to polling if needed

## Security

### Authentication
- All API endpoints require authentication
- Team membership verified before sending
- Only message author can delete

### Authorization
- Users can only send messages for their team
- Users can only delete their own messages
- All users in league can read messages

### Data Validation
- Message length: 1-2000 characters
- Emoji validation for reactions
- XSS protection on message text

## Testing

### Unit Tests
```bash
npm test lib/fantasy/chat-realtime.test.ts
```

### Integration Tests
```bash
npm test app/api/fantasy/chat/realtime-integration.test.ts
```

### Manual Testing
1. Open chat in two browser windows
2. Send message in one window
3. Verify instant appearance in other window
4. Test reactions, deletions
5. Test offline/online scenarios

## Troubleshooting

### Messages Not Appearing in Real-time
1. Check Firebase connection status
2. Verify `isConnected` state in hook
3. Check browser console for errors
4. Verify Firebase config in `.env.local`

### Firebase Sync Failures
- Check Firebase Realtime Database rules
- Verify database URL in config
- Check network connectivity
- Review server logs for errors

### Performance Issues
- Check message count in Firebase
- Run cleanup if needed
- Verify indexes in PostgreSQL
- Monitor Firebase usage

## Best Practices

### Client-Side
1. Always check `isConnected` before showing status
2. Handle `error` state gracefully
3. Implement optimistic updates
4. Show loading states during operations

### Server-Side
1. Always write to PostgreSQL first
2. Sync to Firebase asynchronously
3. Don't fail if Firebase sync fails
4. Log Firebase errors for monitoring

### Maintenance
1. Run cleanup periodically (weekly)
2. Monitor Firebase usage
3. Check PostgreSQL query performance
4. Review error logs regularly

## Future Enhancements

- [ ] Typing indicators
- [ ] Read receipts
- [ ] Message editing
- [ ] File attachments
- [ ] @mentions
- [ ] Message threads
- [ ] Push notifications
- [ ] Message search

## References

- [Firebase Realtime Database Docs](https://firebase.google.com/docs/database)
- [React Hooks Best Practices](https://react.dev/reference/react)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
