# Fantasy League PostgreSQL Migration - Complete

## Overview
The fantasy league system has been migrated from Firestore to a dedicated PostgreSQL database (Neon). This provides better performance, ACID transactions, and separates fantasy data from permanent team/player data.

## Database Architecture

### 4 Separate Databases
1. **Firestore** - Permanent data (real teams, players, seasons, users)
2. **Neon PostgreSQL #1** - Auction system
3. **Neon PostgreSQL #2** - Tournament system  
4. **Neon PostgreSQL #3** - Fantasy league system (NEW!)

## Fantasy Database Schema

### Tables Created
```sql
- fantasy_leagues          -- League settings per season
- fantasy_teams            -- Team participation and budget
- fantasy_players          -- Player pricing and availability
- fantasy_drafts           -- Draft history
- fantasy_squad            -- Current squad composition
- transfer_windows         -- Transfer period management
- fantasy_transfers        -- Transfer history
- fantasy_player_points    -- Match performance points
- fantasy_leaderboard      -- Cached rankings
```

### Key Features
- **Cascading foreign keys** for data integrity
- **Indexes** on frequently queried columns
- **UNIQUE constraints** on IDs
- **Budget tracking** per team
- **Transfer window** management
- **Points tracking** with multipliers for captains

## Configuration

### Environment Variable
```env
FANTASY_DATABASE_URL=postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

### Connection File
- **Location**: `lib/neon/fantasy-config.ts`
- **Export**: `fantasySql` - Tagged template function for queries

## Migration Status

### ✅ Completed

#### Backend APIs Updated
- `/api/fantasy/leagues` - Create/get fantasy leagues (NEW)
- `/api/fantasy/teams/toggle` - Toggle team participation (PostgreSQL)
- `/api/fantasy/teams/enable-all` - Bulk enable teams (PostgreSQL)

#### Database Setup
- Schema file: `database/migrations/fantasy-league-schema.sql`
- Init script: `scripts/init-fantasy-db.ts`
- Database initialized with all tables and indexes

#### Frontend Updates
- Committee enable-teams page sends `league_id`
- Auto-creates fantasy league on first team enable

### 🔄 Still Using Firestore (To Be Migrated)
The following APIs/pages still need to be updated to use PostgreSQL:

#### Team-Facing APIs
- `/api/fantasy/teams/my-team` - Get team squad
- `/api/fantasy/players/available` - Get available players
- `/api/fantasy/draft/*` - Draft management
- `/api/fantasy/transfers/*` - Transfer management
- `/api/fantasy/leaderboard/[leagueId]` - Rankings

#### Committee APIs
- `/api/fantasy/players/manage` - Player pricing
- `/api/fantasy/scoring-rules` - Points rules
- `/api/fantasy/calculate-points` - Calculate match points
- `/api/fantasy/values/update` - Update player values

#### Frontend Pages
- `/dashboard/team/fantasy/draft` - Team draft page
- `/dashboard/team/fantasy/transfers` - Team transfers page
- `/dashboard/team/fantasy/my-team` - Team squad view

## How It Works

### League Creation Flow
1. Committee admin visits enable-teams page
2. Page calls `/api/fantasy/leagues?season_id=XXX`
3. API checks if league exists in PostgreSQL
4. If not, creates league with default settings
5. Returns league_id as `fantasy-{season_id}`

### Team Enable Flow
1. Committee clicks toggle for a team
2. Frontend calls `/api/fantasy/teams/toggle` with:
   - `team_id`
   - `league_id` (fantasy-{season_id})
   - `enable` (true/false)
3. API gets team data from Firestore
4. Creates/updates record in PostgreSQL `fantasy_teams` table
5. Sets budget, owner info, enabled status

### Data Flow
```
Firestore (Real Data)           PostgreSQL (Fantasy Data)
─────────────────────          ───────────────────────────
├─ seasons                     ├─ fantasy_leagues
├─ teams                       ├─ fantasy_teams
├─ realplayer                  ├─ fantasy_players
└─ fixtures                    ├─ fantasy_drafts
                               ├─ fantasy_squad
                               ├─ fantasy_transfers
                               └─ fantasy_player_points
```

## Next Steps

### Priority 1: Core Team Features
1. Update `/api/fantasy/teams/my-team` to query PostgreSQL
2. Update `/api/fantasy/players/available` to use fantasy_players table
3. Migrate draft APIs to use PostgreSQL
4. Update draft page to use new APIs

### Priority 2: Transfer System  
1. Create transfer windows in PostgreSQL
2. Update transfer APIs
3. Update transfers page

### Priority 3: Points & Leaderboard
1. Migrate points calculation
2. Update leaderboard API
3. Auto-update rankings

### Priority 4: Committee Management
1. Player pricing interface
2. Scoring rules management
3. Transfer window management

## Testing Checklist

- [ ] Can create fantasy league for season
- [ ] Can enable/disable teams
- [ ] Teams show correct status in enable-teams page
- [ ] Team budget is set correctly
- [ ] League settings are applied
- [ ] Database connections work
- [ ] No Firestore `fantasy_*` collections are used

## Database Maintenance

### Initialize Database
```bash
npx tsx scripts/init-fantasy-db.ts
```

### Query Database
```typescript
import { fantasySql } from '@/lib/neon/fantasy-config';

const leagues = await fantasySql`SELECT * FROM fantasy_leagues`;
const teams = await fantasySql`SELECT * FROM fantasy_teams WHERE is_enabled = true`;
```

### Backup
Neon provides automatic backups. Manual backup:
```bash
pg_dump $FANTASY_DATABASE_URL > fantasy_backup.sql
```

## Benefits of PostgreSQL

1. **ACID Transactions** - Reliable multi-table operations
2. **Better Queries** - JOINs, CTEs, window functions
3. **Performance** - Indexed queries, connection pooling
4. **Separation** - Fantasy data separate from permanent data
5. **Scalability** - Dedicated resources for fantasy system
6. **Type Safety** - Strict schema validation

## Notes

- League IDs follow pattern: `fantasy-{season_id}`
- Team IDs are the same as Firestore team IDs
- Player IDs reference Firestore `realplayer` player_id
- Budget is stored as DECIMAL(12,2) in dollars
- Timestamps use PostgreSQL TIMESTAMP type

## Support

For issues or questions:
1. Check connection string in `.env.local`
2. Verify tables exist: `npx tsx scripts/init-fantasy-db.ts`
3. Check API logs for SQL errors
4. Review schema in `database/migrations/fantasy-league-schema.sql`
