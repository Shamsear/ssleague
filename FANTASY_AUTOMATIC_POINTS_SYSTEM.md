Y# Fantasy Automatic Points System (Simplified)

## Overview
All players in a fantasy team's squad automatically earn points each round. No lineup selection needed - every player contributes!

## Key Features

### 1. Automatic Points for All Players
- ✅ Every player in squad earns points
- ✅ No lineup selection required
- ✅ Captain gets 2x points multiplier
- ✅ Vice-captain gets 1.5x points multiplier
- ✅ Set captain/VC once in squad management

### 2. Round-Based Tracking
- Fantasy rounds linked to tournament rounds
- Points calculated per round
- Full history of points per round
- Easy to see which round contributed what points

### 3. Simple Workflow
- Admin creates fantasy rounds
- Fixtures are played
- Admin calculates points for the round
- All players in all squads get their points automatically

## Database Schema

### `fantasy_rounds`
Links fantasy leagues to tournament rounds.

```sql
- fantasy_round_id: Unique identifier
- league_id: Fantasy league reference
- round_id: Tournament round reference (links to rounds table)
- round_number: Round number
- round_start_date: When round starts
- round_end_date: When round ends
- is_active: Current active round
- is_completed: Round finished
- points_calculated: Points have been calculated
```

### Updated `fantasy_player_points`
Now includes:
- `fantasy_round_id`: Links to specific fantasy round
- `points_breakdown`: JSONB with detailed breakdown (goals, clean sheets, etc.)

### Updated `fantasy_squad`
Keeps:
- `is_captain`: Captain gets 2x points
- `is_vice_captain`: Vice-captain gets 1.5x points

Removed:
- ~~`is_starting`~~ (not needed - all players play)

## Workflow

### For Teams
1. **Draft/Transfer Players** - Build your squad
2. **Set Captain & Vice-Captain** - Choose who gets multipliers (2x and 1.5x)
3. **Watch Points Accumulate** - All players earn points automatically
4. **View Round History** - See points earned per round

### For Admin
1. **Create Fantasy Rounds**
   ```javascript
   POST /api/admin/fantasy/rounds
   {
     "league_id": "fantasy_league_001",
     "round_id": "SSPSLFR00001",
     "round_number": 1,
     "round_start_date": "2024-12-16T10:00:00Z",
     "round_end_date": "2024-12-17T22:00:00Z"
   }
   ```

2. **Calculate Points After Round**
   ```javascript
   POST /api/admin/fantasy/rounds/FROUND001/calculate-points
   ```
   This will:
   - Get all fixtures from that round
   - For each fixture, get player performances
   - For each fantasy team, find which players played
   - Award points to those players
   - Update team totals

3. **View Round Results**
   - See which teams gained most points
   - See top performers per round

## Points Calculation Logic

When calculating points for a round:

```javascript
1. Get all fixtures in the round (from rounds table)
2. For each fixture:
   - Get player performances (goals, clean sheets, MOTM, etc.)
   - Calculate base points using fantasy_scoring_rules
   
3. For each fantasy team in the league:
   - Get their squad (from fantasy_squad)
   - Identify captain and vice-captain
   - For each player in squad:
     - If player played in any fixture this round:
       - Calculate base points based on performance
       - If player is captain: multiply by 2
       - If player is vice-captain: multiply by 1.5
       - Store in fantasy_player_points with fantasy_round_id
   
4. Update team totals (sum all points)
5. Update leaderboard
6. Mark round as points_calculated = true
```

## API Endpoints

### Admin Endpoints

```
POST /api/admin/fantasy/rounds
- Create fantasy round linked to tournament round

GET /api/admin/fantasy/rounds?league_id=xxx
- Get all rounds for a league

POST /api/admin/fantasy/rounds/{fantasy_round_id}/calculate-points
- Calculate points for completed round

PUT /api/admin/fantasy/rounds/{fantasy_round_id}
- Update round details
```

### Team Endpoints

```
GET /api/fantasy/rounds?league_id=xxx
- Get all rounds with status

GET /api/fantasy/rounds/{fantasy_round_id}/points?team_id=xxx
- Get team's points breakdown for specific round

GET /api/fantasy/teams/{team_id}/round-history
- Get points earned per round (history)

POST /api/fantasy/squad/set-captain
- Set captain and vice-captain
Body: {
  team_id,
  captain_player_id,
  vice_captain_player_id
}
```

## Migration Steps

1. **Run Migration**
   ```bash
   psql $DATABASE_URL -f migrations/add_fantasy_round_tracking_simple.sql
   ```

2. **Update Lineup UI**
   - Keep captain/VC selection in squad page
   - Remove "starting 5" selection
   - Remove lineup lock features
   - Simplify to just captain/VC buttons

3. **Update Points Calculation**
   - Modify to calculate for all squad players
   - Link points to fantasy_round_id
   - Apply captain (2x) and VC (1.5x) multipliers

4. **Update UI**
   - Show round-by-round breakdown
   - Display all squad players equally
   - Show points per round in team view

## Example: Round 1 Points Calculation

**Setup:**
- Round 1 (SSPSLFR00001) has 5 fixtures
- Fantasy Team "Los Blancos" has 10 players in squad

**Process:**
1. Admin clicks "Calculate Points for Round 1"
2. System finds all 5 fixtures in Round 1
3. For each fixture, gets player performances
4. For "Los Blancos" squad (Player A is captain, Player B is VC):
   - Player A scored 2 goals → 10 base points × 2 (captain) = **20 points**
   - Player B got clean sheet → 4 base points × 1.5 (VC) = **6 points**
   - Player C was MOTM → 3 base points × 1 = **3 points**
   - Players D-J didn't play → 0 points
5. Total for round: 29 points added to team
6. Stored in fantasy_player_points with fantasy_round_id

**Result:**
- Team can see: "Round 1: +29 points"
- Can drill down to see which players contributed
- Captain and VC multipliers clearly shown
- Total team points updated

## Benefits

✅ **Simple**: No lineup management complexity
✅ **Fair**: All players contribute
✅ **Transparent**: Clear round-by-round breakdown
✅ **Flexible**: Easy to recalculate if needed
✅ **Scalable**: Works with overlapping rounds
✅ **Historical**: Full audit trail per round

## Overlapping Rounds Example

**Scenario:**
- Round 1: Dec 16-17 (5 fixtures)
- Round 2: Dec 17-18 (5 fixtures)
- Some fixtures overlap on Dec 17

**How it works:**
1. Create both fantasy rounds in system
2. Each fixture belongs to one round (via rounds table)
3. Calculate Round 1 points when Round 1 completes
4. Calculate Round 2 points when Round 2 completes
5. If a player plays in both rounds, they earn points in both
6. Team total = sum of all rounds

## Next Steps

1. ✅ Apply migration
2. Remove lineup selection UI
3. Create admin round management UI
4. Implement points calculation API
5. Update team dashboard to show round breakdown
6. Test with multiple rounds
