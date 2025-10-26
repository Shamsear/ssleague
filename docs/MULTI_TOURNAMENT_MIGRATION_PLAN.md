# Multi-Tournament Architecture Migration Plan

## Overview
Migrating from single-tournament-per-season to multi-tournament-per-season architecture.

**Goal:** Support multiple tournaments (League, Cup, UCL, UEL) running simultaneously in the same season.

---

## Phase 1: Database Schema Changes

### 1.1 New Tables

#### `tournaments` (New Core Table)
```sql
CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,                    -- e.g., 'SSPSLS16-LEAGUE', 'SSPSLS16-CUP'
  season_id TEXT NOT NULL,                -- Links to season (e.g., 'SSPSLS16')
  tournament_type TEXT NOT NULL,          -- 'league', 'cup', 'ucl', 'uel', 'super_cup'
  tournament_name TEXT NOT NULL,          -- 'Premier League', 'FA Cup', etc.
  tournament_code TEXT,                   -- Short code like 'PL', 'FAC', 'UCL'
  status TEXT DEFAULT 'upcoming',         -- 'upcoming', 'active', 'completed'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,       -- Primary tournament for the season (usually league)
  display_order INTEGER DEFAULT 0,        -- For UI sorting
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(season_id, tournament_type)
);
```

### 1.2 Modified Tables (Add tournament_id)

#### `tournament_settings`
```sql
-- BEFORE: season_id TEXT PRIMARY KEY
-- AFTER:  tournament_id TEXT PRIMARY KEY

ALTER TABLE tournament_settings
  DROP CONSTRAINT tournament_settings_pkey;
  
ALTER TABLE tournament_settings
  ADD COLUMN tournament_id TEXT;
  
-- Migrate data: tournament_id = season_id + '-LEAGUE' for existing
UPDATE tournament_settings
SET tournament_id = season_id || '-LEAGUE';

ALTER TABLE tournament_settings
  ALTER COLUMN tournament_id SET NOT NULL;
  
ALTER TABLE tournament_settings
  ADD PRIMARY KEY (tournament_id);
  
-- Keep season_id for reference
-- Add foreign key
ALTER TABLE tournament_settings
  ADD CONSTRAINT fk_tournament
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
```

#### `fixtures`
```sql
ALTER TABLE fixtures
  ADD COLUMN tournament_id TEXT;

-- Migrate existing data
UPDATE fixtures
SET tournament_id = season_id || '-LEAGUE';

ALTER TABLE fixtures
  ALTER COLUMN tournament_id SET NOT NULL;

CREATE INDEX idx_fixtures_tournament_id ON fixtures(tournament_id);
CREATE INDEX idx_fixtures_season_tournament ON fixtures(season_id, tournament_id);
```

#### `realplayerstats` (Player Season Stats)
```sql
-- Change primary key from (player_id, season_id) to (player_id, tournament_id)

-- Create new composite ID column
ALTER TABLE realplayerstats
  ADD COLUMN tournament_id TEXT;

-- Migrate data
UPDATE realplayerstats
SET tournament_id = season_id || '-LEAGUE';

ALTER TABLE realplayerstats
  ALTER COLUMN tournament_id SET NOT NULL;

-- Recreate primary key
ALTER TABLE realplayerstats
  DROP CONSTRAINT realplayerstats_pkey;
  
ALTER TABLE realplayerstats
  ADD PRIMARY KEY (player_id, tournament_id);

CREATE INDEX idx_realplayerstats_tournament ON realplayerstats(tournament_id);
```

#### `teamstats` (Team Standings)
```sql
ALTER TABLE teamstats
  ADD COLUMN tournament_id TEXT;

UPDATE teamstats
SET tournament_id = season_id || '-LEAGUE';

ALTER TABLE teamstats
  ALTER COLUMN tournament_id SET NOT NULL;

ALTER TABLE teamstats
  DROP CONSTRAINT teamstats_pkey;
  
ALTER TABLE teamstats
  ADD PRIMARY KEY (team_id, tournament_id);

CREATE INDEX idx_teamstats_tournament ON teamstats(tournament_id);
```

#### `matchups`
```sql
-- Already linked via fixtures, but add tournament_id for faster queries
ALTER TABLE matchups
  ADD COLUMN tournament_id TEXT;

UPDATE matchups m
SET tournament_id = (
  SELECT f.tournament_id FROM fixtures f WHERE f.id = m.fixture_id
);

CREATE INDEX idx_matchups_tournament ON matchups(tournament_id);
```

#### `fixture_audit_log`
```sql
ALTER TABLE fixture_audit_log
  ADD COLUMN tournament_id TEXT;

CREATE INDEX idx_audit_log_tournament ON fixture_audit_log(tournament_id);
```

#### `round_deadlines` (if exists)
```sql
ALTER TABLE round_deadlines
  ADD COLUMN tournament_id TEXT;

UPDATE round_deadlines
SET tournament_id = season_id || '-LEAGUE';

CREATE INDEX idx_round_deadlines_tournament ON round_deadlines(tournament_id);
```

---

## Phase 2: API Routes Changes

### Files to Update (30+)

#### Tournament Management APIs (New)
- `app/api/tournaments/route.ts` - List/Create tournaments
- `app/api/tournaments/[id]/route.ts` - Get/Update/Delete tournament
- `app/api/tournaments/by-season/route.ts` - Get tournaments by season

#### Existing APIs to Update
1. `/api/tournament-settings/route.ts` - Add tournament_id param
2. `/api/fixtures/season/route.ts` - Filter by tournament_id
3. `/api/fixtures/team/route.ts` - Add tournament_id param
4. `/api/fixtures/bulk/route.ts` - Add tournament_id field
5. `/api/stats/players/route.ts` - Filter by tournament_id
6. `/api/stats/teams/route.ts` - Filter by tournament_id
7. `/api/realplayers/update-stats/route.ts` - Include tournament_id
8. `/api/realplayers/update-points/route.ts` - Include tournament_id
9. All fixture sub-routes (lineup, matchups, etc.)

---

## Phase 3: React Hooks Changes

### New Hooks
```typescript
// hooks/useTournaments.ts
export function useTournaments(seasonId?: string)
export function useTournament(tournamentId: string)

// hooks/useTournamentSettings.ts
export function useTournamentSettings(tournamentId: string)
```

### Updated Hooks
```typescript
// hooks/usePlayerStats.ts
- usePlayerStats({ seasonId, teamId })
+ usePlayerStats({ tournamentId, seasonId, teamId })

// hooks/useTeamStats.ts
- useTeamStats({ seasonId, teamId })
+ useTeamStats({ tournamentId, seasonId, teamId })

// hooks/useFixtures.ts
- useFixtures({ seasonId, teamId })
+ useFixtures({ tournamentId, seasonId, teamId })
```

---

## Phase 4: Frontend Components Changes

### New Components
1. **Tournament Selector** - Dropdown to switch between tournaments
2. **Tournament Dashboard** - Overview of all tournaments in a season
3. **Tournament Card** - Display tournament info and status

### Updated Components (50+)
1. All leaderboard pages - Add tournament selector
2. All stats pages - Filter by tournament
3. Fixture pages - Group by tournament
4. Team dashboard - Show stats per tournament
5. Player profile - Show stats per tournament
6. Committee pages - Tournament management

---

## Phase 5: Data Migration Strategy

### Migration Steps

1. **Backup Current Data**
   ```bash
   # Export all tables before migration
   pg_dump -t fixtures -t realplayerstats -t teamstats > backup.sql
   ```

2. **Create Default Tournaments**
   ```sql
   -- For each existing season, create a default "League" tournament
   INSERT INTO tournaments (id, season_id, tournament_type, tournament_name, is_primary)
   SELECT 
     season_id || '-LEAGUE',
     season_id,
     'league',
     name || ' League',
     true
   FROM seasons;
   ```

3. **Migrate Existing Data**
   - All existing fixtures → `tournament_id = season_id + '-LEAGUE'`
   - All existing stats → `tournament_id = season_id + '-LEAGUE'`
   - All existing settings → `tournament_id = season_id + '-LEAGUE'`

4. **Verify Data Integrity**
   - Check all foreign key constraints
   - Verify no orphaned records
   - Test queries with new schema

---

## Phase 6: Rollout Plan

### Stage 1: Database Migration (Day 1)
- ✅ Create tournaments table
- ✅ Add tournament_id columns
- ✅ Migrate existing data
- ✅ Test database queries

### Stage 2: API Layer (Day 2-3)
- ✅ Create tournament management APIs
- ✅ Update existing APIs to support tournament_id
- ✅ Test all endpoints

### Stage 3: Hooks Layer (Day 4)
- ✅ Create new tournament hooks
- ✅ Update existing hooks
- ✅ Test data fetching

### Stage 4: Frontend (Day 5-7)
- ✅ Add tournament selector component
- ✅ Update all pages to use tournament context
- ✅ Test UI flows

### Stage 5: Testing (Day 8-9)
- ✅ End-to-end testing
- ✅ Multi-tournament scenarios
- ✅ Performance testing

### Stage 6: Deployment (Day 10)
- ✅ Production deployment
- ✅ Monitor for issues
- ✅ User training

---

## Tournament Types Supported

| Type | Code | Description | Format |
|------|------|-------------|--------|
| `league` | PL | Premier League | Round-robin |
| `cup` | FAC | FA Cup | Knockout |
| `ucl` | UCL | Champions League | Group + Knockout |
| `uel` | UEL | Europa League | Group + Knockout |
| `super_cup` | SC | Super Cup | Single match |
| `league_cup` | LC | League Cup | Knockout |

---

## Example Use Cases

### Season: SSPSLS16

**Tournaments:**
1. `SSPSLS16-LEAGUE` - Premier League (20 teams, round-robin)
2. `SSPSLS16-CUP` - FA Cup (All teams, knockout)
3. `SSPSLS16-UCL` - Champions League (Top 4 from last season)
4. `SSPSLS16-UEL` - Europa League (5th-7th from last season)

**Player Stats:**
- Player X in League: 15 goals, 200 points
- Player X in Cup: 3 goals, 45 points
- Player X in UCL: 7 goals, 120 points
- **Total (aggregated):** 25 goals, 365 points

**Team Standings:**
- League: 1st place (85 points)
- Cup: Quarter-finals
- UCL: Group stage (2nd in group)

---

## Breaking Changes

⚠️ **API Changes:**
- All endpoints now require `tournament_id` parameter
- `season_id` alone is no longer sufficient for stats queries

⚠️ **Database Changes:**
- Primary keys changed on several tables
- New foreign key constraints added

⚠️ **Frontend Changes:**
- All pages need tournament context
- URLs may include tournament_id

---

## Backward Compatibility

To maintain backward compatibility during transition:

1. **API Routes:** Support both old and new params
   ```typescript
   const tournamentId = searchParams.get('tournament_id') || 
                        searchParams.get('season_id') + '-LEAGUE';
   ```

2. **Default Tournament:** If no tournament specified, use primary tournament
   ```sql
   SELECT id FROM tournaments 
   WHERE season_id = ? AND is_primary = true
   ```

3. **Gradual Migration:** Keep old endpoints working for 2 weeks

---

## Testing Checklist

- [ ] Create multiple tournaments in same season
- [ ] Create fixtures in different tournaments
- [ ] Submit results for different tournaments
- [ ] View player stats filtered by tournament
- [ ] View team standings per tournament
- [ ] View aggregated stats across all tournaments
- [ ] Switch between tournaments in UI
- [ ] Export data per tournament
- [ ] Delete tournament (cascade deletes)

---

## Estimated Effort

- **Database Migration:** 4 hours
- **API Updates:** 8 hours
- **Hooks Updates:** 4 hours
- **Frontend Updates:** 12 hours
- **Testing:** 6 hours
- **Documentation:** 2 hours

**Total:** ~36 hours (4-5 days)

---

## Success Criteria

✅ Multiple tournaments can exist in same season  
✅ Stats are tracked separately per tournament  
✅ UI allows switching between tournaments  
✅ Aggregated views show combined stats  
✅ No data loss during migration  
✅ Performance is acceptable (<100ms queries)  
✅ All existing features still work  

---

## Next Steps

1. Review and approve this plan
2. Schedule migration window
3. Begin Phase 1: Database migration
4. Progressive rollout through phases 2-6

---

**Status:** 📋 Plan Complete - Ready for Implementation  
**Last Updated:** October 24, 2025
