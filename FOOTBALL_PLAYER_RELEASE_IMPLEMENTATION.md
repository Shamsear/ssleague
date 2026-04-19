# Football Player Release Implementation

## Summary

Updated the football player release functionality to match the real player release system with manual refund percentage, mid-season support, transaction logging, and team balance updates. Also updated UI to show eCoin instead of dollar signs and position instead of star ratings for football players.

## What Was Implemented

### 1. New API Endpoint: `/api/players/release-football-player`

Created a comprehensive release API that mirrors the real player release functionality:

**Features:**
- Manual refund percentage (0-100%)
- Release timing support (start vs mid-season)
- Calculates refund: `Math.round(acquisition_value * (refundPercentage / 100))`
- Updates footballplayers table (sets team_id=NULL, status='free_agent', is_sold=false)
- Updates contract_end_season to release point (e.g., SSPSLS16.5 for mid-season)
- Closes player_history record with 'release' status
- Removes from team_players table
- Updates team balance in Firebase team_seasons (football_budget field)
- Logs transaction in Firebase transactions collection with all details

**Request Body:**
```json
{
  "playerId": "string",
  "seasonId": "string",
  "releaseTiming": "start" | "mid",
  "refundPercentage": 0-100,
  "releasedBy": "string",
  "releasedByName": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Player released successfully",
  "data": {
    "player_name": "string",
    "player_id": "string",
    "old_team": "string",
    "release_season": "string",
    "release_timing": "start" | "mid",
    "contract_info": {
      "original_start": "string",
      "original_end": "string",
      "new_end": "string",
      "acquisition_value": number
    },
    "refund_info": {
      "total_half_seasons": number,
      "elapsed_half_seasons": number,
      "remaining_half_seasons": number,
      "refund_percentage": "string",
      "refund_amount": number
    }
  }
}
```

### 2. New Component: `ReleaseFootballPlayerForm`

Created a dedicated release form component with:

**UI Features:**
- Player selection with searchable dropdown
- Release timing selector (Season Start / Mid-Season)
- Refund percentage slider (0-100% in 5% increments)
- Real-time refund calculation preview
- Contract information display
- Detailed refund preview card showing:
  - Acquisition value
  - Refund percentage
  - Calculated refund amount
  - Team that will receive the refund
- Confirmation dialog with all details
- Success/error messaging

**Form Fields:**
- Player selection (only shows players with teams and acquisition values)
- Release timing (start/mid)
- Refund percentage (slider with visual feedback)

### 3. Updated Main Transfers Page

Modified `app/dashboard/committee/players/transfers/page.tsx`:

**Changes:**
- Added import for `ReleaseFootballPlayerForm`
- Added tab navigation for football players (Swap / Release)
- Separated swap and release into different tabs
- Added help text explaining how football player release works
- Maintains existing swap functionality in FootballPlayerForm

**Football Player Tabs:**
1. **Swap Players** - Uses existing FootballPlayerForm (swap only)
2. **Release Player** - Uses new ReleaseFootballPlayerForm (with refund percentage)

## Database Updates

### footballplayers Table
```sql
UPDATE footballplayers
SET 
  team_id = NULL,
  status = 'free_agent',
  is_sold = false,
  contract_end_season = 'SSPSLS16.5', -- or current season
  updated_at = NOW()
WHERE player_id = ? AND season_id = ?
```

### player_history Table
```sql
UPDATE player_history 
SET 
  status = 'released',
  end_date = NOW(),
  end_reason = 'release',
  contract_end_season = 'SSPSLS16.5', -- or current season
  updated_at = NOW()
WHERE player_id = ? AND team_id = ? AND status = 'active'
```

### team_players Table
```sql
DELETE FROM team_players
WHERE player_id = ? AND season_id = ?
```

## Firebase Updates

### team_seasons Collection
```javascript
{
  football_budget: currentBalance + refundAmount,
  updated_at: new Date()
}
```

### transactions Collection
```javascript
{
  transaction_type: 'release',
  player_id: string,
  player_name: string,
  player_type: 'football',
  team_id: string,
  team_name: string,
  season_id: string,
  release_timing: 'start' | 'mid',
  release_season: string,
  refund_amount: number,
  refund_percentage: number,
  acquisition_value: number,
  original_contract_start: string,
  original_contract_end: string,
  total_half_seasons: number,
  elapsed_half_seasons: number,
  remaining_half_seasons: number,
  processed_by: string,
  processed_by_name: string,
  created_at: Date
}
```

## Key Features

### 1. Manual Refund Percentage
- Committee admin can set any percentage from 0-100%
- Slider interface with 5% increments
- Real-time calculation preview
- Same logic as real player release

### 2. Mid-Season Support
- Season start: Contract ends at current season (e.g., SSPSLS16)
- Mid-season: Contract ends at X.5 (e.g., SSPSLS16.5)
- Clearly displayed in UI and confirmation dialog

### 3. Transaction Logging
- All releases logged in Firebase transactions collection
- Includes all contract details, refund info, and half-season calculations
- Same format as real player releases for consistency

### 4. Team Balance Updates
- Refund automatically added to team's football_budget
- Updates reflected immediately in Firebase
- Transaction logged for audit trail

### 5. Player History Integration
- Closes active player_history record
- Sets status to 'released'
- Updates contract_end_season to release point
- Maintains complete ownership history

## User Flow

1. Navigate to Committee → Player Transfers
2. Select "⚽ Football Players" tab
3. Select "🔓 Release Player" tab
4. Search and select player to release
5. Choose release timing (Season Start / Mid-Season)
6. Adjust refund percentage slider (default 75%)
7. Review refund preview card
8. Click "🔓 Release Player"
9. Confirm in dialog with all details
10. Success message shows refund amount
11. Page reloads to show updated data

## Files Created/Modified

### Created:
- `app/api/players/release-football-player/route.ts` - New release API endpoint
- `app/dashboard/committee/players/transfers/ReleaseFootballPlayerForm.tsx` - New release form component
- `FOOTBALL_PLAYER_RELEASE_IMPLEMENTATION.md` - This documentation

### Modified:
- `app/dashboard/committee/players/transfers/page.tsx` - Added tabs and new release form for football players
- `app/dashboard/committee/players/transfers/FootballPlayerForm.tsx` - Simplified to only handle swaps (removed release functionality), added position field and eCoin display
- `components/ui/SearchablePlayerSelect.tsx` - Added support for football players with eCoin display and position instead of star rating

## UI Updates

### SearchablePlayerSelect Component
Updated to support both real and football players:
- Added `playerType` prop ('real' | 'football')
- Added `acquisition_value` field for football players (in addition to `auction_value` for real players)
- Added `position` field for football players
- Shows "eCoin" for football players and "$" for real players
- Shows position for football players and star rating for real players
- Uses `getPlayerValue()` helper to get correct value based on player type

### Display Changes
- **Currency**: Football players show "1000 eCoin" instead of "$1000"
- **Player Info**: Football players show position (e.g., "CF", "GK") instead of star rating
- **Fallback**: Uses `position_group` if `position` is null, then 'N/A' if both are null

## Testing Checklist

- [ ] Release player at season start with 100% refund
- [ ] Release player at mid-season with 75% refund
- [ ] Release player with 0% refund
- [ ] Verify team balance updated correctly
- [ ] Verify transaction logged in Firebase
- [ ] Verify player_history closed correctly
- [ ] Verify player becomes free agent
- [ ] Verify contract_end_season updated correctly
- [ ] Test with player without acquisition_value (should fail gracefully)
- [ ] Test with player already released (should fail gracefully)

## Comparison with Real Player Release

| Feature | Real Player | Football Player | Status |
|---------|-------------|-----------------|--------|
| Manual refund % | ✅ | ✅ | Implemented |
| Mid-season support | ✅ | ✅ | Implemented |
| Transaction logging | ✅ | ✅ | Implemented |
| Team balance update | ✅ (real_player_budget) | ✅ (football_budget) | Implemented |
| Contract end update | ✅ | ✅ | Implemented |
| Player history | ❌ (N/A) | ✅ | Implemented |
| Free agent creation | ✅ (player_seasons) | ✅ (footballplayers) | Implemented |
| Future season updates | ✅ | ❌ (Not needed) | N/A |

## Notes

- Football players don't have future season records like real players, so no need to update future seasons
- The old `/api/players/release` endpoint still exists for backward compatibility but should not be used for new releases
- The FootballPlayerForm component still handles swaps and bulk releases (unchanged)
- All refund calculations use the same logic as real player releases
- Transaction type is 'release' with player_type='football' to distinguish from real player releases

## Next Steps

1. Test the new release functionality thoroughly
2. Update any documentation or user guides
3. Consider deprecating the old `/api/players/release` endpoint for football players
4. Monitor transaction logs to ensure all data is captured correctly
5. Consider adding release history view in the UI
