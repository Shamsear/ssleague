# RealPlayer Firestore Structure Update

## Overview
Updated the Firestore `realplayers` collection structure to match the SQLAlchemy `RealPlayer` model while preserving existing stats functionality.

## Changes Made

### 1. Updated TypeScript Types (`types/realPlayer.ts`)

#### RealPlayerData Interface
Combined SQLAlchemy model fields with existing Firestore fields:

**SQLAlchemy Model Fields (NEW):**
- `name`: Player's full name (required)
- `team`: Previous/current team name as string (not team_id reference)
- `season_id`: Season association after registration
- `category_id`: Player category for bulk assignment
- `team_id`: Assigned team (Firestore reference)
- `is_registered`: Boolean flag for season registration
- `registered_at`: Timestamp when player registered for season
- `created_at`: When player was added to system

**Existing Fields (PRESERVED):**
- `player_id`: Unique ID (sspslpsl0001, sspslpsl0002, etc.)
- `display_name`: Nickname or preferred name
- `email`, `phone`: Contact information
- `role`: Player role (captain, vice_captain, player)
- `is_active`, `is_available`: Status flags
- `stats`: Complete statistics object (RealPlayerStats)
- `psn_id`, `xbox_id`, `steam_id`: Gaming platform IDs
- `profile_image`: Profile picture
- `joined_date`: When joined
- `assigned_by`: UID of admin who assigned
- `notes`: Admin notes

**Populated Fields:**
- `season_name`: Fetched from season lookup
- `category_name`: Fetched from category lookup (TODO: implement category collection)
- `team_name`, `team_code`: Fetched from team lookup

### 2. Updated Firebase Functions (`lib/firebase/realPlayers.ts`)

#### Modified Functions:
1. **getAllRealPlayers()** - Added category_name lookup
2. **getRealPlayersByTeam()** - Added category_name support
3. **getRealPlayersBySeason()** - Added category_name support
4. **getRealPlayerById()** - Added category_name lookup
5. **createRealPlayer()** - Updated to store new SQLAlchemy fields

#### Key Changes in createRealPlayer:
```typescript
const newPlayer = {
  player_id: playerId,
  
  // SQLAlchemy model fields
  name: playerData.name,
  team: playerData.team || null, // Previous/current team name
  season_id: playerData.season_id || null,
  category_id: playerData.category_id || null,
  team_id: playerData.team_id || null, // Assigned team reference
  is_registered: playerData.is_registered || false,
  registered_at: playerData.is_registered ? serverTimestamp() : null,
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
  
  // Additional fields (preserved)
  display_name: playerData.display_name || null,
  email: playerData.email || null,
  phone: playerData.phone || null,
  role: playerData.role || 'player',
  is_active: true,
  is_available: true,
  stats: initializeStats(), // Stats preserved!
  psn_id: playerData.psn_id || null,
  xbox_id: playerData.xbox_id || null,
  steam_id: playerData.steam_id || null,
  profile_image: null,
  joined_date: serverTimestamp(),
  assigned_by: assignedBy || null,
  notes: playerData.notes || null,
};
```

## Firestore Collection Structure

### Collection: `realplayers`
**Document ID:** Custom player ID (e.g., `sspslpsl0001`)

```typescript
{
  // Identity
  player_id: string; // Same as document ID
  
  // Core SQLAlchemy fields
  name: string; // Required
  team: string | null; // Previous team name (not ID)
  season_id: string | null;
  category_id: string | null;
  team_id: string | null; // Assigned team (Firestore reference)
  is_registered: boolean;
  registered_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  
  // Extended profile
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'captain' | 'vice_captain' | 'player';
  is_active: boolean;
  is_available: boolean;
  
  // Statistics (preserved!)
  stats: {
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    matches_drawn: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    win_rate: number;
    average_rating: number;
    current_season_matches: number;
    current_season_wins: number;
  };
  
  // Gaming platforms
  psn_id: string | null;
  xbox_id: string | null;
  steam_id: string | null;
  profile_image: string | null;
  
  // Metadata
  joined_date: Timestamp;
  assigned_by: string | null; // Admin UID
  notes: string | null;
}
```

## Key Differences from SQLAlchemy Model

### Additions (Firestore has these, SQLAlchemy doesn't):
- `display_name`: Nickname
- `email`, `phone`: Contact info
- `role`: Team role
- `is_active`, `is_available`: Status flags
- `stats`: Complete statistics object
- `psn_id`, `xbox_id`, `steam_id`: Gaming IDs
- `profile_image`: Profile picture
- `joined_date`: Join timestamp
- `assigned_by`: Admin who assigned
- `notes`: Admin notes

### Matching Fields:
- `player_id`: Unique identifier
- `name`: Player name
- `team`: Previous/current team name
- `season_id`: Season reference
- `category_id`: Category reference
- `team_id`: Assigned team reference
- `is_registered`: Registration flag
- `registered_at`: Registration timestamp
- `created_at`: Creation timestamp

## TODO: Category Collection

Currently, `category_id` is stored but `category_name` fallbacks to the ID. Need to implement:

1. Create `categories` collection in Firestore
2. Implement `getCategoryById()` function
3. Update all query functions to fetch actual category names

## Migration Notes

If you have existing `realplayers` documents in Firestore, you'll need to migrate them:

1. Add `name` field (copy from `full_name` if it exists)
2. Add `team` field (nullable)
3. Add `category_id` field (nullable)
4. Add `is_registered` field (default: false)
5. Add `registered_at` field (nullable)
6. Ensure `stats` object exists (use `initializeStats()` if missing)

## Benefits

1. **Unified Structure**: Firestore now matches your SQLAlchemy model
2. **Stats Preserved**: All existing statistics functionality remains intact
3. **Extended Data**: Additional fields provide richer player profiles
4. **Registration Tracking**: Clear tracking of player registration status
5. **Category Support**: Ready for player categorization system
6. **Backwards Compatible**: Existing stats and profile features still work

## Usage Example

```typescript
import { createRealPlayer, getRealPlayerById } from '@/lib/firebase/realPlayers';

// Create a new player
const newPlayer = await createRealPlayer({
  name: "John Doe",
  team: "Previous Team FC", // Team name, not ID
  season_id: "season123",
  category_id: "categoryA",
  team_id: null, // Not assigned yet
  is_registered: true,
  display_name: "JD",
  email: "john@example.com",
  phone: "+1234567890",
  role: "player",
  psn_id: "john_psn",
  notes: "Excellent striker"
}, "admin_uid_123");

// Fetch player
const player = await getRealPlayerById("sspslpsl0001");
console.log(player.name); // "John Doe"
console.log(player.stats); // { matches_played: 0, ... }
console.log(player.is_registered); // true
```

## Next Steps

1. **Create Category Collection**: Implement categories for player bulk assignment
2. **Migration Script**: Create script to migrate existing players
3. **UI Updates**: Update forms to include new fields (name, team, category_id, is_registered)
4. **Registration Flow**: Implement player self-registration with invite codes
5. **Bulk Assignment**: Implement category-based bulk player assignment to teams
