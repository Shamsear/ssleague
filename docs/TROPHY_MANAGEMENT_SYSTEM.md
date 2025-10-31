# 🏆 Trophy Management System

Complete documentation for the hybrid trophy management system that tracks team achievements across all seasons.

---

## Overview

The trophy management system provides:
- ✅ Separate `team_trophies` table for clean data querying
- ✅ Auto-award trophies based on final league standings
- ✅ Manual trophy management for cups and special awards
- ✅ Historical season integration via Excel imports
- ✅ Committee UI for trophy administration

---

## Architecture

### Database Schema

**Table: `team_trophies`**
```sql
CREATE TABLE team_trophies (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  season_id VARCHAR(255) NOT NULL,
  trophy_type VARCHAR(50) NOT NULL,    -- 'league', 'cup', 'runner_up', 'special'
  trophy_name VARCHAR(255) NOT NULL,   -- 'League Winner', 'UCL', 'FA Cup', etc.
  position INTEGER,                    -- League position (1, 2, 3, etc.)
  awarded_by VARCHAR(50) DEFAULT 'system',  -- 'system' or 'manual'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, season_id, trophy_name)
);
```

**Trophy Types:**
- `league` - League Winner (Position 1)
- `runner_up` - Runner Up (Position 2)
- `cup` - Cup competitions (UCL, FA Cup, DUO CUP, etc.)
- `special` - Special awards (3rd place, etc.)

---

## Features

### 1. Auto-Award System

**Trigger:** When a season's status changes to "completed"

**Behavior:**
```typescript
// In lib/firebase/seasons.ts
completeSeason(seasonId) 
  → awardSeasonTrophies(seasonId, 2)
    → Position 1 = "League Winner"
    → Position 2 = "Runner Up"
```

**Function:** `lib/award-season-trophies.ts`

### 2. Manual Trophy Management

**Committee UI:** `/dashboard/committee/trophies`

**Features:**
- 📊 Preview auto-awards before applying
- ➕ Add custom trophies (cups, special awards)
- 🗑️ Delete incorrect trophies
- 🔍 View all trophies by season

### 3. Historical Import Integration

**When importing Excel historical seasons:**
```typescript
// app/api/seasons/historical/import/route.ts

For each team:
  1. Parse position from Excel (rank column)
     → Position 1 = Auto-create "League Winner" trophy
     → Position 2 = Auto-create "Runner Up" trophy
  
  2. Parse cups from Excel (cup_1, cup_2, cup_3, etc.)
     → Auto-create cup trophy for each
```

---

## Usage

### For Committee Admins

#### Award Trophies (Two Options)

**Option 1: After Tournament Completes**
```
1. Go to /dashboard/committee/trophies
2. Select season (any status - active or completed)
3. Preview auto-awards
4. Click "Auto-Award Trophies"
5. Add manual trophies (cups, etc.) as needed
```

**Option 2: When Marking Season Complete** (Optional)
```
1. Navigate to Season Management
2. Mark season as "Completed"
3. System auto-awards Winner/Runner Up (background)
4. Optional: Go to Trophy Management to add cups
```

💡 **Best Practice**: Use Option 1 for immediate control after tournament ends

#### Manual Trophy Management
```
1. Go to /dashboard/committee/trophies
2. Select season
3. Preview auto-awards
4. Click "Auto-Award Trophies" (if not already awarded)
5. Click "+ Add Trophy" for manual entries
6. Delete any incorrect trophies
```

### For Historical Imports

**Excel Format:**
```
Teams Sheet:
| Team | Owner | Rank | P | MP | W | D | L | F | A | GD | Cup 1 | Cup 2 | Cup 3 |
|------|-------|------|---|----|----|---|---|---|---|----|-------|-------|-------|
| FC   | John  | 1    | 66| 22 | 21 | 3 | 1 | 89| 12| 77 | UCL   | FA Cup|       |
| United| Jane | 2    | 60| 22 | 19 | 3 | 2 | 72| 18| 54 | UEL   |       |       |
```

**Import Process:**
```bash
1. Upload Excel via Superadmin Historical Seasons
2. System parses teams and creates trophies:
   - Rank 1 → League Winner
   - Rank 2 → Runner Up
   - Cups → Individual trophies
```

---

## API Routes

### Fetch Trophies
```http
GET /api/trophies?season_id=SSPSLS01
```

### Preview Auto-Awards
```http
GET /api/trophies/preview?season_id=SSPSLS01
```

### Auto-Award Trophies
```http
POST /api/trophies/award
Body: { "season_id": "SSPSLS01" }
```

### Add Manual Trophy
```http
POST /api/trophies/add
Body: {
  "season_id": "SSPSLS01",
  "team_name": "FC Barcelona",
  "trophy_type": "cup",
  "trophy_name": "UCL",
  "notes": "Won in dramatic final"
}
```

### Delete Trophy
```http
DELETE /api/trophies/{trophy_id}
```

---

## Query Examples

### Get All Trophies for a Team
```sql
SELECT trophy_name, trophy_type, season_id
FROM team_trophies
WHERE team_name = 'FC Barcelona'
ORDER BY season_id DESC;
```

### Count Championships
```sql
SELECT team_name, COUNT(*) as championships
FROM team_trophies
WHERE trophy_type = 'league'
GROUP BY team_name
ORDER BY championships DESC;
```

### UCL Winners Across Seasons
```sql
SELECT team_name, season_id
FROM team_trophies
WHERE trophy_name = 'UCL'
ORDER BY season_id;
```

### Season Summary
```sql
SELECT 
  tt.team_name,
  tt.trophy_name,
  ts.position,
  ts.points
FROM team_trophies tt
JOIN teamstats ts ON tt.team_id = ts.team_id AND tt.season_id = ts.season_id
WHERE tt.season_id = 'SSPSLS01'
ORDER BY ts.position;
```

---

## Deployment Steps

### 1. Run Database Migration
```bash
# Windows PowerShell
psql $env:NEON_TOURNAMENT_DB_URL -f database/migrations/create-team-trophies-table.sql

# Unix/Linux/Mac
psql $NEON_TOURNAMENT_DB_URL -f database/migrations/create-team-trophies-table.sql
```

### 2. Migrate Existing Data (One-time)
```bash
npx tsx scripts/migrate-trophies-to-table.ts
```

This script:
- Reads all `teamstats` records
- Creates trophies based on `position` column
- Extracts cups from `teamstats.trophies` JSONB
- Inserts into `team_trophies` table

### 3. Verify Migration
```sql
-- Check total trophies
SELECT COUNT(*) FROM team_trophies;

-- Check by type
SELECT trophy_type, COUNT(*) 
FROM team_trophies 
GROUP BY trophy_type;

-- Check sample data
SELECT * FROM team_trophies LIMIT 10;
```

---

## File Structure

```
app/
├── api/
│   └── trophies/
│       ├── route.ts              # GET trophies by season
│       ├── preview/route.ts      # Preview auto-awards
│       ├── award/route.ts        # Auto-award POST
│       ├── add/route.ts          # Manual add POST
│       └── [id]/route.ts         # DELETE trophy
│
├── dashboard/
│   └── committee/
│       └── trophies/
│           └── page.tsx          # Trophy management UI

lib/
├── award-season-trophies.ts     # Core trophy logic
└── firebase/
    └── seasons.ts                # completeSeason() integration

database/
└── migrations/
    └── create-team-trophies-table.sql

scripts/
└── migrate-trophies-to-table.ts
```

---

## Benefits

### ✅ Clean Data Model
- Trophies separate from match statistics
- Easy to query and aggregate
- Scalable for unlimited trophies

### ✅ Hybrid Control
- Auto-award for standard trophies (Winner/Runner Up)
- Manual control for cups and special awards
- Committee can review and edit as needed

### ✅ Historical Integration
- Excel imports automatically populate trophies
- Existing data migrated via script
- No manual data entry required

### ✅ Cross-Season Analytics
- Count championships across all seasons
- Track cup winners over time
- Team performance trends

---

## Troubleshooting

### Trophies Not Showing
```sql
-- Check if trophies exist for season
SELECT * FROM team_trophies WHERE season_id = 'YOUR_SEASON_ID';

-- Check teamstats has positions
SELECT team_name, position FROM teamstats WHERE season_id = 'YOUR_SEASON_ID';
```

### Auto-Award Not Working
1. Verify season completion triggers function
2. Check console logs for errors
3. Manually trigger via Committee UI

### Duplicate Trophies
```sql
-- Check for duplicates
SELECT team_id, season_id, trophy_name, COUNT(*)
FROM team_trophies
GROUP BY team_id, season_id, trophy_name
HAVING COUNT(*) > 1;

-- Delete duplicates (keep oldest)
DELETE FROM team_trophies
WHERE id NOT IN (
  SELECT MIN(id)
  FROM team_trophies
  GROUP BY team_id, season_id, trophy_name
);
```

---

## Future Enhancements

### Potential Features
- 🔔 Notification system when trophies awarded
- 📊 Trophy visualization/charts
- 🏆 Trophy cabinet page for teams
- 📧 Email notifications to winners
- 🎖️ Badge system based on trophy count
- 📈 Historical trends dashboard

---

## Support

For issues or questions:
1. Check this documentation
2. Review migration logs
3. Check API responses in browser devtools
4. Verify database state with SQL queries

---

**Last Updated:** 2025-10-29  
**Version:** 1.0.0
