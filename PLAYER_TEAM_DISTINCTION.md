# Player Team Distinction

## Overview
This document clarifies the distinction between a player's **Real Club** and their **Tournament Team** assignment in the system.

---

## Two Types of Team Affiliations

### 1. **Real Club** (Informational Only)
- **Field Names**: `team_name`, `club`, `nfl_team`
- **Purpose**: Stores the player's real-world club affiliation
- **Examples**: "Manchester United", "Barcelona", "Bayern Munich"
- **Source**: Imported from SQLite database when bulk importing players
- **Usage**: Display only - provides context about the player's actual club
- **NOT Used For**: Tournament logic, team assignments, or player ownership

### 2. **Tournament Team** (Functional)
- **Field Names**: `team_id`, `team` (object with id and name)
- **Purpose**: Tracks which tournament team currently owns/has acquired the player
- **Examples**: "Team Alpha", "Dream Strikers", "Goal Hunters"
- **Source**: Assigned when a team bids on/acquires a player during an auction
- **Usage**: Determines player ownership, eligibility, and team rosters
- **Used For**: All tournament logic, player restrictions, team management

---

## How They Work Together

```
┌─────────────────────────────────────────┐
│         Player Database Record          │
├─────────────────────────────────────────┤
│  name: "Cristiano Ronaldo"              │
│  position: "CF"                          │
│  overall_rating: 91                      │
│                                          │
│  Real Club (Informational):             │
│  └─ team_name: "Al Nassr"              │
│                                          │
│  Tournament Team (Functional):          │
│  └─ team_id: "abc123"                   │
│  └─ team: {                             │
│       id: "abc123",                     │
│       name: "Dream Strikers"            │
│     }                                    │
│  └─ acquisition_value: 5000000         │
│  └─ acquired_at: 2024-01-15            │
└─────────────────────────────────────────┘
```

---

## UI Display

### Import Preview Page
- Column labeled: **"Real Club"** with info icon (ⓘ)
- Tooltip: "Real-world club affiliation (informational only)"
- Shows: `team_name` or `club` field from database

### Player Detail Page
#### Left Panel (Player Info Card)
- **Real Club** field (highlighted in blue)
  - Shows: `club` or `team_name`
  - Tooltip: "Player's real-world club (informational)"
  - Only displays if data exists

#### Right Panel (Acquisition Details)
- Section title: **"Tournament Team"**
- Subtitle: "Player's assignment in your tournament"
- Shows:
  - **Team**: Tournament team name or "Free Agent"
  - **Cost**: Acquisition value or "Free Transfer"
  - **Acquired On**: Date acquired
  - **Acquired Via**: Auction round information

### Players List Page
- Shows both real club (if available) and tournament team assignment
- Tournament team is linked and functional
- Real club is display-only

---

## Data Flow

### 1. **Player Import** (from SQLite)
```javascript
{
  name: "Player Name",
  position: "CF",
  overall_rating: 85,
  team_name: "Real Madrid",  // ← Real club (kept as-is)
  // No team_id yet - player is a Free Agent
}
```

### 2. **Team Registration**
- Teams register for a season
- Stored in `teams` collection
- Completely separate from player database

### 3. **Player Acquisition** (Auction)
```javascript
{
  name: "Player Name",
  position: "CF",
  overall_rating: 85,
  team_name: "Real Madrid",        // ← Real club (unchanged)
  team_id: "tournament_team_123",  // ← NEW: Acquired by tournament team
  acquisition_value: 3000000,      // ← Acquisition cost
  acquired_at: Timestamp,          // ← When acquired
  round_id: "round_5"              // ← Which auction round
}
```

---

## Database Schema

### Players Collection (`footballplayers`)
```typescript
interface FootballPlayer {
  // Core Info
  player_id: string
  name: string
  position: string
  overall_rating: number
  
  // Real Club (Informational)
  team_name?: string        // Real-world club
  club?: string             // Alternative field name
  nfl_team?: string         // For NFL/American football
  
  // Tournament Team (Functional)
  team_id?: string          // Reference to teams collection
  team?: {                  // Populated tournament team
    id: string
    name: string
  }
  
  // Acquisition Details
  acquisition_value?: number
  acquired_at?: Timestamp
  round_id?: string
  is_auction_eligible: boolean
  
  // Other attributes...
}
```

### Teams Collection (`teams`)
```typescript
interface Team {
  id: string
  team_name: string
  season_id: string
  manager_email: string
  // ... other team fields
}
```

---

## Key Points

1. **Real Club = Informational Context**
   - Imported from external database
   - Never changes during tournament
   - Provides background information

2. **Tournament Team = Functional Assignment**
   - Managed by tournament logic
   - Changes when players are acquired/traded
   - Used for all game mechanics

3. **No Confusion**
   - UI clearly labels each type
   - Different visual styles (real club in blue, tournament team in standard)
   - Tooltips explain the distinction

4. **Import Process**
   - SQLite import preserves `team_name` field
   - Column mapping handles variations: `team_name`, `club`, `current_club`, etc.
   - Tournament team assignment happens separately during auctions

---

## Column Mapping (Import)

The system automatically maps common column name variations:

### Real Club Names (Informational)
- `team_name`
- `team`
- `club`
- `current_club`
- `Team`

### Tournament-Related (Set During Auctions)
- `team_id` (set when acquired)
- Must reference an existing team in `teams` collection

---

## Example Workflow

1. **Import Players**
   ```
   Player: Messi
   Real Club: Inter Miami
   Tournament Team: None (Free Agent)
   ```

2. **Team Registers for Season**
   ```
   Team: "Goal Hunters"
   Season: "2024 Spring League"
   ```

3. **Auction Round**
   ```
   Player: Messi
   Real Club: Inter Miami (unchanged)
   Tournament Team: "Goal Hunters" (newly assigned)
   Acquisition Value: £4,500,000
   ```

4. **Display**
   ```
   Player Detail Page:
   - Real Club: Inter Miami (blue badge, informational)
   - Tournament Team: Goal Hunters (functional, linked)
   - Cost: £4,500,000
   ```

---

## Summary

The distinction ensures:
- **Data integrity**: Real-world information preserved
- **Flexibility**: Tournament assignments independent of real clubs
- **Clarity**: Users understand which team info is which
- **Functionality**: Tournament logic operates on correct team references
