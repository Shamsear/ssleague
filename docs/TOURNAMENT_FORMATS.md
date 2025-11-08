# Tournament Format System

## Overview
The tournament system now supports three explicit format options that can be combined:
- **⚽ League Stage** - Round-robin format
- **🏆 Group Stage** - Teams divided into groups
- **🥇 Knockout Stage** - Playoff bracket

## Format Combinations

### 1. League Only
- **Checkboxes**: League ✅, Group ❌, Knockout ❌
- **Use Case**: Traditional league where all teams play each other
- **Fixtures**: Round-robin (single or double-legged)
- **Example**: English Premier League

### 2. League + Knockout
- **Checkboxes**: League ✅, Group ❌, Knockout ✅
- **Use Case**: League followed by playoffs
- **Fixtures**: Round-robin league, then playoff bracket
- **Example**: MLS regular season + playoffs

### 3. Group Stage Only
- **Checkboxes**: League ❌, Group ✅, Knockout ❌
- **Use Case**: Teams divided into groups, each plays within their group
- **Fixtures**: Round-robin within each group
- **Settings**: Number of groups, teams per group, teams advancing
- **Example**: World Cup group stage only

### 4. Group Stage + Knockout (Champions League Style)
- **Checkboxes**: League ❌, Group ✅, Knockout ✅
- **Use Case**: Groups followed by knockout bracket
- **Fixtures**: Round-robin within groups, then playoff bracket for qualifiers
- **Example**: UEFA Champions League

### 5. Pure Knockout
- **Checkboxes**: League ❌, Group ❌, Knockout ✅
- **Use Case**: Direct elimination tournament
- **Fixtures**: Playoff bracket only (powers of 2: 4, 8, 16, 32 teams)
- **Auto-set**: `is_pure_knockout: true`
- **Example**: FA Cup knockout rounds

## Mutual Exclusivity
- **League and Group stages are mutually exclusive** - you can have one or the other, not both
- **Knockout can be combined with either** League or Group
- At least one stage must be enabled

## Database Fields

### Tournament Table
```sql
has_league_stage BOOLEAN DEFAULT true
has_group_stage BOOLEAN DEFAULT false
has_knockout_stage BOOLEAN DEFAULT false
is_pure_knockout BOOLEAN DEFAULT false  -- Auto-computed

-- Group Stage Settings
number_of_groups INTEGER DEFAULT 4
teams_per_group INTEGER DEFAULT 4
teams_advancing_per_group INTEGER DEFAULT 2

-- Knockout Stage Settings
playoff_teams INTEGER DEFAULT 4
direct_semifinal_teams INTEGER DEFAULT 2
qualification_threshold INTEGER DEFAULT 75
```

## Fixture Generation Logic

### League Fixtures
```typescript
generateRoundRobinFixtures(tournamentId, seasonId, teams, isTwoLegged)
```
- Round-robin algorithm
- Handles odd number of teams (bye)
- Generates first and second legs if `isTwoLegged: true`
- Fixture ID format: `{tournamentId}_leg{1|2}_r{round}_m{match}`

### Group Stage Fixtures
```typescript
generateGroupStageFixtures(tournamentId, seasonId, teams, numberOfGroups, isTwoLegged)
```
- Divides teams evenly into groups (A, B, C, D...)
- Round-robin within each group
- Fixture ID format: `{tournamentId}_grp{A|B|C}_leg{1|2}_r{round}_m{match}`
- Stores `group_name` field

### Knockout Fixtures
```typescript
generateKnockoutFixtures(tournamentId, seasonId, teams, playoffTeams)
```
- Creates bracket with power-of-2 teams (2, 4, 8, 16, 32)
- First round has actual teams assigned
- Later rounds have TBD placeholders: `Winner R{round}M{match}`
- Fixture ID format: `{tournamentId}_ko_r{round}_m{match}`
- Stores `knockout_round` field (Final, Semi-Final, Quarter-Final, etc.)
- Status: `scheduled` (first round) or `pending` (future rounds)

## API Behavior

### POST `/api/tournaments/{id}/fixtures`
1. Validates tournament has at least one stage enabled
2. Checks tournament format fields:
   - `has_league_stage`
   - `has_group_stage`
   - `is_pure_knockout`
3. Generates appropriate fixtures based on format
4. Returns error if no fixtures generated

### Validation
- Minimum 2 teams required
- Must have at least one stage enabled
- Fixtures can only be generated once (must delete first to regenerate)

## UI Form Behavior

### Create/Edit Tournament Forms
The checkboxes automatically enforce mutual exclusivity:

```typescript
// When League is checked
onChange={(e) => {
  const checked = e.target.checked;
  setTournament({ 
    has_league_stage: checked,
    // Automatically uncheck Group if League is checked
    has_group_stage: checked ? false : tournament.has_group_stage
  });
}}

// When Group is checked
onChange={(e) => {
  const checked = e.target.checked;
  setTournament({ 
    has_group_stage: checked,
    // Automatically uncheck League if Group is checked
    has_league_stage: checked ? false : tournament.has_league_stage
  });
}}
```

### Auto-Computed Fields
The system automatically computes `is_pure_knockout`:
```typescript
const isPureKnockout = has_knockout_stage && !has_league_stage && !has_group_stage;
```

### Conditional Configuration Panels
- **Group Stage Settings** appear when `has_group_stage: true`
- **Knockout Stage Settings** appear when `has_knockout_stage: true`

## Future Enhancements

### League + Knockout Progression
Currently generates league fixtures only. To add knockout after league:
1. Complete league stage
2. Determine qualified teams based on standings
3. Generate knockout fixtures for qualified teams

### Group + Knockout Progression
Currently generates group fixtures only. To add knockout after groups:
1. Complete group stage
2. Determine qualified teams from each group (based on `teams_advancing_per_group`)
3. Generate knockout fixtures for qualified teams

### Third-Place Playoff
Add option for 3rd place match in knockout tournaments.

### Two-Legged Knockout
Add support for home-and-away knockout ties (currently single match).

## Migration

If you have existing tournaments without `has_league_stage`:
```sql
-- Run migration: scripts/migrations/add-league-stage-field.ts
-- Sets has_league_stage = true for existing league tournaments
-- Sets has_league_stage = false for existing group/knockout tournaments
```
