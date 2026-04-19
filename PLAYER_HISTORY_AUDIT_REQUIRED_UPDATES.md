# Player History Integration - Required Updates Audit

## Summary
Found **15 critical files** that modify footballplayers and need player_history integration.

---

## 🔴 CRITICAL - Player Movement APIs (Must Update First)

### 1. `lib/finalize-round.ts`
**Line 598**: Auction finalization - assigns players to teams
```typescript
await sql`UPDATE footballplayers SET is_sold = true, team_id = ${alloc.team_id}...`
```
**Action Required**: Add player_history INSERT after this UPDATE

### 2. `lib/finalize-bulk-tiebreaker.ts`
**Line 116**: Bulk round finalization
```typescript
await sql`UPDATE footballplayers SET is_sold = true...`
```
**Action Required**: Add player_history INSERT

### 3. `app/api/admin/bulk-rounds/[id]/finalize/route.ts`
**Line 250**: Bulk round finalization API
```typescript
await sql`UPDATE footballplayers SET is_sold = true...`
```
**Action Required**: Add player_history INSERT

### 4. `lib/player-transfers-neon.ts`
**Multiple locations**:
- **Line 189**: Release player (sets team_id = NULL)
- **Line 358**: Transfer player (changes team_id)
- **Line 551, 557**: Swap players (exchanges team_ids)

**Action Required**: 
- Release: Close player_history record
- Transfer: Close old + INSERT new player_history
- Swap: Close both + INSERT both new player_history

### 5. `app/api/players/simple-swap/route.ts`
**Line 171, 179**: Player swap
```typescript
UPDATE footballplayers SET team_id = $1...
```
**Action Required**: Close both records + INSERT both new records

### 6. `app/api/admin/release-team/route.ts`
**Line 160**: Team release (releases all players)
```typescript
await auctionSql`UPDATE footballplayers SET team_id = NULL...`
```
**Action Required**: Close all player_history records for that team

---

## 🟡 HIGH PRIORITY - Season Management

### 7. `app/api/admin/reconcile-contracts/route.ts`
**Multiple locations**:
- **Line 308**: Update contract_end_season
- **Line 328, 385**: Set team_id = NULL for expired contracts

**Action Required**: Update player_history contract fields + close records

### 8. `app/api/players/update-season/route.ts`
**Line 39**: Bulk season update
```typescript
await sql`UPDATE footballplayers SET season_id = ${seasonId}...`
```
**Action Required**: May need to create new player_history records for new season

---

## 🟢 MEDIUM PRIORITY - Round Management

### 9. `app/api/rounds/[id]/route.ts`
**Line 456, 596**: Reset player status when deleting rounds
```typescript
await sql`UPDATE footballplayers SET is_sold = false...`
```
**Action Required**: Close or delete corresponding player_history records

---

## 🔵 LOW PRIORITY - Scripts & Utilities

### 10. `scripts/execute-team-takeover-with-history.js`
**Line 157**: Team takeover
```typescript
await sql`UPDATE footballplayers SET team_id = ${TAKEOVER.newTeamId}...`
```
**Status**: ✅ Already has player_history logic

### 11. `scripts/create-efootball-releases-s16.js`
**Line 249**: Historical release script
```typescript
await auctionSql`UPDATE footballplayers SET team_id = NULL...`
```
**Action Required**: Add player_history close logic if script is reused

### 12. `scripts/apply-contract-fix.js`
**Line 92**: Contract fix script
```typescript
await sql`UPDATE footballplayers SET contract_start_season = 'SSPSLS16.5'...`
```
**Action Required**: Update player_history contract fields

### 13. `scripts/restore-players-to-teams.js`
**Line 73**: Restore players script
```typescript
await sql`UPDATE footballplayers fp SET team_id = tp.team_id...`
```
**Action Required**: Create player_history records if restoring

### 14. `scripts/restore-released-players.js`
**Line 75**: Restore released players
```typescript
await sql`UPDATE footballplayers fp SET team_id = tp.team_id...`
```
**Action Required**: Create player_history records

### 15. `scripts/reset-footballplayers.ts`
**Line 30**: Reset script
```typescript
await sql`UPDATE footballplayers SET is_sold = false...`
```
**Action Required**: Close all player_history records

---

## Implementation Priority

### Phase 1: Critical (Do First)
1. ✅ Create helper functions in `lib/player-history.ts`
2. Update `lib/finalize-round.ts` (auction wins)
3. Update `lib/finalize-bulk-tiebreaker.ts` (bulk auctions)
4. Update `app/api/admin/bulk-rounds/[id]/finalize/route.ts`

### Phase 2: Player Movement
5. Update `lib/player-transfers-neon.ts` (release, transfer, swap)
6. Update `app/api/players/simple-swap/route.ts`
7. Update `app/api/admin/release-team/route.ts`

### Phase 3: Season Management
8. Update `app/api/admin/reconcile-contracts/route.ts`
9. Update `app/api/players/update-season/route.ts`

### Phase 4: Round Management
10. Update `app/api/rounds/[id]/route.ts`

### Phase 5: Scripts (As Needed)
11-15. Update scripts when they're used again

---

## Testing Strategy

After each update, run:
```sql
-- Check for players without history
SELECT fp.player_id, fp.name, fp.team_id, fp.season_id
FROM footballplayers fp
LEFT JOIN player_history ph ON fp.player_id = ph.player_id 
  AND fp.team_id = ph.team_id 
  AND fp.season_id = ph.season_id
  AND ph.status = 'active'
WHERE fp.is_sold = true
AND ph.id IS NULL;

-- Check for orphaned active history
SELECT ph.*
FROM player_history ph
LEFT JOIN footballplayers fp ON ph.player_id = fp.player_id 
  AND ph.team_id = fp.team_id 
  AND ph.season_id = fp.season_id
WHERE ph.status = 'active'
AND fp.id IS NULL;
```

---

## Next Steps

1. Create `lib/player-history.ts` with helper functions
2. Start with Phase 1 (auction finalization)
3. Test thoroughly after each update
4. Monitor for any missed updates using the SQL queries above
5. Update this document as files are completed

---

## Completion Checklist

- [ ] lib/player-history.ts helper functions created
- [ ] lib/finalize-round.ts updated
- [ ] lib/finalize-bulk-tiebreaker.ts updated
- [ ] app/api/admin/bulk-rounds/[id]/finalize/route.ts updated
- [ ] lib/player-transfers-neon.ts updated
- [ ] app/api/players/simple-swap/route.ts updated
- [ ] app/api/admin/release-team/route.ts updated
- [ ] app/api/admin/reconcile-contracts/route.ts updated
- [ ] app/api/players/update-season/route.ts updated
- [ ] app/api/rounds/[id]/route.ts updated
- [ ] All tests passing
- [ ] No orphaned records found
