# Round-Wise Knockout Generation

## Overview

The round-wise knockout generation system allows you to create knockout fixtures one round at a time, with complete control over each round's configuration. This is perfect for tournaments where different knockout stages need different settings.

## Features

### Flexible Round Configuration

Each knockout round can have its own:
- **Format**: Single leg, two legs, or round robin
- **Matchup Mode**: Manual or blind lineup
- **Scoring System**: Goal-based or win-based
- **Pairing Method**: Standard seeding, manual order, or random draw

### Supported Knockout Rounds

1. **Quarter Finals** (8 teams)
2. **Semi Finals** (4 teams)
3. **Finals** (2 teams)
4. **Third Place Playoff** (2 teams)

## How to Use

### Step 1: Select Tournament
Navigate to the Fixtures tab and select your tournament from the dropdown.

### Step 2: Configure Round Settings

In the "Round-Wise Knockout Generation" section:

1. **Round Type**: Choose the knockout stage (Quarter Finals, Semi Finals, etc.)
2. **Round Number**: Specify which round number this will be (e.g., Round 12)
3. **Number of Teams**: Select how many teams participate (auto-set based on round type)
4. **Pairing Method**:
   - **Standard**: Traditional seeding (1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5)
   - **Manual**: Teams paired in the order you select them
   - **Random**: Teams randomly paired

### Step 3: Select Teams

1. Click "Load Teams" to fetch all teams in the tournament
2. Click on teams to select them (selection order matters for manual pairing)
3. Selected teams show their selection number
4. You must select exactly the required number of teams

### Step 4: Generate Fixtures

Click "Generate Knockout Round" to create the fixtures. The system will:
- Create fixtures based on your pairing method
- Apply the selected format (single/two leg)
- Use the configured matchup mode and scoring system
- Assign the correct round number and knockout stage

## Example Scenarios

### Scenario 1: Mixed Format Tournament

**Quarter Finals** (Round 12):
- Format: Single Leg
- Mode: Blind Lineup
- Scoring: Goals
- 8 teams → 4 fixtures

**Semi Finals** (Round 13):
- Format: Two Legs
- Mode: Manual
- Scoring: Wins
- 4 teams → 4 fixtures (2 home, 2 away)

**Finals** (Round 14):
- Format: Round Robin
- Mode: Manual
- Scoring: Goals
- 2 teams → 25 fixtures (5v5 all matchups)

### Scenario 2: Progressive Knockout

1. Generate Round of 16 with 16 teams
2. After completion, generate Quarter Finals with top 8 teams
3. Then Semi Finals with top 4 teams
4. Finally Finals with top 2 teams

Each round can have completely different settings!

## Pairing Methods Explained

### Standard Seeding
Best for competitive balance. Pairs strongest with weakest:
- Match 1: Team 1 (1st seed) vs Team 8 (8th seed)
- Match 2: Team 2 (2nd seed) vs Team 7 (7th seed)
- Match 3: Team 3 (3rd seed) vs Team 6 (6th seed)
- Match 4: Team 4 (4th seed) vs Team 5 (5th seed)

### Manual Pairing
You control the matchups by selection order:
- Match 1: 1st selected vs 2nd selected
- Match 2: 3rd selected vs 4th selected
- Match 3: 5th selected vs 6th selected
- Match 4: 7th selected vs 8th selected

### Random Draw
Completely random pairing, like a draw ceremony:
- Teams are shuffled randomly
- Then paired sequentially

## API Endpoint

```
POST /api/tournaments/[tournamentId]/generate-knockout-round
```

### Request Body

```json
{
  "knockout_round": "quarter_finals",
  "round_number": 12,
  "num_teams": 8,
  "knockout_format": "single_leg",
  "scoring_system": "goals",
  "matchup_mode": "blind_lineup",
  "teams": [
    { "team_id": "team1", "team_name": "Team A", "seed": 1 },
    { "team_id": "team2", "team_name": "Team B", "seed": 2 }
  ],
  "pairing_method": "standard",
  "start_date": "2026-02-01",
  "created_by": "user_id",
  "created_by_name": "Admin Name"
}
```

### Response

```json
{
  "success": true,
  "fixtures_created": 4,
  "knockout_round": "quarter_finals",
  "round_number": 12,
  "message": "Successfully created 4 fixtures for quarter_finals"
}
```

## Database Schema

Fixtures created include these knockout-specific fields:

```sql
knockout_round VARCHAR(50)  -- 'quarter_finals', 'semi_finals', 'finals', 'third_place'
scoring_system VARCHAR(20)  -- 'goals' or 'wins'
matchup_mode VARCHAR(50)    -- 'manual' or 'blind_lineup'
```

## Benefits

1. **Maximum Flexibility**: Each round can have unique settings
2. **Progressive Creation**: Generate rounds as the tournament progresses
3. **Easy Management**: Clear UI for team selection and configuration
4. **Multiple Formats**: Support for all knockout formats in one tournament

## Tips

- Use blind lineup for early rounds to add excitement
- Switch to manual for finals to allow strategic matchups
- Use two-leg format for important rounds
- Single leg for quick knockout stages
- Round robin for finals to determine clear winner

## Troubleshooting

**Teams not loading?**
- Make sure teams are assigned to the tournament in the Teams tab
- Click "Load Teams" button to refresh the list

**Can't generate fixtures?**
- Ensure you've selected exactly the required number of teams
- Check that round number doesn't conflict with existing fixtures
- Verify tournament is selected

**Wrong pairings?**
- For manual pairing, selection order determines matchups
- For standard seeding, first selected = 1st seed, last = lowest seed
- For random, pairings are unpredictable by design
