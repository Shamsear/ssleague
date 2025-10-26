# 🏆 Fixture Enhancement Plan

## 📋 New Features

### 1. **Swap Match** 🔄
- Teams can rearrange player matchups
- Drag-and-drop or select-based interface
- Works in fixture creation/edit mode

### 2. **Substitution System** 🔁

#### Data Model Updates:
```typescript
interface Matchup {
  // Existing fields...
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  
  // NEW: Substitution tracking
  home_original_player_id?: string;
  home_original_player_name?: string;
  home_substituted?: boolean;
  home_sub_category_penalty?: number; // 0, 1 (for category diff)
  
  away_original_player_id?: string;
  away_original_player_name?: string;
  away_substituted?: boolean;
  away_sub_category_penalty?: number;
}

interface PlayerStats {
  // Existing stats...
  
  // NEW: Substitution tracking
  substituted_out_count: number; // Track how many times subbed out
  substituted_in_count: number;  // Track how many times subbed in
}
```

#### Penalty Rules:
- **Base**: +2 goals to opponent for ANY sub
- **Category**: +1 additional if subbing in HIGHER category
- Example:
  - Cat 2 out → Cat 1 in = +3 to opponent
  - Cat 2 out → Cat 2 in = +2 to opponent
  - Cat 2 out → Cat 3 in = +2 to opponent

#### Process:
1. Select matchup to substitute
2. Choose replacement player
3. System calculates penalty based on categories
4. Update matchup with new player
5. Add penalty goals to opponent's team score
6. Track substitution in both players' stats

### 3. **Extra/Fine Goals** ⚽➕

#### Data Model:
```typescript
interface Fixture {
  // Existing fields...
  
  // NEW: Penalty goals tracking
  home_penalty_goals?: number;  // Goals from fines/violations
  away_penalty_goals?: number;
  
  penalty_log?: {
    team: 'home' | 'away';
    goals: number;
    reason?: string;
    added_by: string;
    added_at: string;
  }[];
}
```

#### Rules:
- Added by teams or committee
- Goes to team total ONLY
- NOT in player stats
- NOT counted for POTM
- Separate display in results

## 🛠️ Implementation Steps

### Phase 1: Data Model Updates
- [ ] Update Matchup interface
- [ ] Update Fixture interface
- [ ] Update PlayerStats interface
- [ ] Create substitution utility functions

### Phase 2: UI Components
- [ ] Swap matchup interface
- [ ] Substitution modal
- [ ] Penalty goals input
- [ ] Visual indicators for subs/penalties

### Phase 3: Logic Updates
- [ ] Calculate substitution penalties
- [ ] Update result calculation (exclude penalties from POTM)
- [ ] Track substitution stats
- [ ] Update WhatsApp share format

### Phase 4: Permissions
- [ ] Teams can sub their own players
- [ ] Committee can sub any player
- [ ] Teams can add penalty goals (self)
- [ ] Committee can add penalty goals (any team)

## 📊 Score Calculation

### Current Total:
```
Team Score = Sum of (Player Goals in each matchup)
```

### New Total:
```
Team Score = Sum of (Player Goals) 
           + Penalty Goals (from fines)
           + Substitution Penalty Goals (received from opponent's subs)
```

### POTM Calculation:
```
// EXCLUDE penalty goals from POTM criteria
POTM = Player with highest individual match performance
       (only considers goals scored by players, not penalties/fines)
```

## 🎨 UI Mockup

### Result Entry Screen:
```
┌─────────────────────────────────────────┐
│ Matchup 1                               │
│ Player A vs Player B                    │
│ [6 min] [Goals: 2-1]                    │
│ [🔄 Swap] [🔁 Sub] [⚽ Result]          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Team Penalty Goals                      │
│ Home: [+0] [Add Fine]                   │
│ Away: [+2] [Add Fine]                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Final Score                             │
│ Home: 10 (8 player + 0 penalties + 2 sub)│
│ Away: 8  (6 player + 2 penalties + 0 sub)│
└─────────────────────────────────────────┘
```

## ✅ Testing Checklist
- [ ] Swap matchups without issues
- [ ] Sub same category (+2 penalty)
- [ ] Sub higher category (+3 penalty)
- [ ] Sub lower category (+2 penalty)
- [ ] Penalty goals don't affect player stats
- [ ] POTM excludes penalties
- [ ] WhatsApp share shows all details
- [ ] Substitution stats tracked correctly
