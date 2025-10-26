# Fantasy League Implementation Progress

## ✅ Step 1: Foundation (COMPLETED)

### TypeScript Types
- ✅ Created `/types/fantasy.ts`
  - All interfaces defined
  - Type safety for entire system
  
### Database Documentation
- ✅ Created `/docs/FANTASY_LEAGUE_DATABASE.md`
  - Complete Firestore structure
  - Collection schemas
  - Indexes and queries
  - Data flow diagrams

### API Endpoints Created

#### 1. Create Fantasy League
**Endpoint:** `POST /api/fantasy/leagues/create`
- ✅ Creates fantasy league for season
- ✅ Auto-creates fantasy teams for all registered teams
- ✅ Sets up default scoring rules
- ✅ Validates no duplicate leagues per season

#### 2. Get Fantasy League
**Endpoint:** `GET /api/fantasy/leagues/[leagueId]`
- ✅ Fetches league details
- ✅ Returns fantasy teams (ordered by rank)
- ✅ Returns active scoring rules

#### 3. Assign Draft (Committee)
**Endpoint:** `POST /api/fantasy/draft/assign`
- ✅ Batch assign players to fantasy teams
- ✅ Validates no duplicate assignments
- ✅ Fetches player details from realplayer collection
- ✅ Updates team player counts
- ✅ Prevents already-drafted players

---

## 🚧 Step 2: Next Tasks

### API Endpoints Needed

#### 4. Get Fantasy Team Details
**Endpoint:** `GET /api/fantasy/teams/[teamId]`
- Fetch team info
- Get all drafted players
- Get season points breakdown

#### 5. Get Leaderboard
**Endpoint:** `GET /api/fantasy/leaderboard/[leagueId]`
- Fetch all teams ordered by rank
- Include team details and points

#### 6. Calculate Fantasy Points (Auto-trigger)
**Endpoint:** `POST /api/fantasy/calculate-points`
- Called after fixture results entered
- Calculate points for each drafted player
- Apply scoring rules
- Update team totals and ranks

#### 7. Update Scoring Rules
**Endpoint:** `PUT /api/fantasy/scoring-rules/[ruleId]`
- Committee can modify point values
- Activate/deactivate rules

#### 8. Request Transfer
**Endpoint:** `POST /api/fantasy/transfers/request`
- Team owner requests player swap
- Creates pending transfer

#### 9. Approve/Reject Transfer
**Endpoint:** `PUT /api/fantasy/transfers/[transferId]`
- Committee approves or rejects
- If approved, updates draft records

#### 10. Get Available Players
**Endpoint:** `GET /api/fantasy/players/available`
- List all undrafted players
- For transfer/scouting purposes

#### 11. Get Player Stats
**Endpoint:** `GET /api/fantasy/players/[playerId]/stats`
- Fantasy points history
- Match-by-match breakdown
- Averages and totals

---

## 🎨 Step 3: UI Pages Needed

### Committee Dashboard
1. **Create Fantasy League** - Form to create league for season
2. **Draft Entry Page** - Assign players to teams (like auction results)
3. **Scoring Rules Manager** - Edit point values
4. **Transfer Approval** - Review and approve transfers
5. **Fantasy Overview** - Leaderboard and statistics

### Team Owner Dashboard
1. **My Fantasy Team** - View drafted players and points
2. **Player Performance** - Detailed stats for each player
3. **Leaderboard** - Global standings
4. **All Players Stats** - Scout other players
5. **Transfer Request** - Request player swaps

---

## 📋 Step 4: Integration Points

### Trigger Points
1. **After Season Creation** → Committee can create fantasy league
2. **After Fixture Results** → Auto-calculate fantasy points
3. **Weekly/Round End** → Recalculate leaderboard ranks

### Data Dependencies
- `season_id` → Links to seasons
- `team_id` → Links to team_seasons
- `real_player_id` → Links to realplayer
- `fixture_id` → Links to fixtures/matchups

---

## 🎯 Implementation Priority

### High Priority (Core Features)
1. ✅ Create fantasy league (DONE)
2. ✅ Assign draft (DONE)
3. 🚧 Get fantasy team details (NEXT)
4. 🚧 Calculate fantasy points (NEXT)
5. 🚧 Leaderboard (NEXT)

### Medium Priority (Management)
6. Committee draft entry UI
7. Team owner dashboard UI
8. Player stats views

### Low Priority (Advanced)
9. Transfer system
10. Scoring rules customization UI
11. Historical data and charts

---

## 🧪 Testing Checklist

### API Tests
- [ ] Create league for valid season
- [ ] Prevent duplicate leagues
- [ ] Assign players successfully
- [ ] Prevent duplicate player drafts
- [ ] Calculate points correctly
- [ ] Update rankings accurately

### UI Tests
- [ ] Committee can create league
- [ ] Committee can enter draft results
- [ ] Teams can view their players
- [ ] Leaderboard displays correctly
- [ ] Real-time points updates

---

## 📝 Notes

### Default Scoring Rules
- Goals Scored: +10 points
- Goals Conceded: -2 points
- Clean Sheet: +5 points
- MOTM: +15 points
- Win: +5 points
- Draw: +2 points
- Loss: 0 points
- Fine Goals: -5 points
- Substitution: -3 points

### Key Design Decisions
1. One fantasy team per real team (1:1 mapping)
2. No player count limits (teams can draft any number)
3. No position restrictions
4. Points calculated automatically after match results
5. Committee has full control over draft and transfers
6. Transfers require committee approval
