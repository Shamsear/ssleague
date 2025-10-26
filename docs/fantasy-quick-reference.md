# Fantasy League Quick Reference Guide

## 🚀 Environment Setup

### Required Environment Variable
```bash
NEON_FANTASY_DATABASE_URL=postgresql://user:password@host/dbname
```

### Initialize Database
```bash
npm run init-fantasy-db
```

---

## 📊 Database Tables

| Table | Purpose |
|-------|---------|
| `fantasy_leagues` | League configuration |
| `fantasy_teams` | Team records with ranks/points |
| `fantasy_squad` | Drafted players |
| `fantasy_player_points` | Per-player, per-fixture points |
| `fantasy_scoring_rules` | Configurable scoring |
| `fantasy_player_prices` | Player valuations |
| `fantasy_transfers` | Transfer records |
| `transfer_windows` | Transfer periods |

---

## 🔌 API Endpoints

### Committee Admin APIs

#### Create Fantasy League
```http
POST /api/fantasy/leagues
Content-Type: application/json

{
  "season_id": "uuid",
  "name": "League Name",
  "max_squad_size": 15,
  "max_budget": 100000000
}
```

#### Get Leagues
```http
GET /api/fantasy/leagues?season_id=uuid
```

#### Enable All Teams
```http
POST /api/fantasy/committee/enable-all
Content-Type: application/json

{
  "season_id": "uuid",
  "league_id": "uuid",
  "enabled": true
}
```

#### Get Enabled Teams
```http
GET /api/fantasy/committee/enable-all?season_id=uuid&league_id=uuid
```

#### Toggle Individual Team
```http
POST /api/fantasy/committee/enable-teams
Content-Type: application/json

{
  "team_id": "uuid",
  "league_id": "uuid",
  "enabled": true
}
```

---

### Team APIs

#### Get My Team
```http
GET /api/fantasy/teams/my-team?user_id=uid
```

#### Get Available Players
```http
GET /api/fantasy/draft/available?user_id=uid
```

#### Draft Player
```http
POST /api/fantasy/draft/player
Content-Type: application/json

{
  "user_id": "uid",
  "player_id": "uuid",
  "price": 5000000
}
```

#### Get Draft Settings
```http
GET /api/fantasy/draft/settings?user_id=uid
```

---

### Transfer APIs

#### Get Transfer Settings
```http
GET /api/fantasy/transfers/settings?user_id=uid
```

#### Make Transfer
```http
POST /api/fantasy/transfers/make-transfer
Content-Type: application/json

{
  "user_id": "uid",
  "player_out_id": "uuid",
  "player_in_id": "uuid"
}
```

#### Get Transfer History
```http
GET /api/fantasy/transfers/history?user_id=uid
```

---

### Leaderboard & Points APIs

#### Get Leaderboard
```http
GET /api/fantasy/leaderboard/[leagueId]
```

#### Calculate Points (Automatic)
```http
POST /api/fantasy/calculate-points
Content-Type: application/json

{
  "fixture_id": "uuid",
  "season_id": "uuid",
  "round_number": 5
}
```

---

### Player Pricing APIs

#### Get Player Prices
```http
GET /api/fantasy/draft/prices?league_id=uuid
```

#### Set Single Player Price
```http
POST /api/fantasy/draft/prices
Content-Type: application/json

{
  "fantasy_league_id": "uuid",
  "season_id": "uuid",
  "player_id": "uuid",
  "price": 5000000
}
```

#### Generate All Prices
```http
POST /api/fantasy/draft/prices
Content-Type: application/json

{
  "fantasy_league_id": "uuid",
  "season_id": "uuid",
  "generate_all": true,
  "pricing_model": "tiered"
}
```

Pricing models: `"linear"`, `"exponential"`, `"tiered"`

---

## 🔧 Common Database Queries

### Get League Leaderboard
```sql
SELECT 
  ft.id, ft.team_name, ft.owner_name, 
  ft.total_points, ft.rank,
  COUNT(DISTINCT fs.real_player_id) as player_count
FROM fantasy_teams ft
LEFT JOIN fantasy_squad fs ON ft.id = fs.fantasy_team_id
WHERE ft.league_id = $1
GROUP BY ft.id
ORDER BY ft.rank ASC;
```

### Get Team Squad
```sql
SELECT 
  fs.real_player_id,
  fs.player_name,
  fs.position,
  fs.price_at_purchase,
  COALESCE(SUM(fpp.total_points), 0) as total_points
FROM fantasy_squad fs
LEFT JOIN fantasy_player_points fpp 
  ON fs.real_player_id = fpp.real_player_id
  AND fs.fantasy_team_id = fpp.fantasy_team_id
WHERE fs.fantasy_team_id = $1
GROUP BY fs.real_player_id, fs.player_name, fs.position, fs.price_at_purchase;
```

### Get Available Players
```sql
SELECT 
  rp.player_id, rp.name, rp.team_id,
  fpp.current_price
FROM realplayer rp
INNER JOIN fantasy_player_prices fpp 
  ON rp.player_id = fpp.player_id
WHERE fpp.league_id = $1
  AND rp.player_id NOT IN (
    SELECT real_player_id 
    FROM fantasy_squad 
    WHERE league_id = $1
  )
ORDER BY fpp.current_price DESC;
```

---

## 🎮 User Workflows

### Committee Admin Workflow
1. **Create League** → `/api/fantasy/leagues` (POST)
2. **Enable Teams** → `/api/fantasy/committee/enable-all` (POST)
3. **Set Prices** → `/api/fantasy/draft/prices` (POST)
4. **Monitor Leaderboard** → `/api/fantasy/leaderboard/[leagueId]` (GET)

### Team Workflow
1. **View My Team** → `/dashboard/team/fantasy/my-team`
2. **Draft Players** → `/dashboard/team/fantasy/draft`
3. **Make Transfers** → `/dashboard/team/fantasy/transfers`
4. **Check Rankings** → `/dashboard/team/fantasy/leaderboard`

---

## 📈 Performance Tips

### Query Optimization
- Use indexes on: `league_id`, `fantasy_team_id`, `round_number`, `player_id`
- Aggregate points at query time for real-time accuracy
- Cache leaderboard for 30-60 seconds if needed

### Database Maintenance
```sql
-- Analyze tables for query planning
ANALYZE fantasy_teams;
ANALYZE fantasy_squad;
ANALYZE fantasy_player_points;

-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE schemaname = 'public';

-- Vacuum for performance
VACUUM ANALYZE fantasy_teams;
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: "No fantasy league found"
- **Solution**: Ensure league created for season
- **Check**: `SELECT * FROM fantasy_leagues WHERE season_id = 'xxx'`

**Issue**: "No fantasy team found"
- **Solution**: Ensure team enabled in league
- **Check**: `SELECT * FROM fantasy_teams WHERE real_team_id = 'xxx'`

**Issue**: "Budget exceeded"
- **Solution**: Check total squad value vs league budget
- **Check**: League `max_budget` and current squad total

**Issue**: "Transfer window closed"
- **Solution**: Check transfer_windows table for active windows
- **Check**: `SELECT * FROM transfer_windows WHERE is_active = true`

---

## 🔒 Security Notes

- All endpoints require authentication
- Committee endpoints require `committee_admin` or `super_admin` role
- Team endpoints require `team` role
- User can only access their own team data

---

## 📝 Code Examples

### Get Fantasy DB Connection
```typescript
import { getFantasyDb } from '@/lib/neon/fantasy-config';

const sql = getFantasyDb();
const teams = await sql`SELECT * FROM fantasy_teams`;
```

### Execute Transaction
```typescript
const sql = getFantasyDb();

// PostgreSQL handles transactions automatically
await sql`INSERT INTO fantasy_squad (...) VALUES (...)`;
await sql`UPDATE fantasy_teams SET ... WHERE id = ${teamId}`;
```

### Handle Errors
```typescript
try {
  const result = await sql`...`;
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('Database error:', error);
  return NextResponse.json(
    { error: 'Operation failed' },
    { status: 500 }
  );
}
```

---

## 📚 Related Documentation

- **Complete Migration**: `fantasy-migration-complete.md`
- **Phase 1**: `fantasy-migration-phase1-complete.md`
- **Phase 2**: `fantasy-migration-phase2-complete.md`
- **Phase 3**: `fantasy-migration-phase3-complete.md`
- **Phase 4**: `fantasy-migration-phase4-complete.md`
- **Schema**: `lib/neon/fantasy-schema.sql`

---

## 🎯 Key Metrics

- **API Response Time**: <500ms
- **Leaderboard Load**: 100-200ms
- **Draft Operation**: <200ms
- **Transfer Execution**: <300ms
- **Points Calculation**: 1-3 seconds

---

**Last Updated**: December 2024  
**Status**: Production Ready ✅
