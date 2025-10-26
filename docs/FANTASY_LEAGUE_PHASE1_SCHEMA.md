# Fantasy League Phase 1: Database Schema Updates

## Overview
This document outlines the database schema changes needed to support:
- Manager names for teams
- Fantasy league opt-in/opt-out
- Weekly lineup management
- Captain/Vice-Captain system
- Team performance bonuses
- Dual point tracking

---

## 1. Teams Collection Updates (Firebase)

### Existing Schema:
```typescript
{
  id: string;
  team_name: string;
  team_code: string;
  team_logo_url: string;
  owner_uid: string;
  season_id: string;
  seasons: string[]; // Array of season IDs
  current_season_id: string;
  created_at: timestamp;
  updated_at: timestamp;
}
```

### NEW Fields to Add:
```typescript
{
  // ... existing fields ...
  
  // NEW FIELDS:
  manager_name: string; // Required - Team manager's name (not displayed publicly)
  
  // Fantasy League Participation
  fantasy_participating: boolean; // Whether team opted into fantasy league
  fantasy_joined_at: timestamp | null; // When team joined fantasy league
  fantasy_league_id: string | null; // Current fantasy league ID
  
  // Fantasy Points Tracking
  fantasy_player_points: number; // Points from drafted players
  fantasy_team_bonus_points: number; // Points from team performance
  fantasy_total_points: number; // Sum of above two
}
```

### Migration Script:
```typescript
// Add default values to existing teams
const teams = await db.collection('teams').get();
const batch = db.batch();

teams.forEach(doc => {
  const ref = doc.ref;
  batch.update(ref, {
    manager_name: '', // Will be filled during next registration
    fantasy_participating: false, // Default: not participating
    fantasy_joined_at: null,
    fantasy_league_id: null,
    fantasy_player_points: 0,
    fantasy_team_bonus_points: 0,
    fantasy_total_points: 0
  });
});

await batch.commit();
```

---

## 2. Fantasy Teams Collection Updates (Firestore)

### Existing Schema:
```typescript
{
  id: string;
  fantasy_league_id: string;
  team_id: string; // Links to real team
  team_name: string;
  owner_name: string;
  owner_uid: string;
  total_points: number; // OLD - will be replaced
  rank: number;
  player_count: number;
  created_at: timestamp;
  updated_at: timestamp;
}
```

### UPDATED Schema:
```typescript
{
  // ... existing fields except total_points ...
  
  // REMOVED:
  // total_points: number; // Being replaced
  
  // NEW FIELDS:
  affiliated_real_team_id: string; // Links to real team (same as team_id)
  affiliated_team_name: string; // Cached for display
  
  // Dual Point Tracking
  fantasy_player_points: number; // Points from drafted players only
  fantasy_team_bonus_points: number; // Points from team performance only
  fantasy_total_points: number; // Sum of above two
  
  // Weekly tracking
  last_lineup_update: timestamp | null;
  current_matchday_points: number;
}
```

### Migration Script:
```typescript
// Update existing fantasy teams
const fantasyTeams = await db.collection('fantasy_teams').get();
const batch = db.batch();

fantasyTeams.forEach(doc => {
  const data = doc.data();
  const ref = doc.ref;
  
  batch.update(ref, {
    // Copy team_id to affiliated fields
    affiliated_real_team_id: data.team_id,
    affiliated_team_name: data.team_name,
    
    // Convert old total_points to player_points
    fantasy_player_points: data.total_points || 0,
    fantasy_team_bonus_points: 0,
    fantasy_total_points: data.total_points || 0,
    
    // New tracking fields
    last_lineup_update: null,
    current_matchday_points: 0
  });
});

await batch.commit();
```

---

## 3. NEW Collection: fantasy_lineups

### Purpose:
Track weekly lineup selections including captain/vice-captain choices.

### Schema:
```typescript
{
  id: string; // Auto-generated
  fantasy_league_id: string; // Reference to fantasy league
  fantasy_team_id: string; // Reference to fantasy team
  matchday: number; // Week number (1, 2, 3, ...)
  season_id: string; // Reference to season
  
  // Lineup Structure (11 starters)
  starters: {
    forwards: string[]; // Array of 2 player IDs
    midfielders: string[]; // Array of 3 player IDs
    defenders: string[]; // Array of 3 player IDs
    goalkeeper: string; // Single player ID
  };
  
  // Captain System
  captain_id: string; // Player who gets 2x points
  vice_captain_id: string; // Backup if captain doesn't play
  
  // Bench (remaining players)
  bench: string[]; // Array of player IDs
  bench_order: number[]; // Priority order for auto-substitutions
  
  // Lock Status
  is_locked: boolean; // True after deadline
  locked_at: timestamp | null; // When lineup was locked
  lock_deadline: timestamp; // When lineup will lock
  
  // Points Tracking (calculated after matches)
  player_points: number; // Points from players in lineup
  captain_bonus: number; // Extra points from captain multiplier
  team_bonus_points: number; // Bonus from affiliated team performance
  total_points: number; // Sum of all points
  
  // Metadata
  created_at: timestamp;
  updated_at: timestamp;
  submitted_at: timestamp | null; // When user last saved lineup
}
```

### Indexes:
```typescript
// Firestore composite indexes needed:
- fantasy_league_id + matchday
- fantasy_team_id + matchday
- fantasy_league_id + is_locked
- matchday + is_locked
```

### Collection Rules (firestore.rules):
```javascript
match /fantasy_lineups/{lineupId} {
  // Anyone in league can read
  allow read: if isSignedIn();
  
  // Team owner can create their lineup
  allow create: if isSignedIn() && 
    request.resource.data.fantasy_team_id in get(/databases/$(database)/documents/fantasy_teams/$(request.resource.data.fantasy_team_id)).data.owner_uid;
  
  // Team owner can update ONLY if not locked
  allow update: if isSignedIn() && 
    resource.data.fantasy_team_id in get(/databases/$(database)/documents/fantasy_teams/$(resource.data.fantasy_team_id)).data.owner_uid &&
    resource.data.is_locked == false;
  
  // Only admins can delete
  allow delete: if isAdmin();
}
```

---

## 4. NEW Collection: fantasy_team_bonuses

### Purpose:
Track passive bonuses awarded based on affiliated team performance.

### Schema:
```typescript
{
  id: string; // Auto-generated
  fantasy_league_id: string; // Reference to fantasy league
  fantasy_team_id: string; // Reference to fantasy team
  affiliated_real_team_id: string; // Real team that earned bonus
  
  matchday: number; // When bonus was earned
  season_id: string; // Reference to season
  
  // Bonus Details
  bonus_type: 'win' | 'clean_sheet' | 'high_scoring' | 'weekly_top' | 'winning_streak';
  points_awarded: number; // How many points given
  reason: string; // Human-readable description
  
  // Trigger Information
  trigger_match_id: string | null; // Match that triggered bonus (if applicable)
  trigger_data: {
    home_team: string;
    away_team: string;
    score: string;
    result: 'win' | 'draw' | 'loss';
  } | null;
  
  // Metadata
  awarded_at: timestamp;
  calculated_by: string; // 'system' or admin UID
}
```

### Indexes:
```typescript
// Firestore composite indexes needed:
- fantasy_league_id + matchday
- fantasy_team_id + matchday
- affiliated_real_team_id + matchday
- bonus_type + matchday
```

### Collection Rules (firestore.rules):
```javascript
match /fantasy_team_bonuses/{bonusId} {
  // Anyone can read bonuses
  allow read: if isSignedIn();
  
  // Only system (admin) can create bonuses
  allow create: if isAdmin();
  
  // Only admins can update/delete
  allow update, delete: if isAdmin();
}
```

---

## 5. Bonus Rules Configuration

### Default Bonus Values:
```typescript
const DEFAULT_BONUS_RULES = {
  WIN: {
    points: 5,
    description: 'Team wins match'
  },
  
  CLEAN_SHEET: {
    points: 3,
    description: 'Team keeps clean sheet (0 goals conceded)',
    condition: 'goals_conceded === 0'
  },
  
  HIGH_SCORING: {
    points: 2,
    description: 'Team scores 5+ goals in a match',
    condition: 'goals_scored >= 5'
  },
  
  DRAW: {
    points: 1,
    description: 'Team draws match'
  },
  
  WEEKLY_TOP: {
    points: 10,
    description: 'Affiliated team is #1 in standings at week end',
    frequency: 'weekly'
  },
  
  WINNING_STREAK: {
    points: 5,
    description: 'Team wins 3 consecutive matches',
    condition: 'consecutive_wins >= 3'
  },
  
  TOP_SCORER: {
    points: 3,
    description: 'Affiliated team has highest-scoring player of the week',
    frequency: 'weekly'
  }
};
```

---

## 6. Fantasy Scoring Rules Updates

### Add Position-Specific Scoring:

Update `fantasy_scoring_rules` collection to include:

```typescript
{
  // ... existing fields ...
  
  // NEW FIELDS:
  applies_to_positions: string[]; // ['FWD', 'MID', 'DEF', 'GK']
  multiplier: number; // e.g., 1.5 for away goals
  conditions: {
    min_value?: number; // e.g., 3 for hat-trick
    opponent_rank?: string; // 'top4', 'bottom4'
    home_away?: 'home' | 'away';
  } | null;
}
```

### Example Rules:
```typescript
const POSITION_SPECIFIC_RULES = [
  {
    rule_type: 'goals_scored',
    points_value: 5,
    applies_to_positions: ['FWD'],
    description: 'Forward goal'
  },
  {
    rule_type: 'goals_scored',
    points_value: 7,
    applies_to_positions: ['MID'],
    description: 'Midfielder goal (harder to score)'
  },
  {
    rule_type: 'goals_scored',
    points_value: 10,
    applies_to_positions: ['DEF'],
    description: 'Defender goal (rare!)'
  },
  {
    rule_type: 'goals_scored',
    points_value: 8,
    applies_to_positions: ['GK'],
    description: 'Goalkeeper goal (very rare!)'
  },
  {
    rule_type: 'clean_sheet',
    points_value: 6,
    applies_to_positions: ['GK'],
    description: 'Goalkeeper clean sheet'
  },
  {
    rule_type: 'clean_sheet',
    points_value: 4,
    applies_to_positions: ['DEF'],
    description: 'Defender clean sheet'
  },
  {
    rule_type: 'clean_sheet',
    points_value: 1,
    applies_to_positions: ['MID'],
    description: 'Midfielder clean sheet bonus'
  },
  {
    rule_type: 'hat_trick',
    points_value: 5,
    applies_to_positions: ['FWD', 'MID', 'DEF', 'GK'],
    conditions: { min_value: 3 },
    description: 'Hat-trick bonus (3+ goals)'
  },
  {
    rule_type: 'yellow_card',
    points_value: -1,
    applies_to_positions: ['FWD', 'MID', 'DEF', 'GK'],
    description: 'Yellow card penalty'
  },
  {
    rule_type: 'red_card',
    points_value: -3,
    applies_to_positions: ['FWD', 'MID', 'DEF', 'GK'],
    description: 'Red card penalty'
  }
];
```

---

## 7. Type Definitions

### TypeScript Interfaces:

Create `/types/fantasy.ts`:

```typescript
// Team with fantasy fields
export interface TeamWithFantasy {
  id: string;
  team_name: string;
  team_code: string;
  team_logo_url: string;
  owner_uid: string;
  manager_name: string; // NEW
  season_id: string;
  
  // Fantasy participation
  fantasy_participating: boolean; // NEW
  fantasy_joined_at: number | null; // NEW
  fantasy_league_id: string | null; // NEW
  
  // Fantasy points
  fantasy_player_points: number; // NEW
  fantasy_team_bonus_points: number; // NEW
  fantasy_total_points: number; // NEW
  
  created_at: any;
  updated_at: any;
}

// Updated fantasy team
export interface FantasyTeam {
  id: string;
  fantasy_league_id: string;
  team_id: string;
  team_name: string;
  owner_name: string;
  owner_uid: string;
  
  // Affiliation
  affiliated_real_team_id: string; // NEW
  affiliated_team_name: string; // NEW
  
  // Dual points
  fantasy_player_points: number; // NEW
  fantasy_team_bonus_points: number; // NEW
  fantasy_total_points: number; // NEW (replaces total_points)
  
  rank: number;
  player_count: number;
  
  // Weekly tracking
  last_lineup_update: any | null; // NEW
  current_matchday_points: number; // NEW
  
  created_at: any;
  updated_at: any;
}

// Weekly lineup
export interface FantasyLineup {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  matchday: number;
  season_id: string;
  
  starters: {
    forwards: string[]; // 2 players
    midfielders: string[]; // 3 players
    defenders: string[]; // 3 players
    goalkeeper: string; // 1 player
  };
  
  captain_id: string;
  vice_captain_id: string;
  
  bench: string[];
  bench_order: number[];
  
  is_locked: boolean;
  locked_at: any | null;
  lock_deadline: any;
  
  player_points: number;
  captain_bonus: number;
  team_bonus_points: number;
  total_points: number;
  
  created_at: any;
  updated_at: any;
  submitted_at: any | null;
}

// Team bonus
export interface FantasyTeamBonus {
  id: string;
  fantasy_league_id: string;
  fantasy_team_id: string;
  affiliated_real_team_id: string;
  
  matchday: number;
  season_id: string;
  
  bonus_type: 'win' | 'clean_sheet' | 'high_scoring' | 'weekly_top' | 'winning_streak';
  points_awarded: number;
  reason: string;
  
  trigger_match_id: string | null;
  trigger_data: {
    home_team: string;
    away_team: string;
    score: string;
    result: 'win' | 'draw' | 'loss';
  } | null;
  
  awarded_at: any;
  calculated_by: string;
}

// Bonus rules
export const BONUS_RULES = {
  WIN: 5,
  CLEAN_SHEET: 3,
  HIGH_SCORING: 2,
  DRAW: 1,
  WEEKLY_TOP: 10,
  WINNING_STREAK: 5,
  TOP_SCORER: 3
} as const;

// Position requirements
export const LINEUP_REQUIREMENTS = {
  FORWARDS: 2,
  MIDFIELDERS: 3,
  DEFENDERS: 3,
  GOALKEEPER: 1,
  TOTAL_STARTERS: 9,
  MAX_BENCH: 6,
  MAX_ROSTER: 15
} as const;
```

---

## 8. Migration Checklist

- [ ] Update `teams` collection schema (add new fields)
- [ ] Update `fantasy_teams` collection schema (dual points)
- [ ] Create `fantasy_lineups` collection
- [ ] Create `fantasy_team_bonuses` collection
- [ ] Update `fantasy_scoring_rules` (position-specific)
- [ ] Create TypeScript type definitions
- [ ] Update Firestore security rules
- [ ] Add Firestore composite indexes
- [ ] Run migration scripts on existing data
- [ ] Test data integrity

---

## 9. Rollback Plan

If migration fails:

```typescript
// Rollback script
async function rollbackPhase1() {
  // Remove new fields from teams
  const teams = await db.collection('teams').get();
  const batch1 = db.batch();
  teams.forEach(doc => {
    batch1.update(doc.ref, {
      manager_name: FieldValue.delete(),
      fantasy_participating: FieldValue.delete(),
      fantasy_joined_at: FieldValue.delete(),
      fantasy_league_id: FieldValue.delete(),
      fantasy_player_points: FieldValue.delete(),
      fantasy_team_bonus_points: FieldValue.delete(),
      fantasy_total_points: FieldValue.delete()
    });
  });
  await batch1.commit();
  
  // Restore total_points in fantasy_teams
  const fantasyTeams = await db.collection('fantasy_teams').get();
  const batch2 = db.batch();
  fantasyTeams.forEach(doc => {
    const data = doc.data();
    batch2.update(doc.ref, {
      total_points: data.fantasy_total_points || 0,
      affiliated_real_team_id: FieldValue.delete(),
      affiliated_team_name: FieldValue.delete(),
      fantasy_player_points: FieldValue.delete(),
      fantasy_team_bonus_points: FieldValue.delete(),
      fantasy_total_points: FieldValue.delete(),
      last_lineup_update: FieldValue.delete(),
      current_matchday_points: FieldValue.delete()
    });
  });
  await batch2.commit();
  
  // Delete new collections
  // (Manual deletion or bulk delete via Firebase console)
}
```

---

## Status: ✅ READY FOR IMPLEMENTATION

Next Steps:
1. Review and approve schema changes
2. Run migration scripts
3. Update Firestore rules
4. Add indexes
5. Proceed to Phase 2 (Registration Flow Updates)
