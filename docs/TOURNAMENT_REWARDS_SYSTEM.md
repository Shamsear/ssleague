# Tournament Rewards System

## Overview
The Tournament Rewards System allows committee admins to configure monetary rewards (eCoin and SSCoin) for teams based on their performance in tournaments. Rewards are automatically distributed when matches are completed or tournaments end.

## Reward Types

### 1. Match Result Rewards (Per Match)
Applied after each match in league or group stages:
- **Win Reward**: Given to the winning team
- **Draw Reward**: Given to both teams in a draw
- **Loss Reward**: Participation reward for the losing team

**When Applied:**
- League Stage: All league matches
- Group Stage: All group stage matches
- NOT Applied: Knockout stage matches (use knockout rewards instead)

### 2. League Position Rewards (Season End)
Applied at the end of pure league tournaments (no knockout stage):
- 1st Place (Champion)
- 2nd Place (Runner-up)  
- 3rd Place
- 4th Place
- ... (configurable, can add more positions)

**When Applied:**
- Only for tournaments with `has_league_stage: true` AND `has_knockout_stage: false`
- Distributed when tournament status changes to 'completed'

### 3. Knockout Stage Rewards (Tournament End)
Applied based on elimination round in knockout tournaments:
- **Winner**: Champion of the tournament
- **Runner-up**: Finalist (lost in final)
- **Semi-final Loser**: Eliminated in semi-finals (3rd/4th place)
- **Quarter-final Loser**: Eliminated in quarter-finals
- **Round of 16 Loser**: Eliminated in round of 16
- **Round of 32 Loser**: Eliminated in round of 32

**When Applied:**
- For tournaments with `has_knockout_stage: true`
- Can be combined with league/group stage (e.g., League + Playoffs)
- Distributed when knockout phase completes

### 4. Tournament Completion Bonus (All Teams)
Participation bonus given to all teams that complete the tournament:
- Given to every team that played all their scheduled matches
- Encourages participation and completion

**When Applied:**
- At tournament completion
- All teams that didn't forfeit/withdraw

## Tournament Format Combinations

### Pure League
```
has_league_stage: true
has_knockout_stage: false
```
**Rewards Applied:**
- ✅ Match Result Rewards (all league matches)
- ✅ League Position Rewards (1st, 2nd, 3rd, etc.)
- ✅ Completion Bonus

### League + Knockout (e.g., League with Playoffs)
```
has_league_stage: true
has_knockout_stage: true
```
**Rewards Applied:**
- ✅ Match Result Rewards (league phase only)
- ❌ League Position Rewards (replaced by knockout rewards)
- ✅ Knockout Stage Rewards (playoff phase)
- ✅ Completion Bonus

### Pure Group Stage
```
has_group_stage: true
has_knockout_stage: false
```
**Rewards Applied:**
- ✅ Match Result Rewards (all group matches)
- ✅ Completion Bonus

### Group + Knockout (e.g., World Cup format)
```
has_group_stage: true
has_knockout_stage: true
```
**Rewards Applied:**
- ✅ Match Result Rewards (group phase only)
- ✅ Knockout Stage Rewards (knockout phase)
- ✅ Completion Bonus

### Pure Knockout (e.g., FA Cup)
```
has_knockout_stage: true
has_league_stage: false
has_group_stage: false
```
**Rewards Applied:**
- ❌ Match Result Rewards (no league/group stage)
- ✅ Knockout Stage Rewards
- ✅ Completion Bonus

## Database Schema

### `tournaments.rewards` Column (JSONB)
```json
{
  "match_results": {
    "win_ecoin": 100,
    "win_sscoin": 10,
    "draw_ecoin": 50,
    "draw_sscoin": 5,
    "loss_ecoin": 20,
    "loss_sscoin": 2
  },
  "league_positions": [
    { "position": 1, "ecoin": 5000, "sscoin": 500 },
    { "position": 2, "ecoin": 3000, "sscoin": 300 },
    { "position": 3, "ecoin": 2000, "sscoin": 200 },
    { "position": 4, "ecoin": 1000, "sscoin": 100 }
  ],
  "knockout_stages": {
    "winner": { "ecoin": 5000, "sscoin": 500 },
    "runner_up": { "ecoin": 3000, "sscoin": 300 },
    "semi_final_loser": { "ecoin": 1500, "sscoin": 150 },
    "quarter_final_loser": { "ecoin": 750, "sscoin": 75 },
    "round_of_16_loser": { "ecoin": 400, "sscoin": 40 },
    "round_of_32_loser": { "ecoin": 200, "sscoin": 20 }
  },
  "completion_bonus": {
    "ecoin": 500,
    "sscoin": 50
  }
}
```

## Implementation Guide

### 1. Run Database Migration
```bash
psql -d your_database -f migrations/add_tournament_rewards.sql
```

### 2. Configure Rewards (Committee Admin)
1. Navigate to: **Dashboard → Tournament Management**
2. Click **"Create New Tournament"**
3. Fill in basic tournament details
4. Scroll to **"Tournament Rewards"** section
5. Configure rewards based on tournament format:
   - **Match Results**: Set win/draw/loss rewards
   - **League Positions**: Add position-based rewards (pure league only)
   - **Knockout Stages**: Set stage-based rewards (knockout tournaments)
   - **Completion Bonus**: Set participation bonus
6. Click **"Create Tournament"**

### 3. Reward Distribution (Backend Implementation Required)

#### On Match Completion
```typescript
// When a match result is submitted
async function distributeMatchRewards(fixtureId: string) {
  const fixture = await getFixture(fixtureId);
  const tournament = await getTournament(fixture.tournament_id);
  
  if (!tournament.rewards?.match_results) return;
  
  const { home_score, away_score, home_team_id, away_team_id } = fixture;
  const { match_results } = tournament.rewards;
  
  if (home_score > away_score) {
    // Home team wins
    await addTeamCurrency(home_team_id, {
      ecoin: match_results.win_ecoin,
      sscoin: match_results.win_sscoin,
      reason: `Match win vs ${fixture.away_team_name}`
    });
    await addTeamCurrency(away_team_id, {
      ecoin: match_results.loss_ecoin,
      sscoin: match_results.loss_sscoin,
      reason: `Match loss vs ${fixture.home_team_name}`
    });
  } else if (home_score < away_score) {
    // Away team wins
    await addTeamCurrency(away_team_id, {
      ecoin: match_results.win_ecoin,
      sscoin: match_results.win_sscoin,
      reason: `Match win vs ${fixture.home_team_name}`
    });
    await addTeamCurrency(home_team_id, {
      ecoin: match_results.loss_ecoin,
      sscoin: match_results.loss_sscoin,
      reason: `Match loss vs ${fixture.away_team_name}`
    });
  } else {
    // Draw
    await addTeamCurrency(home_team_id, {
      ecoin: match_results.draw_ecoin,
      sscoin: match_results.draw_sscoin,
      reason: `Match draw vs ${fixture.away_team_name}`
    });
    await addTeamCurrency(away_team_id, {
      ecoin: match_results.draw_ecoin,
      sscoin: match_results.draw_sscoin,
      reason: `Match draw vs ${fixture.home_team_name}`
    });
  }
}
```

#### On Tournament Completion
```typescript
async function distributeTournamentRewards(tournamentId: string) {
  const tournament = await getTournament(tournamentId);
  
  if (!tournament.rewards) return;
  
  // 1. League Position Rewards (pure league only)
  if (tournament.has_league_stage && !tournament.has_knockout_stage) {
    const standings = await getLeagueStandings(tournamentId);
    
    for (const positionReward of tournament.rewards.league_positions) {
      const team = standings.find(t => t.position === positionReward.position);
      if (team) {
        await addTeamCurrency(team.id, {
          ecoin: positionReward.ecoin,
          sscoin: positionReward.sscoin,
          reason: `${tournament.tournament_name} - Position ${positionReward.position}`
        });
      }
    }
  }
  
  // 2. Knockout Stage Rewards
  if (tournament.has_knockout_stage) {
    const knockoutResults = await getKnockoutResults(tournamentId);
    const { knockout_stages } = tournament.rewards;
    
    // Winner
    if (knockoutResults.winner) {
      await addTeamCurrency(knockoutResults.winner, {
        ecoin: knockout_stages.winner.ecoin,
        sscoin: knockout_stages.winner.sscoin,
        reason: `${tournament.tournament_name} - Champion`
      });
    }
    
    // Runner-up
    if (knockoutResults.runner_up) {
      await addTeamCurrency(knockoutResults.runner_up, {
        ecoin: knockout_stages.runner_up.ecoin,
        sscoin: knockout_stages.runner_up.sscoin,
        reason: `${tournament.tournament_name} - Runner-up`
      });
    }
    
    // Semi-final losers
    for (const teamId of knockoutResults.semi_final_losers || []) {
      await addTeamCurrency(teamId, {
        ecoin: knockout_stages.semi_final_loser.ecoin,
        sscoin: knockout_stages.semi_final_loser.sscoin,
        reason: `${tournament.tournament_name} - Semi-final`
      });
    }
    
    // ... similar for other knockout rounds
  }
  
  // 3. Completion Bonus (all teams)
  const allTeams = await getTournamentTeams(tournamentId);
  const { completion_bonus } = tournament.rewards;
  
  for (const team of allTeams) {
    await addTeamCurrency(team.id, {
      ecoin: completion_bonus.ecoin,
      sscoin: completion_bonus.sscoin,
      reason: `${tournament.tournament_name} - Completion Bonus`
    });
  }
}
```

## Example Configurations

### Premier League (Pure League)
- **Win**: 100 eCoin, 10 SSCoin
- **Draw**: 50 eCoin, 5 SSCoin
- **Loss**: 20 eCoin, 2 SSCoin
- **Champion**: 5,000 eCoin, 500 SSCoin
- **Runner-up**: 3,000 eCoin, 300 SSCoin
- **3rd Place**: 2,000 eCoin, 200 SSCoin
- **Completion**: 500 eCoin, 50 SSCoin

### Champions League (Group + Knockout)
- **Group Win**: 150 eCoin, 15 SSCoin
- **Group Draw**: 75 eCoin, 7 SSCoin
- **Winner**: 10,000 eCoin, 1,000 SSCoin
- **Runner-up**: 6,000 eCoin, 600 SSCoin
- **Semi-final**: 3,000 eCoin, 300 SSCoin
- **Quarter-final**: 1,500 eCoin, 150 SSCoin
- **Completion**: 1,000 eCoin, 100 SSCoin

### FA Cup (Pure Knockout)
- **Winner**: 7,500 eCoin, 750 SSCoin
- **Runner-up**: 4,000 eCoin, 400 SSCoin
- **Semi-final**: 2,000 eCoin, 200 SSCoin
- **Quarter-final**: 1,000 eCoin, 100 SSCoin
- **Round of 16**: 500 eCoin, 50 SSCoin
- **Completion**: 250 eCoin, 25 SSCoin

## Testing Checklist

- [ ] Create pure league tournament with rewards
- [ ] Create league + knockout tournament
- [ ] Create group + knockout tournament
- [ ] Create pure knockout tournament
- [ ] Verify rewards are saved in database
- [ ] Test match result reward distribution
- [ ] Test league position reward distribution
- [ ] Test knockout stage reward distribution
- [ ] Test completion bonus distribution
- [ ] Verify rewards appear in team transactions

## Future Enhancements

1. **Dynamic Position Rewards**: Allow unlimited positions
2. **Conditional Rewards**: Bonus for achieving certain milestones
3. **Group Stage Position Rewards**: Rewards for group winners/runners-up
4. **MVP/Top Scorer Bonuses**: Individual player rewards
5. **Fair Play Awards**: Extra rewards for disciplined teams
6. **Reward History**: View past reward distributions
7. **Bulk Edit**: Copy rewards from one tournament to another
