# Player Awards System - Setup & Implementation Guide

## Overview

This document outlines the player awards system implementation, including database structure, API endpoints, and integration with player profiles.

## System Architecture

### Two Award Systems

The application supports two types of awards:

1. **Weekly/Daily Awards** (Temporary, recurring)
   - Player of the Day
   - Player of the Week
   - Team of the Day
   - Team of the Week
   - Player of the Season
   - Team of the Season
   - Managed via existing award API and UI

2. **Season-End Permanent Player Awards** (NEW)
   - Golden Boot (Top Scorer)
   - Most Assists
   - Best Goalkeeper
   - Best Attacker
   - Best Midfielder
   - Best Defender
   - Other custom season-end awards
   - Stored in `player_awards` table

## Database Structure

### player_awards Table

```sql
CREATE TABLE player_awards (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    season_id INTEGER NOT NULL,
    award_name VARCHAR(255) NOT NULL,
    award_position VARCHAR(100),          -- Winner, Runner-up, Third Place
    award_value NUMERIC(10, 2),           -- e.g., goals scored, assists count
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_name)
);

-- Indexes
CREATE INDEX idx_player_awards_player_id ON player_awards(player_id);
CREATE INDEX idx_player_awards_season_id ON player_awards(season_id);
CREATE INDEX idx_player_awards_player_season ON player_awards(player_id, season_id);
```

### Key Features

- **Proper Data Separation**: `award_name` and `award_position` are stored in separate columns (not combined like "Golden Boot Winner")
- **Unique Constraint**: A player can only have one of each award type per season
- **Optional Metadata**: `award_value` for quantitative metrics, `notes` for additional info

## Files Created

### 1. Database Migration

- **`scripts/create_player_awards_table.sql`**: SQL migration script
- **`scripts/run_player_awards_migration.py`**: Python script to run migration
- **`scripts/create-player-awards-table.js`**: Node.js script to create table
- **`app/api/admin/create-player-awards/route.ts`**: API endpoint to create table

### 2. Library Functions

- **`lib/neon/playerAwards.ts`**: Complete CRUD operations for player awards
  - `createPlayerAwardsTable()`: Creates the table
  - `getPlayerAwards()`: Fetch awards with filters
  - `getPlayerAwardsByPlayerAndSeason()`: Get awards for specific player/season
  - `createPlayerAward()`: Add new award
  - `updatePlayerAward()`: Update existing award
  - `deletePlayerAward()`: Remove award
  - `getPlayerAwardsCount()`: Count awards for player/season
  - `getPlayersWithAwardsForSeason()`: Get all awarded players for a season

### 3. API Endpoints

- **`/api/player-awards`**: GET and POST endpoints (already exists)
- **`/api/player-awards/[id]`**: Individual award operations (if needed)
- **`/api/admin/create-player-awards`**: Initialize table (POST)

### 4. Audit Tools

- **`scripts/audit_player_awards.py`**: Comprehensive audit script to:
  - Check table structure
  - Verify data integrity
  - Identify improperly formatted awards
  - Compare realplayerstats trophies JSONB structure
  - Validate awards_count synchronization
  - Report on active seasons

## Setup Instructions

### Step 1: Create the Table

Choose one of these methods:

#### Option A: Node.js Script (Recommended)
```bash
node scripts/create-player-awards-table.js
```

#### Option B: API Endpoint
```bash
curl -X POST http://localhost:3000/api/admin/create-player-awards
```

#### Option C: Python Script
```bash
python scripts/run_player_awards_migration.py
```

### Step 2: Verify Table Creation

Run the audit script:
```bash
python scripts/audit_player_awards.py
```

### Step 3: Test API Endpoints

```bash
# Get all awards
curl http://localhost:3000/api/player-awards

# Get awards for specific player
curl "http://localhost:3000/api/player-awards?player_id=PLAYER123"

# Get awards for specific season
curl "http://localhost:3000/api/player-awards?season_id=1"

# Create new award
curl -X POST http://localhost:3000/api/player-awards \
  -H "Content-Type: application/json" \
  -d '{
    "player_id": "PLAYER123",
    "player_name": "John Doe",
    "season_id": 1,
    "award_name": "Golden Boot",
    "award_position": "Winner",
    "award_value": 25
  }'
```

## Next Steps for Integration

### 1. Add Awards to Player Profile Page

Update `app/dashboard/team/player/[id]/page.tsx`:

```typescript
// Add to imports
import { getPlayerAwardsByPlayerAndSeason } from '@/lib/neon/playerAwards';

// Fetch awards in useEffect
const [awards, setAwards] = useState([]);

useEffect(() => {
  const fetchAwards = async () => {
    const seasonId = getCurrentSeasonId(); // Implement this
    const playerAwards = await fetch(
      `/api/player-awards?player_id=${playerId}&season_id=${seasonId}`
    );
    const data = await playerAwards.json();
    if (data.success) {
      setAwards(data.data);
    }
  };
  fetchAwards();
}, [playerId]);

// Add Awards Section to UI
<div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
  <h3 className="text-lg font-semibold text-gray-800 mb-4">
    🏆 Season Awards
  </h3>
  {awards.length > 0 ? (
    <div className="space-y-2">
      {awards.map((award) => (
        <div key={award.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-800">{award.award_name}</p>
            {award.award_position && (
              <p className="text-sm text-gray-600">{award.award_position}</p>
            )}
          </div>
          {award.award_value && (
            <span className="text-2xl font-bold text-yellow-600">
              {award.award_value}
            </span>
          )}
        </div>
      ))}
    </div>
  ) : (
    <p className="text-gray-500">No awards yet this season</p>
  )}
</div>
```

### 2. Add Awards to Player Leaderboards

Show trophy icons next to player names in statistics pages:

```typescript
// In leaderboard component
{player.awards_count > 0 && (
  <span className="ml-2 inline-flex items-center">
    <TrophyIcon className="w-4 h-4 text-yellow-500" />
    <span className="ml-1 text-xs text-gray-600">{player.awards_count}</span>
  </span>
)}
```

### 3. Create Awards Management UI

Admin page to assign/manage player awards:
- List all players eligible for awards
- Dropdown to select award types
- Input field for award position and value
- Bulk award assignment for season-end

### 4. Sync Awards Count

If `player_season` table exists, add script to sync `awards_count`:

```typescript
// Update player_season.awards_count based on player_awards
UPDATE player_season ps
SET awards_count = (
  SELECT COUNT(*)
  FROM player_awards pa
  WHERE pa.player_id = ps.player_id
  AND pa.season_id = ps.season_id
)
WHERE season_id = <active_season_id>;
```

### 5. Trophy Display Components

Create reusable components:
- `<TrophyBadge />`: Show single trophy with tooltip
- `<TrophyList />`: List of all trophies for a player
- `<TrophyIcon />`: Reusable trophy SVG icon

## Realplayerstats Trophies JSONB

The `realplayerstats` table has a `trophies` JSONB column. The audit script will help determine:
1. Current structure of trophies JSONB data
2. Whether it needs normalization (separate name/position)
3. If data should be migrated to `player_awards` table

## Data Integrity Checks

The audit script checks for:
- ✅ Proper separation of award name and position
- ✅ Consistency between `player_awards` and any awards count fields
- ✅ Active season award completeness
- ✅ Duplicate or conflicting awards

## Best Practices

1. **Always separate award name from position**: Use `award_name="Golden Boot"` and `award_position="Winner"`, not `award_name="Golden Boot Winner"`

2. **Use consistent award names**: Define a standard list of award names to prevent variations (e.g., "Golden Boot" vs "Top Scorer")

3. **Include metadata**: Use `award_value` to store quantitative data (goals, assists, etc.)

4. **Season-specific**: Always associate awards with a specific `season_id`

5. **Audit regularly**: Run the audit script after major award assignments

## Troubleshooting

### Connection Timeouts
If experiencing Neon database connection timeouts:
- Check network connectivity
- Verify DATABASE_URL in `.env.local`
- Try again after a few moments
- Use API endpoints instead of direct scripts

### Table Already Exists
If table creation fails with "table already exists":
- Run audit script to verify current structure
- Skip creation step and proceed to testing

### Unique Constraint Violations
If unable to create duplicate awards:
- This is expected behavior
- Update existing award instead of creating new one
- Or delete old award first

## Future Enhancements

- [ ] Awards history/timeline view
- [ ] Trophy cabinet UI component
- [ ] Award notification system
- [ ] Public awards leaderboard page
- [ ] Award voting/nomination system
- [ ] Award certificate/badge generation
- [ ] Social media sharing for awards

## Related Files

- `docs/PLAYER_AWARDS_SYSTEM.md`: Original player awards documentation
- `FINAL_MIGRATION_SUMMARY.md`: Trophy migration summary
- `REALPLAYER_STRUCTURE_UPDATE.md`: Player data structure notes

## Contact

For questions or issues with the player awards system, refer to the audit script output for diagnostic information.
