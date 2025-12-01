# Bulk Round Committee Page Improvements

## Requirements

### 1. Hide Team Bids Until Timer Reaches 0
**Current Behavior:** Team bids are visible while the round is active
**Required Behavior:** Team bids should be hidden until `timeRemaining === 0` or round status is 'completed'

**Implementation:**
- Add conditional rendering around bid display sections
- Show "Bids will be revealed when timer ends" message during active round
- Reveal all bids when timer reaches 0 or round is completed

### 2. Show Team List with Slots and Selected Players
**Required Display:**
- List of all teams participating in the season
- For each team show:
  - Team name
  - Slots needed (based on auction settings)
  - Number of players selected/bid on
  - Progress indicator

**Data Needed:**
- Teams list for the season
- Auction settings (slots per team)
- Count of bids per team for this round

## Implementation Plan

### Step 1: Add Team Summary Section

Create a new section above the players list:

```typescript
interface TeamSummary {
  team_id: string;
  team_name: string;
  slots_needed: number;
  players_selected: number;
  bids_submitted: number;
}
```

### Step 2: Fetch Team Data

Add API call to get team summaries:
```typescript
GET /api/bulk-rounds/{id}/team-summary
```

Response:
```json
{
  "teams": [
    {
      "team_id": "SSPSLT0001",
      "team_name": "Team A",
      "slots_needed": 5,
      "players_selected": 3,
      "bids_submitted": 3
    }
  ]
}
```

### Step 3: Hide Bids During Active Round

```typescript
const shouldShowBids = round.status === 'completed' || timeRemaining === 0;

{shouldShowBids ? (
  // Show actual bids
  <div>Team bids...</div>
) : (
  // Show placeholder
  <div className="text-center py-8">
    <svg>🔒</svg>
    <p>Bids will be revealed when the timer ends</p>
    <p>Time remaining: {formatTime(timeRemaining)}</p>
  </div>
)}
```

### Step 4: Team Summary UI

```typescript
<div className="bg-white rounded-xl p-6 mb-6">
  <h3>Team Progress</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {teams.map(team => (
      <div key={team.team_id} className="border rounded-lg p-4">
        <h4>{team.team_name}</h4>
        <div className="mt-2">
          <div className="flex justify-between text-sm">
            <span>Players Selected:</span>
            <span className="font-bold">{team.players_selected} / {team.slots_needed}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(team.players_selected / team.slots_needed) * 100}%` }}
            />
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

## Files to Modify

1. **`app/dashboard/committee/bulk-rounds/[id]/page.tsx`**
   - Add team summary state
   - Add fetch for team data
   - Add conditional rendering for bids
   - Add team summary UI section

2. **`app/api/bulk-rounds/[id]/team-summary/route.ts`** (NEW)
   - Create endpoint to fetch team summary data
   - Query bids table for player counts per team
   - Get auction settings for slots needed

## Database Queries Needed

### Get Team Bids Count
```sql
SELECT 
  team_id,
  COUNT(DISTINCT player_id) as players_selected
FROM round_bids
WHERE round_id = $1
GROUP BY team_id
```

### Get Auction Settings
```sql
SELECT 
  max_bids_per_team as slots_needed
FROM auction_settings
WHERE season_id = $1
LIMIT 1
```

### Get Teams
```sql
SELECT id, name
FROM teams
WHERE season_id = $1
ORDER BY name
```

## UI Mockup

```
┌─────────────────────────────────────────┐
│ Round Active - Time: 01:23:45           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Team Progress                            │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Team A   │ │ Team B   │ │ Team C   │ │
│ │ 3/5      │ │ 5/5 ✓    │ │ 2/5      │ │
│ │ ████░░   │ │ █████    │ │ ███░░░   │ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Player Bids                              │
├─────────────────────────────────────────┤
│ 🔒 Bids Hidden                          │
│ Bids will be revealed when timer ends   │
│ Time remaining: 01:23:45                 │
└─────────────────────────────────────────┘
```

## Testing Checklist

- [ ] Team summary shows all teams
- [ ] Player counts update in real-time
- [ ] Bids are hidden during active round
- [ ] Bids are revealed when timer reaches 0
- [ ] Bids are visible for completed rounds
- [ ] Progress bars show correct percentages
- [ ] Teams with full slots show checkmark
- [ ] WebSocket updates team counts in real-time

## Notes

- Consider adding WebSocket updates for team counts
- Add color coding for teams (green = complete, yellow = in progress, red = no bids)
- Consider adding sorting options (by progress, by name, etc.)
- Add export functionality for committee to download team selections
