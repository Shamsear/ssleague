# Player Statistics Documentation

## Overview
This document describes all the statistics that are saved for a player in the database and how they are displayed in the player detail page.

## Database Structure

### Player Data (realplayers collection)
Each player document contains the following fields:

#### Basic Information
- `player_id` - Unique player identifier (format: sspslpsl0001, sspslpsl0002, etc.)
- `name` - Player's full name
- `display_name` - Nickname or preferred name
- `email` - Email address
- `phone` - Phone number
- `photo_url` - Profile photo URL
- `nationality` - Player's nationality
- `age` - Player's age
- `height` - Height in cm
- `weight` - Weight in kg

#### Team & Season Assignment
- `team` - Previous/current team name (string)
- `team_id` - Reference to assigned team document
- `season_id` - Reference to season document
- `category` - Player category (e.g., Red, Black, Blue, Orange, White)

#### Status & Registration
- `is_registered` - Whether player has registered for a season
- `is_active` - Whether player is currently active
- `is_available` - Whether player is available for matches
- `registered_at` - Timestamp of registration
- `created_at` - When player was added to system
- `updated_at` - Last update timestamp

#### Gaming Platform IDs
- `psn_id` - PlayStation Network ID
- `xbox_id` - Xbox ID
- `steam_id` - Steam ID

#### Awards & Recognition
- `is_potm` - Whether player is current Player of the Month
- `potm_awards` - Array of POTM awards with month and year
- `ranking` - League ranking position

### Statistics Object (stats field)
The `stats` field contains a nested object with the following statistics:

#### Match Statistics
- `matches_played` - Total matches played
- `matches_won` - Total matches won
- `matches_lost` - Total matches lost
- `matches_drawn` - Total matches drawn

#### Performance Metrics
- `goals_scored` - Total goals scored
- `assists` - Total assists
- `clean_sheets` - Total clean sheets

#### Goals Statistics (calculated/stored)
- `goals_conceded` - Total goals conceded
- `goals_per_game` - Average goals scored per match
- `conceded_per_game` - Average goals conceded per match
- `net_goals` - Goal difference (goals scored - goals conceded)

#### Points & Ratings
- `points` - Total league points
- `total_points` - Alternative field for total points
- `win_rate` - Win percentage (calculated)
- `average_rating` - Average match rating

#### Season-Specific Stats
- `current_season_matches` - Matches in current season
- `current_season_wins` - Wins in current season

### Round Performance
- `round_performance` - Object containing performance data by round/stage with:
  - `matches` - Number of matches in that round
  - `wins` - Wins in that round
  - `losses` - Losses in that round
  - `draws` - Draws in that round
  - `goals` - Goals scored in that round
  - `goals_conceded` - Goals conceded in that round
  - `goal_difference` - Goal difference in that round
  - `potm_count` - Times named POTM in that round
  - `points` - Points earned in that round

## Display Organization

### Tab Structure
The player detail page has a dynamic tab structure:

#### 1. Overall Stats Tab (Default)
First tab - Shows aggregated statistics across all seasons:
- **Purpose**: Career summary - "How good is this player overall?"
- **Display**: Combined totals from all season records
- **Stats Shown**:
  - Total Points (career total)
  - Main Stats Grid: Matches, Goals, Assists, Clean Sheets
  - Secondary Stats: Win Rate (%), Goals/Game, Average Rating
  - Goal Statistics: Goals Conceded, Goal Difference, Goals For
  - Performance Metrics: Progress bars for goals/game and win percentage
- **Does NOT show**:
  - Round Performance (career view doesn't break down by rounds)
  - Match History (too many matches across all seasons)
  - League Ranking (only relevant for current season)

#### 2. All Seasons Tab
Second tab - Shows a season-by-season breakdown:
- **Purpose**: Compare performance across seasons - "How has this player improved?"
- **Display**: List of season cards, one for each season
- **Each Season Card Shows**:
  - Season name (fetched from seasons collection) and team
  - "CURRENT" badge for most recent season
  - Matches played, W-D-L record
  - Goals scored and points
  - Goals conceded, net goals, and clean sheets
- **Order**: Reverse chronological (newest season first)

#### 3. Individual Season Tabs (Dynamic)
One tab for each season the player participated in:
- **Tab Label**: Shows season name (e.g., "Season 14") with green dot for current season
- **Display**: Full statistics for that specific season
- **Stats Shown**:
  - Total Points with League Ranking (for current season only)
  - Main Stats Grid: Matches, Goals, Assists, Clean Sheets
  - Secondary Stats: Win Rate (%), Goals/Game, Average Rating
  - Goal Statistics: Goals Conceded, Goal Difference, Goals For
  - Performance Metrics: Progress bars
  - **Round Performance**: Detailed breakdown by round/stage (individual season only)
  - **Match History**: List of all matches in that season (individual season only)
- **Purpose**: Deep dive into a specific season's performance

**Example Tab Bar:**
```
[Overall Stats] [All Seasons (3)] | [Season 14 ●] [Season 13] [Season 12]
```
The pipe (|) represents a visual divider between overview tabs and season-specific tabs.
The green dot (●) indicates the current/most recent season.

### Left Sidebar (Visible in all tabs)
- **Player Photo/Avatar**
- **Basic Information**:
  - Name
  - Team
  - Category badge
  - Nationality, Age, Height, Weight (if available)
- **Overall Record Card**:
  - Win/Draw/Loss counts
  - Goals Scored, Goals Conceded, Goal Difference
  - Points
  - Clean Sheets
- **POTM Awards** (if any)

## Key Features

### Dynamic Tab System
- **Overview Tabs**: Overall Stats and All Seasons always appear first
- **Season Tabs**: Individual tabs created dynamically for each season
- **Visual Separation**: A divider separates overview tabs from season-specific tabs
- **Current Season Indicator**: Green dot shows which season is the current one

### Season-Specific Content
- Only **Individual Season tabs** show:
  - Round Performance details (detailed breakdown by round/stage)
  - Match History (all matches in that season)
  - League Ranking (for current season only)
- This ensures users can focus on specific season performance without clutter

### Multiple Season Support
- Players can have records across multiple seasons
- Each season record is stored as a separate document with the same `player_id`
- The system automatically:
  - Fetches all season records
  - Creates a tab for each season
  - Aggregates stats for the Overall view

### Dynamic Season Names
- Season names are fetched from the seasons collection on page load
- Names are cached in the season data objects
- Displayed in:
  - Tab labels (e.g., "Season 14" instead of season ID)
  - Section headers
  - All Seasons breakdown cards
- Provides better user experience and clarity

### Visual Hierarchy
- Points are emphasized with a highlighted gradient background
- Goal statistics use color coding (green for positive, red for negative)
- Performance metrics include visual progress bars
- Interactive hover effects on stat cards

## Data Flow

1. **Fetch Player Data**: Query realplayers collection by player_id to get all season records
2. **Fetch Season Name**: Query seasons collection to get the actual season name
3. **Fetch Match History**: Query match_matchups where player was involved
4. **Calculate Stats**: Aggregate stats for Overall view, calculate derived metrics
5. **Display**: Render appropriate stats based on selected tab

## Notes

- Stats are stored per season in separate documents
- Overall stats are calculated on-the-fly by aggregating all season records
- Match history is fetched from match_matchups collection
- Round performance data structure varies by season/league setup
- Some legacy fields may exist at root level (played, points, goals_scored) for backward compatibility
