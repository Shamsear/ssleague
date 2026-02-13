# Tournament-Based Trophies Implementation

## Overview
Updated the trophy system to award trophies based on different tournaments in the season, rather than just the main league standings.

## Changes Made

### 1. Updated Trophy Awarding Logic (`lib/award-season-trophies.ts`)

The system now:
- Fetches all tournaments for a season
- Processes each tournament based on its format:
  - **League Format**: Awards trophies to top N teams (Winner, Runner Up, Third Place, etc.)
  - **Knockout Format**: Awards Winner and Runner Up based on the final match
  - **Group Stage Format**: Awards winners for each group

#### Key Functions:
- `awardSeasonTrophies()` - Main function that processes all tournaments
- `awardLeagueTrophies()` - Awards trophies for league-format tournaments
- `awardKnockoutTrophies()` - Awards trophies for knockout tournaments (finds final and determines winner/runner-up)
- `awardGroupStageTrophies()` - Awards group winners
- `calculateStandings()` - Helper to calculate standings from fixtures

### 2. Updated Preview Function

The `previewSeasonTrophies()` function now:
- Shows trophies that would be awarded for ALL tournaments
- Groups preview by tournament
- Checks if trophies are already awarded
- Supports all tournament formats

### 3. Updated UI (`app/dashboard/committee/trophies/page.tsx`)

#### Preview Section:
- Groups trophies by tournament name
- Shows tournament name as a header for each group
- Displays which teams would receive trophies for each tournament

#### Awarded Trophies Section:
- Groups awarded trophies by tournament
- Shows tournament name with a colored border
- Makes it easy to see which tournaments have been awarded

#### Trophy Options:
- Fetches tournament names from the database
- Uses actual tournament names instead of hardcoded values
- Allows custom trophy names for special awards

## How It Works

### Auto-Award Process:
1. Click "Auto-Award Trophies" button
2. System fetches all tournaments for the season
3. For each tournament:
   - Gets completed fixtures
   - Determines format (league/knockout/group)
   - Calculates winners based on format
   - Inserts trophies into database
4. Shows success message with count of trophies awarded

### Manual Award:
1. Click "Add Trophy" button
2. Select team from dropdown
3. Select tournament name (fetched from database)
4. Select trophy type and position
5. Add optional notes
6. Submit to award trophy

## Database Structure

Trophies are stored with:
- `trophy_name`: Tournament name (e.g., "UCL", "League", "FA Cup")
- `trophy_position`: Position achieved (e.g., "Winner", "Runner Up", "Third Place")
- `trophy_type`: Type of trophy (cup, runner_up, third_place, special)
- `tournament_name`: Full tournament name for grouping

## Benefits

1. **Flexible**: Supports any tournament format (league, knockout, group stage)
2. **Automatic**: Awards trophies based on actual tournament results
3. **Organized**: Groups trophies by tournament for better visualization
4. **Accurate**: Uses tournament standings and knockout results
5. **Scalable**: Works with any number of tournaments in a season

## Usage

### For Committee:
1. Complete all fixtures for tournaments
2. Go to Trophy Management page
3. Review preview of trophies to be awarded
4. Click "Auto-Award Trophies"
5. Trophies are awarded based on tournament results

### For Teams:
- View trophies grouped by tournament
- See which tournaments they won
- Trophy cabinet shows all achievements across all tournaments

## Example Output

```
🏆 League
  - Manchester United - Winner
  - Liverpool - Runner Up

🏆 UCL
  - Real Madrid - Winner
  - Bayern Munich - Runner Up

🏆 FA Cup
  - Arsenal - Winner
  - Chelsea - Runner Up
```

## Notes

- Trophies are only awarded for completed fixtures
- Knockout trophies require a completed final
- Group stage trophies are awarded to group winners
- Duplicate trophies are prevented by database constraint
- Manual trophies can be added for special awards
