# Fixture Lineup Structure

## Firestore Collections

### fixtures/{fixtureId}
```typescript
{
  // ... existing fixture fields
  home_lineup_submitted_at?: Timestamp,
  away_lineup_submitted_at?: Timestamp,
  home_lineup?: {
    players: [
      {
        player_id: string,        // realplayer ID
        player_name: string,
        position: number,          // 1-6
        is_substitute: boolean,    // true for 1 player
      }
    ],
    locked: boolean,
    submitted_by: string,        // user_id
    submitted_at: Timestamp,
  },
  away_lineup?: {
    players: [
      {
        player_id: string,
        player_name: string,
        position: number,
        is_substitute: boolean,
      }
    ],
    locked: boolean,
    submitted_by: string,
    submitted_at: Timestamp,
  }
}
```

## Phase Rules

### HOME FIXTURE PHASE (before home_deadline)
- Home team can submit/edit lineup
- Away team cannot access

### AWAY FIXTURE PHASE (after home_deadline, before away_deadline)
- If home submitted → Home can edit, Away cannot
- If home NOT submitted → Away can submit/edit, Home cannot
- **First to submit gets exclusive edit rights**

### LOCKED (after away_deadline)
- Both teams locked
- No lineup changes
- Only swaps/subs/results allowed
