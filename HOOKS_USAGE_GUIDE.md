# React Query Hooks Usage Guide

## Overview

Custom hooks have been created for all API operations with built-in caching, loading states, and error handling.

---

## Import Hooks

```typescript
// Import from centralized index
import { 
  useAuctionPlayers, 
  usePlaceBid,
  useFixtures,
  usePlayerStats,
  useLeaderboard
} from '@/hooks';

// Or import from specific files
import { useAuctionPlayers } from '@/hooks/useAuction';
import { useFixtures } from '@/hooks/useTournament';
import { usePlayerStats } from '@/hooks/useStats';
```

---

## Auction Hooks

### 1. useAuctionPlayers

Fetch football players for auction.

```typescript
import { useAuctionPlayers } from '@/hooks';

function AuctionPlayersPage() {
  const { data: players, isLoading, error } = useAuctionPlayers({
    seasonId: 'season1',
    isSold: false,
    position: 'FWD'
  });
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {players?.map(player => (
        <div key={player.id}>{player.name}</div>
      ))}
    </div>
  );
}
```

**Parameters:**
- `seasonId` - Filter by season
- `isAuctionEligible` - Filter eligible players
- `isSold` - Filter by sold status
- `position` - Filter by position
- `positionGroup` - Filter by position group

**Cache:** 3 minutes

---

### 2. useAuctionRounds

Fetch auction rounds.

```typescript
const { data: rounds } = useAuctionRounds({
  seasonId: 'season1',
  status: 'active'
});
```

**Cache:** 2 minutes

---

### 3. usePlaceBid

Place a bid (mutation).

```typescript
function BidButton({ playerId, roundId, teamId }: Props) {
  const placeBid = usePlaceBid();
  
  const handleBid = () => {
    placeBid.mutate({
      team_id: teamId,
      player_id: playerId,
      round_id: roundId,
      amount: 50
    }, {
      onSuccess: () => {
        alert('Bid placed successfully!');
      },
      onError: (error) => {
        alert(`Error: ${error.message}`);
      }
    });
  };
  
  return (
    <button 
      onClick={handleBid}
      disabled={placeBid.isPending}
    >
      {placeBid.isPending ? 'Placing bid...' : 'Place Bid'}
    </button>
  );
}
```

**Auto-invalidates:** auction-players, bids queries

---

### 4. useBids

Fetch bids (real-time polling for active rounds).

```typescript
const { data: bids } = useBids({
  roundId: 'round_uuid' // Enables auto-polling every 10s
});
```

**Cache:** 10 seconds
**Auto-polling:** Every 10s when `roundId` provided

---

## Tournament Hooks

### 5. useFixtures

Fetch match fixtures.

```typescript
import { useFixtures } from '@/hooks';

function FixturesPage() {
  const { data: fixtures, isLoading } = useFixtures({
    seasonId: 'season1',
    status: 'scheduled',
    roundNumber: 1
  });
  
  return (
    <div>
      {fixtures?.map(fixture => (
        <div key={fixture.id}>
          {fixture.home_team_name} vs {fixture.away_team_name}
        </div>
      ))}
    </div>
  );
}
```

**Parameters:**
- `seasonId` - Filter by season
- `status` - Filter by status (scheduled, live, completed)
- `roundNumber` - Filter by round
- `teamId` - Filter by team

**Cache:** 10 minutes

---

### 6. useMatches

Fetch match results.

```typescript
const { data: matches } = useMatches({
  seasonId: 'season1',
  teamId: 'team1'
});
```

**Cache:** 5 minutes

---

### 7. useUpdateMatch

Update match result (mutation).

```typescript
function UpdateMatchForm({ fixtureId }: Props) {
  const updateMatch = useUpdateMatch();
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    updateMatch.mutate({
      fixture_id: fixtureId,
      season_id: 'season1',
      home_team_id: 'team1',
      away_team_id: 'team2',
      home_score: 3,
      away_score: 1,
      winner_id: 'team1'
    });
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

**Auto-invalidates:** matches, fixtures, player-stats, team-stats, leaderboard

---

## Stats Hooks

### 8. usePlayerStats

Fetch player statistics.

```typescript
import { usePlayerStats } from '@/hooks';

function LeaderboardPage() {
  const { data: players, isLoading } = usePlayerStats({
    seasonId: 'season1',
    sortBy: 'points',
    limit: 50,
    category: 'Legend'
  });
  
  return (
    <div>
      <h1>Top Players</h1>
      {players?.map((player, index) => (
        <div key={player.id}>
          {index + 1}. {player.player_name} - {player.points} pts
        </div>
      ))}
    </div>
  );
}
```

**Parameters:**
- `seasonId` - Required
- `playerId` - Specific player
- `teamId` - Filter by team
- `category` - Filter by category (Legend/Classic)
- `sortBy` - Sort field (points, goals_scored, assists, etc.)
- `limit` - Number of results (default: 100)

**Cache:** 2 minutes

---

### 9. useTeamStats

Fetch team statistics.

```typescript
const { data: teamStats } = useTeamStats({
  seasonId: 'season1',
  teamId: 'team1' // Optional
});

// teamStats is array if no teamId, single object if teamId provided
```

**Cache:** 2 minutes

---

### 10. useLeaderboard

Fetch leaderboard (server-side cached).

```typescript
function LeaderboardPage() {
  const { data: leaderboard } = useLeaderboard({
    seasonId: 'season1',
    type: 'player',
    category: 'Legend'
  });
  
  return (
    <div>
      <h1>Leaderboard</h1>
      <p>Updated: {new Date(leaderboard?.updated_at).toLocaleString()}</p>
      <p>{leaderboard?.cached ? '(Cached)' : '(Fresh)'}</p>
      
      {leaderboard?.data.map((player, i) => (
        <div key={i}>
          {i + 1}. {player.player_name} - {player.points}
        </div>
      ))}
    </div>
  );
}
```

**Cache:** 3 minutes (client) + 5 minutes (server)

---

## Update Stats Hooks

### 11. useUpdatePlayerStats

```typescript
function UpdateStatsButton({ playerId, seasonId }: Props) {
  const updateStats = useUpdatePlayerStats();
  
  const handleUpdate = () => {
    updateStats.mutate({
      player_id: playerId,
      season_id: seasonId,
      player_name: 'John Doe',
      goals_scored: 10,
      assists: 5,
      points: 145.5
    });
  };
  
  return (
    <button onClick={handleUpdate} disabled={updateStats.isPending}>
      Update Stats
    </button>
  );
}
```

**Auto-invalidates:** player-stats, leaderboard

---

### 12. useUpdateTeamStats

```typescript
const updateTeamStats = useUpdateTeamStats();

updateTeamStats.mutate({
  team_id: 'team1',
  season_id: 'season1',
  team_name: 'Team A',
  wins: 10,
  draws: 2,
  losses: 1,
  points: 32
});
```

**Auto-invalidates:** team-stats, leaderboard

---

## Advanced Usage

### Loading States

```typescript
const { data, isLoading, isFetching, isError, error } = usePlayerStats({
  seasonId: 'season1'
});

if (isLoading) return <Spinner />;
if (isError) return <Error message={error.message} />;
if (!data) return null;

return <PlayersList players={data} />;
```

### Manual Refetch

```typescript
const { data, refetch } = usePlayerStats({ seasonId: 'season1' });

return (
  <div>
    <button onClick={() => refetch()}>Refresh</button>
    {/* ... */}
  </div>
);
```

### Dependent Queries

```typescript
// Only fetch player stats after season is loaded
const { data: season } = useSeason({ seasonId });
const { data: players } = usePlayerStats({ 
  seasonId: season?.id
  // Automatically disabled until season?.id exists
});
```

### Optimistic Updates

```typescript
const updateStats = useUpdatePlayerStats();

updateStats.mutate(newStats, {
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['player-stats'] });
    
    // Snapshot previous value
    const previousStats = queryClient.getQueryData(['player-stats']);
    
    // Optimistically update UI
    queryClient.setQueryData(['player-stats'], (old) => ({
      ...old,
      ...newData
    }));
    
    return { previousStats };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['player-stats'], context.previousStats);
  },
});
```

### Polling for Real-Time Data

```typescript
// Poll every 30 seconds for live matches
const { data: liveMatches } = useMatches({
  seasonId: 'season1',
  status: 'live'
}, {
  refetchInterval: 30 * 1000, // 30 seconds
  staleTime: 10 * 1000 // 10 seconds
});
```

---

## Migration Examples

### Before (Direct Firebase)

```typescript
// OLD CODE - Direct Firebase query
import { collection, getDocs, where, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPlayers = async () => {
      const q = query(
        collection(db, 'realplayerstats'),
        where('season_id', '==', seasonId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => doc.data());
      setPlayers(data);
      setLoading(false);
    };
    
    fetchPlayers();
  }, [seasonId]);
  
  if (loading) return <div>Loading...</div>;
  
  return <div>{/* render players */}</div>;
}
```

### After (React Query Hook)

```typescript
// NEW CODE - React Query hook
import { usePlayerStats } from '@/hooks';

function PlayersList() {
  const { data: players, isLoading } = usePlayerStats({
    seasonId: seasonId
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return <div>{/* render players */}</div>;
}
```

**Benefits:**
- ✅ Automatic caching (2 min)
- ✅ No Firebase reads for 2 minutes
- ✅ Auto-retry on error
- ✅ Loading state built-in
- ✅ Cache invalidation on updates
- ✅ 80% less code!

---

## Cache Invalidation

Mutations automatically invalidate related caches:

| Mutation | Invalidates |
|----------|-------------|
| `usePlaceBid` | auction-players, bids |
| `useCreateRound` | auction-rounds |
| `useUpdateMatch` | matches, fixtures, player-stats, team-stats, leaderboard |
| `useUpdatePlayerStats` | player-stats, leaderboard |
| `useUpdateTeamStats` | team-stats, leaderboard |

---

## Performance Impact

### Before Optimization:
- Player stats query: 100 Firebase reads
- 10 page views: 1,000 reads
- 100 users/day: **100,000 reads** ❌

### After Optimization:
- First request: 0 Firebase reads (Neon API)
- Cached for 2-5 minutes
- 10 page views in 5 min: 1 API call (9 cached)
- 100 users/day: ~500 API calls
- **99.5% reduction in reads!** ✅

---

## Troubleshooting

### Cache not working
- Check QueryProvider is wrapping your app
- Verify staleTime is set correctly
- Check browser DevTools → React Query tab

### Data not updating after mutation
- Ensure mutation calls `invalidateQueries`
- Check query keys match exactly
- Manual refetch: `refetch()`

### Too many API calls
- Increase staleTime
- Disable refetchOnWindowFocus
- Check for unnecessary re-renders

---

## Next Steps

1. ✅ Hooks created
2. ⏳ Replace existing Firebase queries
3. ⏳ Test all components
4. ⏳ Monitor cache performance
5. ⏳ Fine-tune cache times

**All hooks are ready to use!** 🚀
