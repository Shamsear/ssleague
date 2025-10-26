# Player Points & Category System

## Overview
This document explains how the player points, star ratings, and category assignment system works.

## Points System

### Base Points by Star Rating
- 3☆ = 100 points
- 4☆ = 120 points
- 5☆ = 145 points
- 6☆ = 175 points
- 7☆ = 210 points
- 8☆ = 250 points
- 9☆ = 300 points
- 10☆ = 350-400 points (max)

### Points Calculation Per Match
- **1 Goal Difference (GD) = 1 Point**
- **Maximum change per match: ±5 points**
- Formula: `points_change = Math.max(-5, Math.min(5, goal_difference))`

Example:
- Player wins 4-1 → GD = +3 → Gains +3 points
- Player loses 0-5 → GD = -5 → Loses -5 points (capped)
- Player loses 1-8 → GD = -7 → Loses -5 points (capped at max)

## Star Rating System (LIFETIME)

### Star Rating Calculation
Points are accumulated over the player's **ENTIRE CAREER** (lifetime, not season-specific).

Star rating is automatically updated based on total lifetime points:
```
if (points >= 350) return 10 stars;
if (points >= 300) return 9 stars;
if (points >= 250) return 8 stars;
if (points >= 210) return 7 stars;
if (points >= 175) return 6 stars;
if (points >= 145) return 5 stars;
if (points >= 120) return 4 stars;
else return 3 stars;
```

### Star Rating Affects:
1. **Category Assignment** (see below)
2. **Salary Per Match** - Recalculated when star rating changes
   - Formula: `(auction_value ÷ 100) × star_rating ÷ 10`

## Category System (AUTO-ASSIGNED - LEAGUE-WIDE RANKING)

### Only 2 Categories:
1. **Legend** - Top 50% of all players (by star rating)
2. **Classic** - Bottom 50% of all players (by star rating)

### Auto-Assignment Logic:
1. All players are sorted by **star rating** (highest first)
2. If star ratings are tied, players are sorted by **points** (highest first)
3. **Top 50%** of ranked players = Legend
4. **Bottom 50%** of ranked players = Classic

### Dynamic Category Assignment:
- Categories are **recalculated EVERY time** match results are submitted
- When ANY player's points change, ALL player categories are recalculated
- Your category can change even if your own stats don't change (if others improve/decline)

### Category Changes Example:
```
100 players total → Top 50 = Legend, Bottom 50 = Classic

Player A: 7☆ (215 points) → Ranked #25 → Legend
Player B: 6☆ (180 points) → Ranked #45 → Legend
Player C: 6☆ (175 points) → Ranked #51 → Classic ❌
Player D: 5☆ (150 points) → Ranked #80 → Classic

After match results:
- Player C gains +5 points → 6☆ (180 points) → Rank improves to #48 → Legend ✅
- Player B loses -10 points → 6☆ (170 points) → Rank drops to #52 → Classic ❌

Note: Both players have same 6☆ rating, but ranking determines category!
```

## Data Storage

### realplayer Collection (LIFETIME DATA)
Stores **lifetime/career** data:
- `points` - Total lifetime points
- `star_rating` - Current star rating (3-10)
- `category_id` - Current category (legend/classic)
- `category_name` - Category display name
- `salary_per_match` - Auto-updated when star rating changes

### realplayerstats Collection (SEASON-SPECIFIC DATA)
Stores **per-season** statistics:
- `points` - Points gained THIS SEASON (incremented)
- `current_points` - Mirror of lifetime points (for reference)
- `star_rating` - Mirror of lifetime star rating
- `category_id` - Mirror of current category
- `matches_played`, `wins`, `draws`, `losses` - Season stats
- `goals_scored`, `goals_conceded` - Season performance
- `motm_awards` - Player of the Match awards this season

## API Endpoint: `/api/realplayers/update-points`

### Required Parameters:
```json
{
  "fixture_id": "string",
  "season_id": "string",
  "matchups": [
    {
      "home_player_id": "string",
      "away_player_id": "string", 
      "home_goals": number,
      "away_goals": number
    }
  ]
}
```

### What It Does:
1. Calculates goal difference for each player in the match
2. Calculates points change (±1 per GD, max ±5)
3. Updates lifetime points in `realplayer`
4. Recalculates star rating from lifetime points
5. Recalculates salary if star rating changed
6. Updates `realplayerstats` with season-specific tracking
7. **Recalculates categories for ALL players league-wide** (Top 50% = Legend)

### Response:
```json
{
  "success": true,
  "message": "Player points and ratings updated successfully",
  "updates": [
    {
      "player_id": "string",
      "name": "string",
      "old_points": 145,
      "new_points": 148,
      "points_change": 3,
      "old_stars": 5,
      "new_stars": 5,
      "salary_updated": false
    }
  ],
  "categoryUpdate": {
    "success": true,
    "totalPlayers": 100,
    "legendCount": 50
  }
}
```

**Note**: Categories are no longer returned per player in updates since they're 
recalculated league-wide after all updates complete.

## Workflow

### When Match Results Are Submitted:
1. Match results saved to fixtures/matchups
2. **Player stats updated** (`/api/realplayers/update-stats`)
   - Tracks: goals, wins/draws/losses, MOTM awards
3. **Player points updated** (`/api/realplayers/update-points`)
   - Calculates GD and points change for matched players
   - Updates lifetime points & star rating for matched players
   - Recalculates salary if star rating changed
   - **THEN recalculates categories for ALL players league-wide**
4. Both `realplayer` (lifetime) and `realplayerstats` (season) are updated
5. All players' categories updated based on new league-wide ranking

## Important Notes

✅ **Star rating is LIFETIME** - carries across all seasons, not season-specific
✅ **Category is DYNAMIC** - recalculated league-wide after every match submission
✅ **Top 50% by star rating** = Legend, Bottom 50% = Classic
✅ **Salary auto-recalculates** when star rating changes
✅ **Points are tracked per match** in `realplayerstats` for season analytics
✅ **Max ±5 points change per match** prevents extreme swings
✅ **Only 2 categories**: Legend (top half) and Classic (bottom half)

## Example Scenario

### Player Journey (League-Wide Ranking System):
```
League has 100 players total → Top 50 = Legend, Bottom 50 = Classic

Initial Assignment:
- Auction Value: $500
- Star Rating: 4☆ (120 points)
- League Rank: #65 (Bottom 50%)
- Category: Classic
- Salary: $500/100 × 4/10 = $2/match

After 10 matches with +35 points total:
- Points: 155 → Still 4☆
- League Rank: #58 (still bottom 50%)
- Category: Classic (unchanged)
- Salary: $2/match (unchanged)

After 5 more matches with +20 points:
- Points: 175 → UPGRADED to 6☆ ⭐
- League Rank: #42 (moved into TOP 50%!)
- Category: Legend (auto-upgraded!)
- Salary: $500/100 × 6/10 = $3/match (auto-recalculated)

After poor performance (-10 points):
- Points: 165 → DOWNGRADED to 5☆  
- League Rank: #53 (dropped below 50%)
- Category: Classic (auto-downgraded)
- Salary: $500/100 × 5/10 = $2.5/match (auto-recalculated)

NOTE: Category can also change WITHOUT your points changing!
Example: You stay at 6☆ (175 points), but other players improve and push 
you from rank #48 (Legend) to rank #52 (Classic)
```
