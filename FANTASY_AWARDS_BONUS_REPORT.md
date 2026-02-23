# Fantasy Awards Bonus Points Report

## Executive Summary

This report analyzes tournament awards data to implement bonus points in the fantasy league system.

---

## 📊 Current State

### Awards Tables in Tournament DB

1. **`awards` table** - Active daily/weekly awards
   - Player of the Day (POTD)
   - Team of the Day (TOD)
   - Player of the Week (POTW)
   - Team of the Week (TOW)
   - Includes round_number, week_number, performance stats

2. **`player_awards` table** - Season-end awards
   - Golden Boot, Golden Ball, Golden Glove
   - Best Player by Category
   - Manager of the Season
   - Tournament Champions
   - Emerging Player

### Current Fantasy Bonus Points

Only 3 manual bonus records exist in `bonus_points` table:
- Team of the Day awards (5 points each)
- Manually added by committee

---

## 🏆 Awards Analysis

### Daily/Weekly Awards (from `awards` table)

**Total Records:** 20+ active awards

#### Player Awards:
- **POTD (Player of the Day):** 10 awards
  - Rounds 20-26 covered
  - Includes performance stats (goals, MOTM status)
  - Example: Rohith (8 goals, MOTM) - Round 25

#### Team Awards:
- **TOD (Team of the Day):** 10 awards
  - Rounds 16-26 covered
  - Includes performance stats (wins, goals, goal difference)
  - Example: Legends (17 goals, +11 GD) - Round 22

- **POTW (Player of the Week):** 1 award
  - Week 4: Rohith (28 goals in 7 matches, avg 4.00)

- **TOW (Team of the Week):** 1 award
  - Week 4: Legends (4W-1D-1L, 76 goals, +26 GD)

### Season-End Awards (from `player_awards` table)

**Total Records:** 48 awards

#### Major Individual Awards:
- **Golden Boot:** 5 awards (top scorers)
- **Golden Ball:** 5 awards (best players)
- **Golden Glove:** 4 awards (best goalkeepers)
- **Best Player by Category:** 20 awards (RED, BLUE, BLACK, WHITE categories)
- **Emerging Player:** 2 awards
- **Best Active Player:** 1 award

#### Tournament/Category Champions:
- **Development League Champion:** 1 award
- **Development League Runners Up:** 1 award
- **RED 2 Champion:** 1 award
- **BLACK Champion:** 1 award
- **BLUE Champion:** 1 award
- **WHITE Champion:** 1 award

#### Management Awards:
- **Manager of the Season:** 4 awards
- **Manager of Season:** 1 award

---

## 💡 Recommended Bonus Points Structure

### Daily/Weekly Awards (Recurring)

| Award Type | Points | Frequency | Target |
|------------|--------|-----------|--------|
| Player of the Day (POTD) | 10 | Daily/Round | Player |
| Team of the Day (TOD) | 10 | Daily/Round | Team |
| Player of the Week (POTW) | 20 | Weekly | Player |
| Team of the Week (TOW) | 20 | Weekly | Team |

### Season-End Awards (One-Time)

| Award Type | Points | Target |
|------------|--------|--------|
| Golden Boot | 50 | Player |
| Golden Ball | 50 | Player |
| Golden Glove | 50 | Player |
| Best Player (Category) | 30 | Player |
| Emerging Player | 25 | Player |
| Best Active Player | 25 | Player |
| Tournament Champion | 40 | Player |
| Tournament Runner-Up | 30 | Player |
| Manager of the Season | 0 | N/A (not a player) |

---

## 🔄 Implementation Plan

### Phase 1: Sync Daily/Weekly Awards (Immediate)

Create automated sync script to:
1. Query `awards` table for new POTD, TOD, POTW, TOW awards
2. Map `player_id` to fantasy players
3. Map `team_id` to fantasy teams via `supported_team_id`
4. Insert into `bonus_points` table
5. Run recalculation script

### Phase 2: Season-End Awards (End of Season)

Create one-time script to:
1. Query `player_awards` table
2. Award bonus points for major individual awards
3. Run final recalculation

---

## 📋 Data Mapping Requirements

### Player Mapping
- **Source:** `awards.player_id` (e.g., "sspslpsl0002")
- **Target:** `fantasy_squad.real_player_id`
- **Note:** Direct match, no transformation needed

### Team Mapping
- **Source:** `awards.team_id` (e.g., "SSPSLT0015")
- **Target:** `fantasy_teams.supported_team_id` (e.g., "SSPSLT0015_SSPSLS16")
- **Note:** Need to append `_SSPSLS16` season suffix

### Current Fantasy Team Mappings:
```
SSPSLT0013 (Psychoz) -> 2 fantasy teams (Red Hawks FC, FC Barcelona)
SSPSLT0015 (Legends) -> 4 fantasy teams (Skill 555, Legends FC, Los Blancos, Psychoz)
SSPSLT0016 (Red Hawks Fc) -> 1 fantasy team (Blue Strikers)
SSPSLT0010 (Varsity Soccers) -> 1 fantasy team (Varsity Soccers)
```

---

## 📊 Sample Awards Data

### Recent Player of the Day Awards:
1. **Rohith** (sspslpsl0002) - Round 25
   - 8 goals, MOTM, 18-7 match score
   - Team: Legends

2. **Adil Mubarack** (sspslpsl0063) - Round 23
   - 6 goals, MOTM, 11-6 match score
   - Team: Varsity Soccers

3. **Ambady** (sspslpsl0064) - Round 24
   - 3 goals, MOTM, 6-8 match score
   - Team: Red Hawks Fc

### Recent Team of the Day Awards:
1. **Legends** (SSPSLT0015) - Round 25
   - 1W-0D-0L, 18 goals for, 7 against, +11 GD

2. **Psychoz** (SSPSLT0013) - Round 23
   - 1W-0D-0L, 14 goals for, 5 against, +9 GD

3. **Los Blancos** (SSPSLT0034) - Round 26
   - 1W-0D-0L, 15 goals for, 5 against, +10 GD

---

## ✅ Next Steps

1. **Create sync script** (`scripts/sync-awards-to-fantasy-bonuses.js`)
   - Auto-sync daily/weekly awards
   - Run after each round completion

2. **Update recalculation script**
   - Ensure bonus points are included in totals
   - Already implemented ✓

3. **Create admin UI**
   - View pending awards
   - Approve/reject bonus points
   - Manual bonus point entry

4. **Schedule automation**
   - Run sync script after round finalization
   - Send notifications for new awards

---

## 📈 Expected Impact

### Current Bonus Points: 3 records (15 points total)
### After Full Sync: ~30+ records (300+ points distributed)

**Benefits:**
- Rewards exceptional individual performances
- Incentivizes team selection strategy
- Increases engagement with daily/weekly awards
- Fair recognition of tournament achievements

---

## 🔍 Technical Notes

### Database Schema:
```sql
-- bonus_points table (fantasy DB)
CREATE TABLE bonus_points (
  id SERIAL PRIMARY KEY,
  target_type VARCHAR(10), -- 'player' or 'team'
  target_id TEXT,          -- player_id or team_id
  points INTEGER,
  reason TEXT,
  league_id TEXT,
  awarded_by TEXT,
  awarded_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Award Types Mapping:
- `POTD` → Player of the Day → 10 points
- `TOD` → Team of the Day → 10 points
- `POTW` → Player of the Week → 20 points
- `TOW` → Team of the Week → 20 points

---

*Report Generated: February 2026*
*Data Source: Tournament DB (awards, player_awards tables)*
