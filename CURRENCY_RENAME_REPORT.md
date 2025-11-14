# Currency Rename Report: Football → eCoin, Real Player → SSCoin

## Current System

The application currently uses a **dual currency system** with the following naming:

### Current Names:
- **€ (Euro/Football)** - Used for virtual football players from FIFA/FC
- **$ (Dollar/Real Player)** - Used for real-life players

### Database Fields:
```
team_seasons (Firebase):
- football_budget
- football_spent
- real_player_budget
- real_player_spent

teams (Neon PostgreSQL):
- football_budget
- football_spent
```

## Proposed Changes

### New Names:
- **eCoin** (replaces € Football) - For virtual football players
- **SSCoin** (replaces $ Real Player) - For real-life players

## Affected Areas

### 1. Database Schema

#### **Neon PostgreSQL**
Files: `database/migrations/`
- ❌ `add-budget-columns-to-teams.sql` - Column names and comments
- Field names:
  - `football_budget` → `ecoin_budget`
  - `football_spent` → `ecoin_spent`
  - Need to add: `sscoin_budget`, `sscoin_spent`

#### **Firebase Firestore**
Collection: `team_seasons`
- Field names:
  - `football_budget` → `ecoin_budget`
  - `football_spent` → `ecoin_spent`
  - `real_player_budget` → `sscoin_budget`
  - `real_player_spent` → `sscoin_spent`

### 2. Backend API Endpoints (54 files)

**High Priority - Core APIs:**
- `/app/api/team/dashboard/route.ts` - Team dashboard data (4 occurrences)
- `/app/api/team/bids/route.ts` - Bid submission (4 occurrences)
- `/app/api/team/transactions/route.ts` - Transaction history (5 occurrences)
- `/app/api/rounds/[id]/route.ts` - Round management (6 occurrences)
- `/app/api/seasons/[id]/register/route.ts` - Season registration (14 occurrences)
- `/app/api/contracts/assign*.ts` - Contract assignments (multiple files)

**Medium Priority - Admin/Committee:**
- `/app/api/admin/bulk-rounds/[id]/finalize/route.ts` - Round finalization (4 occurrences)
- `/app/api/admin/fix-budgets/route.ts` - Budget fixes (2 occurrences)
- `/app/api/admin/refund-salaries/route.ts` - Salary refunds (2 occurrences)
- All tiebreaker-related endpoints (multiple files)

**Total Backend Files:** ~54 files with 150+ occurrences

### 3. Frontend UI Components (35 files)

**Dashboard Components:**
- `/app/dashboard/team/RegisteredTeamDashboard.tsx` - Main team dashboard (12 occurrences)
  - Budget display cards
  - Transaction labels
  - Stats displays
  
- `/app/dashboard/team/budget-planner/page.tsx` - Budget planning (9 occurrences)
- `/app/dashboard/team/transactions/page.tsx` - Transaction history (6 occurrences)
- `/app/dashboard/team/profile/page.tsx` - Team profile (5 occurrences)
- `/app/dashboard/team/contracts/page.tsx` - Contract management (2 occurrences)

**Committee/Admin Dashboards:**
- `/app/dashboard/committee/teams/page.tsx` - Team management (7 occurrences)
- `/app/dashboard/committee/team-contracts/page.tsx` - Contract oversight (5 occurrences)
- `/app/dashboard/superadmin/seasons/create/page.tsx` - Season creation (4 occurrences)

**Total Frontend Files:** ~35 files with 100+ occurrences

### 4. TypeScript Types

**Type Definitions:**
- `/types/team.ts` - Team type definitions (2 occurrences)
- `/types/season.ts` - Season type definitions (2 occurrences)

### 5. Utility Libraries

**Core Logic:**
- `/lib/firebase/multiSeasonTeams.ts` - Multi-season team management (19 occurrences)
- `/lib/firebase/multiSeasonPlayers.ts` - Player management (13 occurrences)
- `/lib/finalize-round.ts` - Round finalization logic (5 occurrences)
- `/lib/player-transfers.ts` - Transfer system (10 occurrences)
- `/lib/player-transfers-neon.ts` - Neon-specific transfers (10 occurrences)
- `/lib/finalize-bulk-tiebreaker.ts` - Tiebreaker logic (5 occurrences)

### 6. Scripts & Migrations (15+ files)

**Utility Scripts:**
- `/scripts/fix-team-balances.ts` - Balance fixes (9 occurrences)
- `/scripts/reset-team-budgets.ts` - Budget resets (5 occurrences)
- `/scripts/migrate-season16-to-dual-currency.js` - Migration script (8 occurrences)
- Multiple other utility scripts

### 7. UI Labels & Display Text

**Text Changes Required:**

#### Current Labels → New Labels:
| Current | New |
|---------|-----|
| "€ Football" | "eCoin" |
| "$ Real" | "SSCoin" |
| "Football Budget" | "eCoin Budget" |
| "Real Player Budget" | "SSCoin Budget" |
| "€ Football Player" | "eCoin (Virtual Player)" |
| "$ Real Player" | "SSCoin (Real Player)" |
| "euro_balance" | "ecoin_balance" |
| "dollar_balance" | "sscoin_balance" |

### 8. Documentation Files (20+ files)

**Markdown Documentation:**
- `MULTI_SEASON_CONTRACT_SYSTEM.md`
- `IMPLEMENTATION_COMPLETE_SUMMARY.md`
- `TESTING_GUIDE.md`
- `README_MULTI_SEASON_SYSTEM.md`
- Multiple other implementation docs

## Summary Statistics

### Total Changes Required:
- **150+ files** need modifications
- **400+ occurrences** of field names
- **200+ UI labels** need text changes
- **15+ database migrations/scripts** need updates
- **50+ TypeScript type definitions** need updates

### Breakdown by Area:
1. **Backend APIs**: 54 files, ~150 occurrences
2. **Frontend Components**: 35 files, ~100 occurrences  
3. **Libraries**: 10 files, ~60 occurrences
4. **Scripts**: 15 files, ~40 occurrences
5. **Documentation**: 20+ files, ~50 occurrences
6. **Database**: 3 migration files
7. **Types**: 2 type definition files

## Critical Paths

### High-Risk Changes (Test Thoroughly):
1. **Payment/Transaction Logic** - All money-related calculations
2. **Round Finalization** - Budget deductions and refunds
3. **Contract Assignments** - Salary deductions
4. **Team Registration** - Initial budget allocation
5. **Player Transfers** - Cross-currency validations

### Low-Risk Changes:
1. **Display Labels** - Pure UI text
2. **Documentation** - No functional impact
3. **Comments** - Code clarity only

## Recommended Approach

### Phase 1: Database Migration
1. Create migration scripts for both Neon and Firebase
2. Add new columns alongside old ones
3. Copy data from old to new fields
4. Verify data integrity

### Phase 2: Backend Update
1. Update all API endpoints to use new field names
2. Maintain backward compatibility temporarily
3. Update all library functions
4. Update TypeScript types

### Phase 3: Frontend Update
1. Update all UI components
2. Change all display labels
3. Update form fields and validations

### Phase 4: Cleanup
1. Remove old database columns
2. Remove backward compatibility code
3. Update all documentation
4. Final testing

## Risk Assessment

⚠️ **HIGH RISK**: This is a major refactoring that touches critical payment/transaction logic across the entire application.

### Risks:
- Data loss if migration fails
- Budget calculation errors
- Transaction history corruption
- UI/backend field mismatch
- Backward compatibility issues

### Mitigation:
- Full database backup before migration
- Gradual rollout with both systems running
- Extensive testing of all transaction flows
- Feature flags for rollback capability
- Comprehensive test suite execution

## Recommendation

**DO NOT PROCEED WITHOUT:**
1. ✅ Full database backup (Firebase + Neon)
2. ✅ Comprehensive test plan
3. ✅ Staging environment testing
4. ✅ Rollback strategy
5. ✅ User notification plan

**Estimated Effort:** 3-5 days of focused development + testing

---

**Status:** 📋 REPORT COMPLETE - Awaiting approval to proceed with changes
