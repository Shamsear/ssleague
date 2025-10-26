# Three-Database Architecture Migration Plan

## Executive Summary

Migrate from single Firebase database to a 3-database hybrid architecture:
- **Firebase**: Master data & authentication (reference only)
- **Neon DB1** (Existing): Auction system
- **Neon DB2** (New): Tournament system

---

## Current vs Proposed Architecture

### BEFORE (Current):
```
Firebase: Everything (Over quota risk!)
Neon DB1: Some auction data
```

### AFTER (Target):
```
Firebase: Auth + Master Data (2% of quota)
Neon DB1: Auction System (Unlimited reads)
Neon DB2: Tournament System (Unlimited reads)
```

---

## Database Connections

### Firebase
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
FIREBASE_ADMIN_PROJECT_ID=...
```

### Neon DB1 - Auction System
```env
NEON_AUCTION_DB_URL=postgresql://neondb_owner:npg_pxO1CmRN0WTr@ep-quiet-pine-a1leox7r-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

### Neon DB2 - Tournament System  
```env
NEON_TOURNAMENT_DB_URL=postgresql://neondb_owner:npg_2imTobxgU1HM@ep-twilight-union-a1ee67rr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## Data Allocation

### 🔥 FIREBASE - Master Data (Reference Only)

**Collections:**
```
users
├─ uid, email, role, username
├─ Updated: On registration only
└─ Reads: ~100/day

teams
├─ id, team_name, team_code, owner_uid, owner_name
├─ Updated: On creation/edit (rare)
└─ Reads: ~200/day

realplayers
├─ player_id, name, position, team_id, contract_info
├─ Updated: On contract changes (occasional)
└─ Reads: ~500/day

seasons
├─ season_id, name, start_date, end_date, status
├─ Updated: Rarely
└─ Reads: ~50/day

categories
├─ category_id, name, priority, rules
├─ Updated: Almost never
└─ Reads: ~50/day

invites
├─ invite_code, season_id, role, status
├─ Updated: On creation/usage
└─ Reads: ~100/day

usernames
├─ username, uid
├─ Updated: On registration
└─ Reads: ~100/day
```

**Total Firebase Reads: ~1,100/day** (2% of 50K quota) ✅

---

### 🎰 NEON DB1 - Auction System

**Tables:**
```sql
-- Player Database for Auctions
footballplayers
├─ id, player_id (FK: Firebase.realplayers)
├─ name, position, team_id, is_sold, acquisition_value
└─ Purpose: Players available for auction

-- Auction Rounds
rounds
├─ id, season_id, position, status, start_time, end_time
└─ Purpose: Auction round management

round_players
├─ id, round_id (FK: rounds), player_id (FK: footballplayers)
└─ Purpose: Players in specific rounds

-- Bidding System
bids
├─ id, team_id (FK: Firebase.teams), player_id, round_id
├─ amount, status, encrypted_bid_data
└─ Purpose: Auction bids

round_bids
├─ id, round_id, player_id, team_id, bid_amount
└─ Purpose: Round bid tracking

-- Auction Configuration
auction_settings
├─ id, season_id, settings (JSON)
└─ Purpose: Auction rules

-- Tiebreakers
tiebreakers
├─ id, round_id, player_id, tied_teams
└─ Purpose: Handle tied bids

bulk_tiebreakers
├─ Similar to tiebreakers but for bulk rounds
└─ Purpose: Bulk tiebreaker management

team_tiebreakers
├─ Links teams to tiebreakers
└─ Purpose: Team participation in tiebreakers

-- User Features
starred_players
├─ id, user_id, player_id
└─ Purpose: Favorite players
```

**Tables to REMOVE from DB1:**
- ❌ tournament_settings (move to DB2)
- ❌ fixtures (if exists, move to DB2)
- ❌ match_days (if exists, move to DB2)
- ❌ matchups (if exists, move to DB2)
- ❌ fixture_audit_log (if exists, move to DB2)

---

### ⚽ NEON DB2 - Tournament System (NEW)

**Tables to CREATE:**
```sql
-- Tournament Configuration
tournament_settings
├─ id, season_id, settings (JSON)
├─ total_rounds, points_per_win, points_per_draw
└─ Purpose: Tournament rules (migrated from DB1)

-- Match Schedule
fixtures
├─ id, season_id, round_number, match_day
├─ home_team_id (FK: Firebase.teams), away_team_id
├─ home_team_name, away_team_name
├─ home_score, away_score, status, scheduled_date
└─ Purpose: Match scheduling

matches
├─ id, fixture_id (FK: fixtures), season_id
├─ Similar to fixtures but detailed results
└─ Purpose: Completed match details

match_days
├─ id, season_id, round_number, scheduled_date
├─ status, deadline_times
└─ Purpose: Match day management

matchups
├─ id, season_id, round_number
├─ home_team_id, away_team_id, result
└─ Purpose: Team pairings

fixture_audit_log
├─ id, fixture_id, changed_by, changes (JSON)
└─ Purpose: Track fixture modifications

-- Team Management
team_players
├─ id, team_id (FK: Firebase.teams)
├─ player_id (FK: Firebase.realplayers)
├─ season_id, acquisition_price, status
└─ Purpose: Team roster tracking

-- Statistics
realplayerstats
├─ id (composite: player_id_season_id)
├─ player_id (FK: Firebase.realplayers)
├─ season_id (FK: Firebase.seasons)
├─ team_id (FK: Firebase.teams)
├─ matches_played, goals, assists, wins, losses
├─ motm_awards, points, category
└─ Purpose: Player performance stats

teamstats
├─ id (composite: team_id_season_id)
├─ team_id (FK: Firebase.teams)
├─ season_id (FK: Firebase.seasons)
├─ matches_played, wins, draws, losses
├─ goals_for, goals_against, points
└─ Purpose: Team performance stats

-- Computed Views
leaderboards
├─ id, season_id, type (team/player)
├─ rankings (JSON), updated_at
└─ Purpose: Cached leaderboard data
```

---

## Migration Steps

### Phase 1: Preparation (Day 1)

#### Step 1.1: Backup Current Data
```bash
# Export tournament_settings from DB1
node scripts/export-tournament-settings.js > tournament_settings_backup.json

# Verify backup
cat tournament_settings_backup.json
```

#### Step 1.2: Update Environment Variables
```env
# .env.local - Add new connection
NEON_TOURNAMENT_DB_URL=postgresql://neondb_owner:npg_2imTobxgU1HM@ep-twilight-union-a1ee67rr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Rename existing for clarity
NEON_AUCTION_DB_URL=postgresql://neondb_owner:npg_pxO1CmRN0WTr@ep-quiet-pine-a1leox7r-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

### Phase 2: Create Neon DB2 Schema (Day 1-2)

#### Step 2.1: Create Connection Config
```typescript
// lib/neon/tournament-config.ts
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

if (!connectionString) {
  throw new Error('NEON_TOURNAMENT_DB_URL not set');
}

export const tournamentSql = neon(connectionString);
```

#### Step 2.2: Run Schema Creation
```bash
node scripts/create-tournament-db-schema.ts
```

---

### Phase 3: Migrate tournament_settings (Day 2)

#### Step 3.1: Export from DB1
#### Step 3.2: Import to DB2
#### Step 3.3: Verify data integrity
#### Step 3.4: Drop from DB1 (after verification)

---

### Phase 4: Update Application Code (Day 2-3)

#### Step 4.1: Create Dual DB Support
```typescript
// lib/neon/config.ts
export const auctionSql = neon(process.env.NEON_AUCTION_DB_URL!);
export const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
```

#### Step 4.2: Update API Routes
- `/api/auction/*` → Use auctionSql
- `/api/tournament/*` → Use tournamentSql
- `/api/stats/*` → Use tournamentSql
- `/api/fixtures/*` → Use tournamentSql

#### Step 4.3: Update Frontend
- No changes needed (uses API routes)

---

### Phase 5: Testing (Day 3-4)

#### Test Checklist:
- [ ] Firebase auth works
- [ ] Team/player lookups from Firebase
- [ ] Auction bidding (Neon DB1)
- [ ] Fixture creation (Neon DB2)
- [ ] Stats calculation (Neon DB2)
- [ ] Leaderboards (Neon DB2)
- [ ] Cross-database references work

---

### Phase 6: Cleanup (Day 4)

#### Remove from Neon DB1:
- tournament_settings (if migration successful)
- Any other tournament-related tables

#### Remove from Firebase:
- realplayerstats (after migrating to DB2)
- teamstats (after migrating to DB2)
- fixtures (after migrating to DB2)
- matches (after migrating to DB2)

---

## Data Access Patterns

### Pattern 1: Team Lookup
```typescript
// Get team basic info
const team = await getDoc(doc(db, 'teams', teamId)); // Firebase

// Get team stats
const stats = await tournamentSql`
  SELECT * FROM teamstats WHERE team_id = ${teamId}
`;
```

### Pattern 2: Player Stats
```typescript
// Get player info
const player = await getDoc(doc(db, 'realplayers', playerId)); // Firebase

// Get player stats
const stats = await tournamentSql`
  SELECT * FROM realplayerstats WHERE player_id = ${playerId}
`;
```

### Pattern 3: Auction Bid
```typescript
// Get team info
const team = await getDoc(doc(db, 'teams', teamId)); // Firebase

// Get player from auction DB
const player = await auctionSql`
  SELECT * FROM footballplayers WHERE id = ${playerId}
`;

// Place bid
await auctionSql`
  INSERT INTO bids (team_id, player_id, amount)
  VALUES (${teamId}, ${playerId}, ${amount})
`;
```

---

## Benefits of This Architecture

### ✅ Separation of Concerns
- Firebase: Identity & master data
- Auction DB: Player database & bidding
- Tournament DB: Match play & statistics

### ✅ Scalability
- Each system can scale independently
- No Firebase quota issues
- Unlimited reads from Neon

### ✅ Performance
- Optimized queries per database
- No cross-database joins needed
- Proper indexes per use case

### ✅ Cost Effective
- Firebase free tier sufficient
- Two Neon free tiers (512MB each)
- Total: FREE for 1000+ users

### ✅ Maintainability
- Clear boundaries
- Easy to understand
- Easier to debug

---

## Risk Mitigation

### Risk 1: Data Inconsistency
**Mitigation:**
- Use composite IDs with foreign keys (team_id, player_id)
- Validate references before operations
- Regular integrity checks

### Risk 2: Migration Failure
**Mitigation:**
- Backup all data first
- Test in dev environment
- Keep old tables until verified
- Rollback plan ready

### Risk 3: Performance Issues
**Mitigation:**
- Create proper indexes
- Test query performance
- Monitor query times
- Optimize as needed

---

## Rollback Plan

If migration fails:

1. **Keep old Firebase collections** until verified
2. **Don't drop DB1 tables** until tested
3. **API routes switch back** via environment variable
4. **Quick rollback** in <1 hour

---

## Success Criteria

- [ ] All Firebase reads < 5,000/day (10% of quota)
- [ ] All Neon queries < 100ms response time
- [ ] Zero data loss during migration
- [ ] All features working correctly
- [ ] Users don't notice any changes

---

## Timeline

**Day 1:** Analysis, backup, setup DB2 (✅ Today)
**Day 2:** Create schema, migrate tournament_settings
**Day 3:** Update API routes, test
**Day 4:** Frontend updates, final testing
**Day 5:** Go live, monitor, cleanup

**Total: 5 days**

---

## Next Steps

1. Review and approve this plan
2. Backup current data
3. Create Neon DB2 schema
4. Begin migration

**Ready to proceed?** 🚀
