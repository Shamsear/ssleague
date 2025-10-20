import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

interface MatchupResult {
  position: number;
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  home_goals: number;
  away_goals: number;
  man_of_the_match?: 'home' | 'away' | null;
}

/**
 * Update team stats in Firebase based on fixture results
 * Tracks: matches_played, wins, draws, losses, goals_for, goals_against
 * Handles result edits by tracking processed fixtures to prevent duplicate counting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, fixture_id, home_team_id, away_team_id, matchups } = body;

    if (!season_id || !fixture_id || !home_team_id || !away_team_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: season_id, fixture_id, home_team_id, away_team_id, matchups[]' },
        { status: 400 }
      );
    }

    // Calculate aggregate scores
    let homeTeamGoals = 0;
    let awayTeamGoals = 0;

    for (const matchup of matchups as MatchupResult[]) {
      if (matchup.home_goals !== null && matchup.away_goals !== null) {
        homeTeamGoals += matchup.home_goals;
        awayTeamGoals += matchup.away_goals;
      }
    }

    // Determine match result
    const homeWon = homeTeamGoals > awayTeamGoals;
    const awayWon = awayTeamGoals > homeTeamGoals;
    const draw = homeTeamGoals === awayTeamGoals;

    // Update home team stats
    await updateTeamStats({
      team_id: home_team_id,
      season_id,
      fixture_id,
      goals_for: homeTeamGoals,
      goals_against: awayTeamGoals,
      won: homeWon,
      draw,
      lost: awayWon
    });

    // Update away team stats
    await updateTeamStats({
      team_id: away_team_id,
      season_id,
      fixture_id,
      goals_for: awayTeamGoals,
      goals_against: homeTeamGoals,
      won: awayWon,
      draw,
      lost: homeWon
    });

    return NextResponse.json({
      success: true,
      message: 'Team stats updated successfully',
      updates: {
        home: {
          team_id: home_team_id,
          goals_for: homeTeamGoals,
          goals_against: awayTeamGoals,
          result: homeWon ? 'W' : draw ? 'D' : 'L'
        },
        away: {
          team_id: away_team_id,
          goals_for: awayTeamGoals,
          goals_against: homeTeamGoals,
          result: awayWon ? 'W' : draw ? 'D' : 'L'
        }
      }
    });
  } catch (error) {
    console.error('Error updating team stats:', error);
    return NextResponse.json(
      { error: 'Failed to update team stats' },
      { status: 500 }
    );
  }
}

/**
 * Update or create team stats document
 * Tracks processed fixtures to prevent duplicate counting when results are edited
 */
async function updateTeamStats(data: {
  team_id: string;
  season_id: string;
  fixture_id: string;
  goals_for: number;
  goals_against: number;
  won: boolean;
  draw: boolean;
  lost: boolean;
}) {
  const { team_id, season_id, fixture_id, goals_for, goals_against, won, draw, lost } = data;

  // Construct composite ID: team_id_seasonId
  const statsId = `${team_id}_${season_id}`;
  const statsRef = doc(db, 'teamstats', statsId);

  // Check if stats document exists
  const statsDoc = await getDoc(statsRef);

  if (statsDoc.exists()) {
    const existingData = statsDoc.data();
    const processedFixtures = existingData.processed_fixtures || [];
    
    // Check if this fixture was already processed
    const fixtureIndex = processedFixtures.findIndex((f: any) => f.fixture_id === fixture_id);
    
    if (fixtureIndex >= 0) {
      // Fixture already processed - this is an edit
      const oldStats = processedFixtures[fixtureIndex];
      
      // Calculate the difference to adjust stats
      const goalsForDiff = goals_for - oldStats.goals_for;
      const goalsAgainstDiff = goals_against - oldStats.goals_against;
      const winsDiff = (won ? 1 : 0) - (oldStats.won ? 1 : 0);
      const drawsDiff = (draw ? 1 : 0) - (oldStats.draw ? 1 : 0);
      const lossesDiff = (lost ? 1 : 0) - (oldStats.lost ? 1 : 0);
      
      // Update with differences (not duplicating)
      const updateData: any = {
        goals_for: increment(goalsForDiff),
        goals_against: increment(goalsAgainstDiff),
        updated_at: serverTimestamp()
      };
      
      if (winsDiff !== 0) updateData.wins = increment(winsDiff);
      if (drawsDiff !== 0) updateData.draws = increment(drawsDiff);
      if (lossesDiff !== 0) updateData.losses = increment(lossesDiff);
      
      // Recalculate goal_difference
      const currentGoalsFor = existingData.goals_for || 0;
      const currentGoalsAgainst = existingData.goals_against || 0;
      const newGoalDifference = (currentGoalsFor + goalsForDiff) - (currentGoalsAgainst + goalsAgainstDiff);
      updateData.goal_difference = newGoalDifference;
      
      // Update the fixture record in processed_fixtures array
      processedFixtures[fixtureIndex] = { fixture_id, goals_for, goals_against, won, draw, lost };
      updateData.processed_fixtures = processedFixtures;
      
      await updateDoc(statsRef, updateData);
    } else {
      // New fixture - add stats
      const updateData: any = {
        matches_played: increment(1),
        goals_for: increment(goals_for),
        goals_against: increment(goals_against),
        processed_fixtures: [...processedFixtures, { fixture_id, goals_for, goals_against, won, draw, lost }],
        updated_at: serverTimestamp()
      };
      
      if (won) updateData.wins = increment(1);
      if (draw) updateData.draws = increment(1);
      if (lost) updateData.losses = increment(1);
      
      // Recalculate goal_difference
      const currentGoalsFor = existingData.goals_for || 0;
      const currentGoalsAgainst = existingData.goals_against || 0;
      updateData.goal_difference = (currentGoalsFor + goals_for) - (currentGoalsAgainst + goals_against);
      
      await updateDoc(statsRef, updateData);
    }
  } else {
    // Document doesn't exist - this should have been created during team registration
    console.error(`Team stats document not found for ${statsId}. Skipping update.`);
    throw new Error(`Team stats document not found for team ${team_id} in season ${season_id}. Please ensure team is properly registered.`);
  }
}
