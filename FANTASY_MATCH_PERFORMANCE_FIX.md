# Fantasy Match-by-Match Performance Fix ✅

## Problem
The match-by-match performance display was showing incorrect point values using old hardcoded rules:
- Goals (6): 30pts ❌ (was using 5 pts/goal instead of 2)
- Clean Sheet: 4pts ❌ (should be 6pts)
- MOTM: 3pts ❌ (should be 5pts)
- Win: 2pts ❌ (should be 3pts)

## Root Cause
The committee fantasy teams page (`app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx`) had hardcoded scoring values:

```typescript
// ❌ OLD - Hardcoded values
const goalPoints = (match.goals_scored || 0) * 5;  // Wrong!
const cleanSheetPoints = match.clean_sheet ? 4 : 0;  // Wrong!
const motmPoints = match.motm ? 3 : 0;  // Wrong!
const resultPoints = match.result === 'win' ? 2 : match.result === 'draw' ? 1 : 0;  // Wrong!
```

## Solution

### 1. Created Scoring Rules API
**File**: `app/api/fantasy/scoring-rules/route.ts`
- Fetches active scoring rules from `fantasy_scoring_rules` table
- Filters by league_id
- Returns only active rules

### 2. Updated Fantasy Teams Page
**File**: `app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx`

**Added state for scoring rules:**
```typescript
const [scoringRules, setScoringRules] = useState<any>(null);
```

**Fetch rules on page load:**
```typescript
useEffect(() => {
  const loadScoringRules = async () => {
    const response = await fetchWithTokenRefresh(`/api/fantasy/scoring-rules?league_id=${leagueId}`);
    // Convert to map for easy lookup
    const rulesMap = {};
    data.rules?.forEach((rule) => {
      if (rule.applies_to === 'player') {
        rulesMap[rule.rule_type] = rule.points_value;
      }
    });
    setScoringRules(rulesMap);
  };
  loadScoringRules();
}, [leagueId]);
```

**Updated calculation to use database rules:**
```typescript
// ✅ NEW - Uses database values
const goalPoints = (match.goals_scored || 0) * (scoringRules.goals_scored || 0);
const cleanSheetPoints = match.clean_sheet ? (scoringRules.clean_sheet || 0) : 0;
const motmPoints = match.motm ? (scoringRules.motm || 0) : 0;
const resultPoints = match.result === 'win' ? (scoringRules.win || 0) : ...;
const appearancePoints = scoringRules.match_played || 0;
const hatTrickPoints = (match.goals_scored >= 3) ? scoringRules.hat_trick : 0;
const concedePoints = (match.goals_conceded >= 4) ? scoringRules.concedes_4_plus_goals : 0;
```

## Correct Display Now

With database rules (from `fantasy_scoring_rules` table):
- **Goals (6)**: 12pts ✅ (6 × 2 = 12)
- **Clean Sheet**: 6pts ✅
- **MOTM**: 5pts ✅
- **Win**: 3pts ✅
- **Draw**: 1pt ✅
- **Appearance**: 1pt ✅
- **Hat-trick (3+ goals)**: +5pts ✅
- **Concede 4+ goals**: -3pts ✅

## Files Changed
1. `app/api/fantasy/scoring-rules/route.ts` - New API endpoint
2. `app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx` - Updated to use database rules

## Testing
1. Navigate to Committee → Fantasy → Teams → Select a team
2. Expand a player to see match-by-match performance
3. Point breakdown should now show correct values from database

The match-by-match performance now displays accurate points based on the scoring rules configured in the database! 🎉
