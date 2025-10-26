# Fantasy League Database Structure

## Overview
The Fantasy League system allows committee admins to create fantasy leagues, draft real players to fantasy teams, define scoring rules, and track performance across the season.

---

## Firestore Collections

### 1. `fantasy_leagues`
**Purpose:** Store fantasy league configurations for each season

**Document ID:** Auto-generated

**Fields:**
- `id` (string): Document ID
- `season_id` (string): Reference to season
- `name` (string): League name (e.g., "Season 16 Fantasy League")
- `status` (string): 'draft' | 'active' | 'completed'
- `draft_date` (timestamp): When draft occurred
- `created_by` (string): Committee admin UID
- `created_at` (timestamp): Creation date
- `updated_at` (timestamp): Last update

**Indexes:**
- `season_id`
- `status`

---

### 2. `fantasy_teams`
**Purpose:** Store fantasy teams for each real team in the league

**Document ID:** Auto-generated

**Fields:**
- `id` (string): Document ID
- `fantasy_league_id` (string): Reference to fantasy_leagues
- `team_id` (string): Reference to real team
- `team_name` (string): Fantasy team name
- `owner_name` (string): Team owner's name
- `owner_uid` (string): Team owner's user ID
- `total_points` (number): Cumulative points
- `rank` (number): Leaderboard position
- `player_count` (number): Number of drafted players
- `created_at` (timestamp): Creation date
- `updated_at` (timestamp): Last update

**Indexes:**
- `fantasy_league_id`
- `team_id`
- `fantasy_league_id + rank` (composite)

---

### 3. `fantasy_drafts`
**Purpose:** Track which real players are drafted to which fantasy teams

**Document ID:** Auto-generated

**Fields:**
- `id` (string): Document ID
- `fantasy_league_id` (string): Reference to fantasy_leagues
- `fantasy_team_id` (string): Reference to fantasy_teams
- `real_player_id` (string): Reference to realplayer
- `player_name` (string): Player name (denormalized)
- `draft_price` (number): Optional auction price
- `draft_order` (number): Pick number in draft
- `drafted_at` (timestamp): Draft date
- `drafted_by` (string): Committee admin UID

**Indexes:**
- `fantasy_league_id`
- `fantasy_team_id`
- `real_player_id`
- `fantasy_league_id + real_player_id` (composite - ensure unique)

**Constraints:**
- Each real_player_id can only appear ONCE per fantasy_league_id

---

### 4. `fantasy_scoring_rules`
**Purpose:** Define point values for different match events

**Document ID:** Auto-generated

**Fields:**
- `id` (string): Document ID
- `fantasy_league_id` (string): Reference to fantasy_leagues
- `rule_type` (string): Event type (see ScoringRuleType)
- `points_value` (number): Points awarded (can be negative)
- `description` (string): Human-readable description
- `is_active` (boolean): Whether rule is currently active
- `created_at` (timestamp): Creation date
- `updated_at` (timestamp): Last update

**Rule Types:**
- `goals_scored`: Points per goal scored
- `goals_conceded`: Points per goal conceded (usually negative)
- `clean_sheet`: Bonus for no goals conceded
- `motm`: Man of the Match bonus
- `fine_goals`: Penalty for fine goals
- `win`: Points for winning match
- `draw`: Points for drawing match
- `loss`: Points for losing match
- `substitution_penalty`: Penalty for being substituted

**Indexes:**
- `fantasy_league_id`
- `rule_type`

---

### 5. `fantasy_player_points`
**Purpose:** Store calculated fantasy points for each player per fixture

**Document ID:** Auto-generated

**Fields:**
- `id` (string): Document ID
- `fantasy_league_id` (string): Reference to fantasy_leagues
- `fantasy_team_id` (string): Reference to fantasy_teams
- `real_player_id` (string): Reference to realplayer
- `player_name` (string): Player name (denormalized)
- `fixture_id` (string): Reference to fixture
- `round_number` (number): Match round number

**Match Statistics:**
- `goals_scored` (number)
- `goals_conceded` (number)
- `result` (string): 'win' | 'draw' | 'loss'
- `is_motm` (boolean): Was MOTM
- `fine_goals` (number): Penalty goals
- `substitution_penalty` (number): Sub penalty
- `is_clean_sheet` (boolean): No goals conceded

**Points Breakdown:**
- `points_breakdown` (map):
  - `goals` (number)
  - `conceded` (number)
  - `result` (number)
  - `motm` (number)
  - `fines` (number)
  - `clean_sheet` (number)
  - `substitution` (number)

- `total_points` (number): Sum of breakdown
- `calculated_at` (timestamp): When points were calculated
- `created_at` (timestamp): Creation date

**Indexes:**
- `fantasy_league_id`
- `fantasy_team_id`
- `real_player_id`
- `fixture_id`
- `round_number`
- `fantasy_league_id + round_number` (composite)

---

### 6. `fantasy_transfers`
**Purpose:** Track player transfer requests and approvals

**Document ID:** Auto-generated

**Fields:**
- `id` (string): Document ID
- `fantasy_league_id` (string): Reference to fantasy_leagues
- `fantasy_team_id` (string): Reference to fantasy_teams
- `player_out_id` (string): Player being dropped
- `player_out_name` (string): Player name
- `player_in_id` (string): Player being added
- `player_in_name` (string): Player name
- `transfer_type` (string): 'trade' | 'drop_add'
- `transfer_reason` (string): Optional reason
- `requested_by` (string): Team owner UID
- `approved_by` (string): Committee admin UID
- `status` (string): 'pending' | 'approved' | 'rejected'
- `rejection_reason` (string): If rejected
- `requested_at` (timestamp): Request date
- `processed_at` (timestamp): Approval/rejection date

**Indexes:**
- `fantasy_league_id`
- `fantasy_team_id`
- `status`

---

## Data Flow

### Draft Process:
1. Committee creates `fantasy_leagues` document
2. System auto-creates `fantasy_teams` for each registered real team
3. Committee assigns default `fantasy_scoring_rules`
4. Committee enters draft results via UI → creates `fantasy_drafts` documents

### Match Day Flow:
1. Match results entered for fixture
2. System triggers fantasy points calculation
3. For each drafted player in that fixture:
   - Fetch player's match stats
   - Apply scoring rules
   - Create `fantasy_player_points` document
   - Update `fantasy_teams.total_points`
   - Recalculate `fantasy_teams.rank`

### Transfer Process:
1. Team owner requests transfer → creates `fantasy_transfers` (status: pending)
2. Committee reviews and approves/rejects
3. If approved:
   - Update `fantasy_drafts` (change fantasy_team_id)
   - Recalculate team totals

---

## Example Queries

### Get Fantasy Team with Players:
```typescript
// Get fantasy team
const teamDoc = await getDoc(doc(db, 'fantasy_teams', teamId));

// Get drafted players
const draftsQuery = query(
  collection(db, 'fantasy_drafts'),
  where('fantasy_team_id', '==', teamId)
);
```

### Get Leaderboard:
```typescript
const leaderboardQuery = query(
  collection(db, 'fantasy_teams'),
  where('fantasy_league_id', '==', leagueId),
  orderBy('rank', 'asc')
);
```

### Get Player Round Points:
```typescript
const pointsQuery = query(
  collection(db, 'fantasy_player_points'),
  where('real_player_id', '==', playerId),
  where('round_number', '==', roundNum)
);
```

---

## Security Considerations

- Committee admins: Full read/write access to all collections
- Team owners: Read access to all, write only to `fantasy_transfers` (own team)
- Public: Read-only access to leaderboards and stats
