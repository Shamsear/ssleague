import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, increment, serverTimestamp } from 'firebase/firestore';

interface MatchupResult {
  position: number;
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  home_goals: number;
  away_goals: number;
}

/**
 * Update or create realplayerstats for players based on match results
 * Tracks: goals scored, goals conceded, matches played, wins, draws, losses, MOTM awards
 * Handles result edits by tracking processed fixtures to prevent duplicate counting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, fixture_id, matchups, motm_player_id } = body;

    if (!season_id || !fixture_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: season_id, fixture_id, matchups[], motm_player_id (optional)' },
        { status: 400 }
      );
    }

    const updates: any[] = [];

    // Process each matchup
    for (const matchup of matchups as MatchupResult[]) {
      const {
        home_player_id,
        home_player_name,
        away_player_id,
        away_player_name,
        home_goals,
        away_goals
      } = matchup;

      if (home_goals === null || away_goals === null) continue;

      // Determine match result
      const homeWon = home_goals > away_goals;
      const awayWon = away_goals > home_goals;
      const draw = home_goals === away_goals;

      // Check if this player won MOTM (compare with fixture-level MOTM)
      const homePlayerMotm = motm_player_id === home_player_id;
      const awayPlayerMotm = motm_player_id === away_player_id;

      // Update home player stats
      await updatePlayerStats({
        player_id: home_player_id,
        player_name: home_player_name,
        season_id,
        fixture_id,
        goals_scored: home_goals,
        goals_conceded: away_goals,
        won: homeWon,
        draw,
        lost: awayWon,
        motm: homePlayerMotm
      });

      updates.push({
        player_id: home_player_id,
        name: home_player_name,
        goals_scored: home_goals,
        goals_conceded: away_goals,
        result: homeWon ? 'W' : draw ? 'D' : 'L',
        motm: homePlayerMotm
      });

      // Update away player stats
      await updatePlayerStats({
        player_id: away_player_id,
        player_name: away_player_name,
        season_id,
        fixture_id,
        goals_scored: away_goals,
        goals_conceded: home_goals,
        won: awayWon,
        draw,
        lost: homeWon,
        motm: awayPlayerMotm
      });

      updates.push({
        player_id: away_player_id,
        name: away_player_name,
        goals_scored: away_goals,
        goals_conceded: home_goals,
        result: awayWon ? 'W' : draw ? 'D' : 'L',
        motm: awayPlayerMotm
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Player stats updated successfully',
      updates,
    });
  } catch (error) {
    console.error('Error updating player stats:', error);
    return NextResponse.json(
      { error: 'Failed to update player stats' },
      { status: 500 }
    );
  }
}

/**
 * Update or create player stats document
 * Tracks processed fixtures to prevent duplicate counting when results are edited
 */
async function updatePlayerStats(data: {
  player_id: string;
  player_name: string;
  season_id: string;
  fixture_id: string;
  goals_scored: number;
  goals_conceded: number;
  won: boolean;
  draw: boolean;
  lost: boolean;
  motm: boolean;
}) {
  const { player_id, player_name, season_id, fixture_id, goals_scored, goals_conceded, won, draw, lost, motm } = data;

  // Construct composite ID: player_id_seasonId
  const statsId = `${player_id}_${season_id}`;
  const statsRef = doc(db, 'realplayerstats', statsId);

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
      const goalsDiff = goals_scored - oldStats.goals_scored;
      const goalsConcededDiff = goals_conceded - oldStats.goals_conceded;
      const winsDiff = (won ? 1 : 0) - (oldStats.won ? 1 : 0);
      const drawsDiff = (draw ? 1 : 0) - (oldStats.draw ? 1 : 0);
      const lossesDiff = (lost ? 1 : 0) - (oldStats.lost ? 1 : 0);
      const motmDiff = (motm ? 1 : 0) - (oldStats.motm ? 1 : 0);
      
      // Update with differences (not duplicating)
      const updateData: any = {
        goals_scored: increment(goalsDiff),
        goals_conceded: increment(goalsConcededDiff),
        updated_at: serverTimestamp()
      };
      
      if (winsDiff !== 0) updateData.wins = increment(winsDiff);
      if (drawsDiff !== 0) updateData.draws = increment(drawsDiff);
      if (lossesDiff !== 0) updateData.losses = increment(lossesDiff);
      if (motmDiff !== 0) updateData.motm_awards = increment(motmDiff);
      
      // Update the fixture record in processed_fixtures array
      processedFixtures[fixtureIndex] = { fixture_id, goals_scored, goals_conceded, won, draw, lost, motm };
      updateData.processed_fixtures = processedFixtures;
      
      await updateDoc(statsRef, updateData);
    } else {
      // New fixture - add stats
      const updateData: any = {
        matches_played: increment(1),
        goals_scored: increment(goals_scored),
        goals_conceded: increment(goals_conceded),
        processed_fixtures: [...processedFixtures, { fixture_id, goals_scored, goals_conceded, won, draw, lost, motm }],
        updated_at: serverTimestamp()
      };
      
      if (won) updateData.wins = increment(1);
      if (draw) updateData.draws = increment(1);
      if (lost) updateData.losses = increment(1);
      if (motm) updateData.motm_awards = increment(1);
      
      await updateDoc(statsRef, updateData);
    }
  } else {
    // Create new stats document
    await setDoc(statsRef, {
      player_id,
      player_name,
      season_id,
      matches_played: 1,
      goals_scored,
      goals_conceded,
      wins: won ? 1 : 0,
      draws: draw ? 1 : 0,
      losses: lost ? 1 : 0,
      motm_awards: motm ? 1 : 0,
      processed_fixtures: [{ fixture_id, goals_scored, goals_conceded, won, draw, lost, motm }],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
  }
}
