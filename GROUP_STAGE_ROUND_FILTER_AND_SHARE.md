# Group Stage Round Filter and Share Feature

## Issue
Group stage tournaments (Champions League, Pro League) were missing:
1. Round-by-round filtering (Round 1, Round 2, etc.)
2. Image download/share functionality

These features were only available for league format tournaments.

## Changes Made

### 1. TournamentStandings Component (`components/tournament/TournamentStandings.tsx`)

#### Round Selector
- **Extended to group stage**: Changed condition from `showLeagueStandings` to `(showLeagueStandings || showGroupStandings)`
- Now both league and group stage tournaments show the round filter
- Allows viewing standings after specific rounds (e.g., "After Round 3")

#### ShareableLeaderboard Feature
- **Extended to group stage**: Now shows for both formats
- Updated condition to check for both `standings` (league) and `groupStandings` (group stage)
- Passes appropriate props based on format

### 2. ShareableLeaderboard Component (`components/tournament/ShareableLeaderboard.tsx`)

#### Interface Updates
- **Added `GroupTeam` interface**: Supports group stage team data structure
- **Made `standings` optional**: Can now accept either `standings` or `groupStandings`
- **Added `groupStandings` prop**: Accepts group stage data as `Record<string, GroupTeam[]>`

#### Group Stage Support
- **Added group selector**: Dropdown to select which group to generate image for
- **Dynamic standings**: Uses `currentStandings` that switches between league/group data
- **Group-aware title**: Shows "GROUP A STANDINGS" instead of "LEADERBOARD" for group stage
- **Maintains all features**: Download, share, preview work for both formats

#### State Management
- **Added `selectedGroup` state**: Tracks which group is selected for image generation
- **Auto-initialization**: Automatically selects first group when component loads
- **Group switching**: Users can switch between groups before generating image

## Features Now Available for Group Stage

### 1. Round Filtering
- **All Rounds button**: Shows current overall standings
- **Individual rounds**: R1, R2, R3, etc. buttons
- **Mobile dropdown**: Responsive selector for small screens
- **Info text**: Shows which round is being filtered

### 2. Image Generation
- **Group selector**: Choose which group to generate image for
- **Preview**: See the image before downloading
- **Download**: Save as PNG file
- **Share**: Use native share API (mobile) or fallback to download
- **Professional design**: Black header with yellow title, clean table layout

## How It Works

### For League Format (unchanged)
1. Select round filter (optional)
2. Click "Preview Image" to see the leaderboard
3. Click "Download Image" or "Share Image"
4. Image includes all teams in league standings

### For Group Stage Format (new)
1. Select round filter (optional) - affects all groups
2. Select which group to generate image for (A, B, C, D, etc.)
3. Click "Preview Image" to see the group standings
4. Click "Download Image" or "Share Image"
5. Image includes teams from selected group only

## Visual Example

### Group Stage with Round Filter
```
🎯 Filter by Round: [📊 All Rounds] [R1] [R2] [R3] [R4]

📸 Share Leaderboard
Select Group: [Group A] [Group B] [Group C] [Group D]
[Preview Image] [Download Image] [Share Image]
```

### Generated Image Shows
- Tournament name (e.g., "SS SUPER LEAGUE S16 CHAMPIONS LEAGUE")
- Group identifier (e.g., "GROUP A STANDINGS")
- Round info if filtered (e.g., "AFTER ROUND 3")
- Complete standings table with team logos
- All statistics (P, MP, W, D, L, F, A, GD, %, EP)

## Testing
1. Navigate to Champions League or Pro League standings
2. Verify round selector appears at the top
3. Click different rounds and verify standings update
4. Verify "Share Leaderboard" section appears
5. Select a group (A, B, C, or D)
6. Click "Preview Image" and verify correct group shows
7. Click "Download Image" and verify PNG downloads
8. Test on mobile for share functionality

## Files Modified
- `components/tournament/TournamentStandings.tsx`
- `components/tournament/ShareableLeaderboard.tsx`

## Benefits
- **Consistency**: Group stage now has same features as league format
- **Flexibility**: Can view and share standings at any point in the tournament
- **Professional**: Generated images look polished and shareable
- **User-friendly**: Easy to switch between groups and rounds
