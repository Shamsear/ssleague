# Player Detail Page Documentation

## Overview
The Player Detail Page displays comprehensive information about a football player including their stats, attributes, team acquisition details, and player card with photo.

## File Structure
```
app/
  dashboard/
    committee/
      players/
        [id]/
          page.tsx          # Player detail page with dynamic route
        page.tsx            # All players list (with links to detail page)
```

## Features

### 1. Player Information Card
- **Player Photo**: Displays player image from `/images/player_photos/{player_id}.png`
  - Falls back to position initial if image not available
- **Overall Rating Badge**: Shows rating in bottom-right corner
- **Position Badge**: Color-coded by position (QB, RB, WR, TE, K, DST)
- **Basic Details**:
  - Nationality
  - Playing Style
  - Preferred Foot
  - Age

### 2. Acquisition Details
Shows how the player was acquired by a team:
- **Team**: Current team name or "Free Agent" status
- **Cost**: Acquisition value or "Free Transfer"
- **Acquired On**: Date of acquisition (if available)
- **Acquired Via**: Round number if acquired via auction

### 3. Overall Rating Display
- Large circular badge with color-coded gradient:
  - Elite (85+): Green gradient
  - Excellent (75-84): Blue gradient
  - Good (65-74): Yellow gradient
  - Below 65: Gray gradient
- Rating label (Elite/Excellent/Good/Unrated)

### 4. Position-Based Key Attributes
Displays 6 key stats relevant to the player's position with animated progress bars:

#### Goalkeeper (GK)
- GK Awareness
- GK Catching
- GK Parrying
- GK Reflexes
- GK Reach
- Defensive Awareness

#### Defenders (CB, RB, LB)
- Defensive Awareness
- Tackling
- Defensive Engagement
- Physical Contact
- Ball Control
- Speed

#### Defensive Midfielder (DMF)
- Defensive Awareness
- Tackling
- Ball Control
- Low Pass
- Stamina
- Physical Contact

#### Central Midfielder (CMF)
- Ball Control
- Low Pass
- Lofted Pass
- Offensive Awareness
- Dribbling
- Stamina

#### Wide Midfielders (RMF, LMF)
- Speed
- Acceleration
- Dribbling
- Ball Control
- Lofted Pass
- Tight Possession

#### Attacking Midfielder (AMF)
- Offensive Awareness
- Ball Control
- Dribbling
- Tight Possession
- Low Pass
- Finishing

#### Second Striker (SS)
- Offensive Awareness
- Finishing
- Ball Control
- Dribbling
- Speed
- Acceleration

#### Center Forward (CF)
- Finishing
- Offensive Awareness
- Physical Contact
- Heading
- Ball Control
- Kicking Power

#### Default (Other Positions)
- Speed
- Ball Control
- Dribbling
- Offensive Awareness
- Stamina
- Physical Contact

### 5. Additional Statistics
Displays any other numeric player stats not shown in the key attributes section in a grid layout.

### 6. Stats Bars
- Animated progress bars showing stat values (0-100)
- Color-coded by value:
  - 85+: Green
  - 75-84: Blue
  - 65-74: Yellow
  - Below 65: Gray
- Animation triggers 200ms after page load

## Access Control
- **Required Role**: `committee_admin`
- Redirects to login if not authenticated
- Redirects to dashboard if not committee admin

## Data Flow

### 1. Fetch Player Data
```typescript
// From Firestore 'footballplayers' collection
const playerRef = doc(db, 'footballplayers', params.id)
const playerSnap = await getDoc(playerRef)
```

### 2. Fetch Team Data (if applicable)
```typescript
// If player has team_id, fetch team details
if (data.team_id) {
  const teamRef = doc(db, 'teams', data.team_id)
  const teamSnap = await getDoc(teamRef)
}
```

### 3. Calculate Dynamic Stats
- Position-based key stats selection
- Additional stats filtering (excludes main stats and metadata)

## UI/UX Features

### Responsive Design
- **Mobile**: Single column layout with player ID at top
- **Desktop**: Two-column layout (player info left, stats right)
- Back button hidden on mobile

### Loading States
- Spinner with "Loading player details..." message
- Smooth transitions

### Error Handling
- Image fallback to position initial
- "Player not found" alert redirects to players list
- Team fetch errors logged but don't break page

### Visual Effects
- Glass morphism design
- Hover effects on acquisition cards
- Animated progress bars
- Gradient backgrounds
- Shadow effects

## Navigation
- **Back Button**: Returns to `/dashboard/committee/players`
- **From Players List**: View Details icon links to detail page

## Database Schema

### footballplayers Collection
```typescript
{
  id: string                    // Firestore document ID
  player_id: string             // Display player ID
  name: string
  position: string
  overall_rating: number
  team_id?: string              // Reference to teams collection
  nationality?: string
  playing_style?: string
  foot?: string
  age?: number
  nfl_team?: string
  acquisition_value?: number
  acquired_at?: Timestamp
  round_id?: string
  is_auction_eligible?: boolean
  
  // Stats (all optional)
  speed?: number
  acceleration?: number
  ball_control?: number
  dribbling?: number
  tackling?: number
  finishing?: number
  // ... many more stat fields
}
```

### teams Collection
```typescript
{
  id: string
  team_name: string
  name?: string  // Fallback field
}
```

## Usage

### Accessing the Page
1. Navigate to Committee Dashboard
2. Click "All Players" card
3. Search/filter for player
4. Click eye icon (View Details) for any player

### Direct URL
```
/dashboard/committee/players/[player_id]
```

## Future Enhancements
- Performance history display (data structure not yet in Firestore)
- Edit player functionality
- Player comparison feature
- Export player stats
- Print player card

## Related Files
- `app/dashboard/committee/players/page.tsx` - Players list page
- `app/dashboard/committee/page.tsx` - Committee dashboard
- `lib/firebase/config.ts` - Firebase configuration
- `contexts/AuthContext.tsx` - Authentication context

## Notes
- Player photos should be stored as PNG files in `public/images/player_photos/`
- Filename format: `{player_id}.png`
- Stats are filtered to show only position-relevant attributes
- All numeric stats are displayed as percentages (0-100 scale)
