# Team Stats Collection Structure

## Overview
The team data structure has been refactored to separate permanent team data from season-specific statistics, similar to how player data is handled.

## Collections

### 1. `teams` Collection
**Purpose:** Store permanent team information that persists across seasons.

**Fields:**
- `id` (string) - Team ID (e.g., "sspslteam0001")
- `team_name` (string) - Current team name
- `owner_name` (string) - Team owner
- `userId` (string) - Firebase Auth user ID
- `userEmail` (string) - Team login email
- `hasUserAccount` (boolean) - Whether team has login credentials
- `seasons` (array) - List of season IDs team participated in
- `current_season_id` (string) - Latest season ID
- `total_seasons_participated` (number) - Count of seasons
- `name_history` (array) - Previous team names (if changed)
- `previous_names` (array) - Duplicate for easier querying
- `is_active` (boolean)
- `is_historical` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Key Point:** This collection NO LONGER contains `performance_history` or any season-specific stats.

---

### 2. `teamstats` Collection (NEW)
**Purpose:** Store season-specific team statistics.

**Document ID Format:** `{team_id}_{season_id}` (e.g., "sspslteam0001_SSPSLS12")

**Fields:**
- `team_id` (string) - Reference to team in `teams` collection
- `team_name` (string) - Team name in this season (may differ if renamed)
- `season_id` (string) - Reference to season
- `owner_name` (string) - Team owner in this season
- `rank` (number) - Final standing/rank
- `points` (number) - Total points earned
- `matches_played` (number) - Matches played
- `wins` (number) - Wins
- `draws` (number) - Draws
- `losses` (number) - Losses
- `goals_for` (number) - Goals scored
- `goals_against` (number) - Goals conceded
- `goal_difference` (number) - Goal difference
- `win_percentage` (number) - Win percentage
- `cup_achievement` (string) - Cup achievements
- `players_count` (number) - Number of players in team
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

## Data Flow

### Import Process
1. **Team Creation/Update** (`teams` collection)
   - Create/update permanent team data
   - Add season ID to `seasons` array
   - Track name changes in `name_history`

2. **Team Stats Creation** (`teamstats` collection)
   - Create document with ID `{team_id}_{season_id}`
   - Store all team standings data from Excel
   - Initialize with `players_count: 0`

3. **Player Import** (`realplayerstats` collection)
   - Import all player stats as usual

4. **Update Team Stats**
   - Update `players_count` in teamstats document
   - **Note:** No longer computing/overwriting stats from player aggregations

### Data Retrieval
When fetching season data:
1. Query `teams` where `seasons` contains `season_id`
2. Query `teamstats` where `season_id` matches
3. Merge team data with corresponding stats
4. Return merged data with `season_stats` property

---

## Benefits

### 1. **Clean Separation**
- Permanent data (team identity) separate from transient data (season performance)
- Easier to query and maintain

### 2. **Accurate Statistics**
- Team stats directly from Excel upload (official standings)
- No more overwriting with computed values from player stats

### 3. **Consistent with Player Data**
- Similar structure to `realplayers` (permanent) + `realplayerstats` (seasonal)
- Easier to understand and maintain

### 4. **Better Querying**
- Fast queries for season-specific data
- No need to dig into nested `performance_history` objects
- Can easily compare teams across seasons

### 5. **Scalability**
- Smaller team documents (no nested season data)
- Each season stats is its own document
- Better Firestore performance

---

## Migration Notes

**Existing Data:** 
- Old teams may still have `performance_history` objects
- New imports will use the `teamstats` collection
- Frontend should check both structures for backward compatibility

**Frontend Changes:**
- Use `team.season_stats` (from teamstats) instead of `team.performance_history[seasonId]`
- Team stats now returned at same level as team data in API response

---

## Example Usage

### Query Team Stats for a Season
```javascript
const teamStatsRef = db.collection('teamstats').doc(`${teamId}_${seasonId}`);
const teamStats = await teamStatsRef.get();
```

### Get All Teams in a Season with Stats
```javascript
// Get teams
const teams = await db.collection('teams')
  .where('seasons', 'array-contains', seasonId)
  .get();

// Get stats for those teams
const teamStats = await db.collection('teamstats')
  .where('season_id', '==', seasonId)
  .get();

// Merge
const teamsWithStats = teams.docs.map(team => ({
  ...team.data(),
  season_stats: teamStats.docs.find(s => s.data().team_id === team.id)?.data()
}));
```

---

## API Response Structure

```json
{
  "success": true,
  "data": {
    "season": { ... },
    "teams": [
      {
        "id": "sspslteam0001",
        "team_name": "ALPHA OMEGA FC",
        "owner_name": "ANOOP S",
        "seasons": ["SSPSLS12"],
        "season_stats": {
          "team_id": "sspslteam0001",
          "season_id": "SSPSLS12",
          "rank": 7,
          "points": 44,
          "matches_played": 26,
          "wins": 14,
          "draws": 2,
          "losses": 10,
          "goals_for": 260,
          "goals_against": 238,
          "goal_difference": 22,
          "win_percentage": 56,
          "players_count": 6
        }
      }
    ],
    "players": [ ... ],
    "awards": [ ... ],
    "matches": [ ... ]
  }
}
```
