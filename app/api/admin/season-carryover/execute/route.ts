import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { neon } from '@neondatabase/serverless';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from: fromSeason, to: toSeason } = body;

    if (!fromSeason || !toSeason) {
      return NextResponse.json(
        { success: false, error: 'Both from and to seasons are required' },
        { status: 400 }
      );
    }

    if (fromSeason === toSeason) {
      return NextResponse.json(
        { success: false, error: 'Source and target seasons must be different' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting season carryover: ${fromSeason} → ${toSeason}`);

    const tournamentSql = getTournamentDb();
    const auctionSql = neon(process.env.NEON_AUCTION_DB_URL || '');
    let teamsUpdated = 0;
    let playersUpdated = 0;
    let auctionTeamsCreated = 0;

    // 1. Carry over team_seasons data in Firebase
    console.log('Step 1: Carrying over team_seasons in Firebase...');
    const sourceTeamSeasonsSnapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', fromSeason)
      .get();
    
    for (const sourceDoc of sourceTeamSeasonsSnapshot.docs) {
      const sourceData = sourceDoc.data();
      const teamId = sourceData.team_id;
      
      // Create new document ID for target season
      const targetDocId = `${teamId}_${toSeason}`;
      
      // Check if target season document already exists
      const targetDoc = await adminDb.collection('team_seasons').doc(targetDocId).get();
      
      // Prepare data for target season
      const targetData = {
        ...sourceData,
        season_id: toSeason,
        // Carry over budgets
        football_budget: sourceData.football_budget || 0,
        real_player_budget: sourceData.real_player_budget || 0,
        // Reset spent amounts
        football_spent: 0,
        real_player_spent: 0,
        total_spent: 0,
        // Reset player counts
        players_count: 0,
        position_counts: {
          GK: 0, CB: 0, LB: 0, RB: 0,
          DMF: 0, CMF: 0, AMF: 0,
          LMF: 0, RMF: 0,
          LWF: 0, RWF: 0,
          SS: 0, CF: 0
        },
        // Reset warnings and penalties
        lineup_warnings: 0,
        last_lineup_warning_fixture: null,
        last_lineup_warning_date: null,
        last_salary_deduction: null,
        // Update timestamps
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: targetDoc.exists ? sourceData.created_at : admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Set or update the target season document
      await adminDb.collection('team_seasons').doc(targetDocId).set(targetData, { merge: true });
      
      teamsUpdated++;
    }

    console.log(`✅ Updated ${teamsUpdated} team_seasons documents`);

    // 2. Update auction database teams table - just update season_id to new season
    console.log('Step 2: Updating auction database teams table...');
    
    for (const sourceDoc of sourceTeamSeasonsSnapshot.docs) {
      const sourceData = sourceDoc.data();
      const teamId = sourceData.team_id;
      
      // Simply update the existing team record to point to the new season
      // This updates the season_id and resets the budget/spent values
      await auctionSql`
        UPDATE teams
        SET 
          season_id = ${toSeason},
          football_budget = ${sourceData.football_budget || 0},
          football_spent = 0,
          football_players_count = 0,
          updated_at = NOW()
        WHERE id = ${teamId}
      `;
      
      auctionTeamsCreated++;
    }

    console.log(`✅ Updated auction database: ${auctionTeamsCreated} teams updated to ${toSeason}`);

    // 3. Carry over player stats in Neon (Tournament DB)
    console.log('Step 3: Carrying over player stats in Neon...');
    // First, get all players from source season
    const sourcePlayers = await tournamentSql`
      SELECT 
        player_id,
        player_name,
        team_id,
        team,
        star_rating,
        points,
        auction_value,
        salary_per_match
      FROM player_seasons
      WHERE season_id = ${fromSeason}
    `;

    console.log(`Found ${sourcePlayers.length} players to carry over`);

    // Insert or update players in target season
    for (const player of sourcePlayers) {
      // Check if player already exists in target season
      const existing = await tournamentSql`
        SELECT player_id 
        FROM player_seasons 
        WHERE player_id = ${player.player_id} AND season_id = ${toSeason}
      `;

      if (existing.length > 0) {
        // Update existing record
        await tournamentSql`
          UPDATE player_seasons
          SET 
            star_rating = ${player.star_rating || 0},
            points = ${player.points || 0},
            base_points = ${player.points || 0},
            auction_value = ${player.auction_value || 0},
            salary_per_match = ${player.salary_per_match || 0},
            matches_played = 0,
            goals_scored = 0,
            assists = 0,
            goals_conceded = 0,
            wins = 0,
            draws = 0,
            losses = 0,
            clean_sheets = 0,
            motm_awards = 0,
            updated_at = NOW()
          WHERE player_id = ${player.player_id} AND season_id = ${toSeason}
        `;
      } else {
        // Insert new record
        await tournamentSql`
          INSERT INTO player_seasons (
            id,
            player_id,
            player_name,
            team_id,
            team,
            season_id,
            star_rating,
            points,
            base_points,
            auction_value,
            salary_per_match,
            matches_played,
            goals_scored,
            assists,
            goals_conceded,
            wins,
            draws,
            losses,
            clean_sheets,
            motm_awards,
            created_at,
            updated_at
          ) VALUES (
            ${player.player_id || ''}_${toSeason},
            ${player.player_id},
            ${player.player_name},
            ${player.team_id},
            ${player.team},
            ${toSeason},
            ${player.star_rating || 0},
            ${player.points || 0},
            ${player.points || 0},
            ${player.auction_value || 0},
            ${player.salary_per_match || 0},
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            NOW(),
            NOW()
          )
        `;
      }
      
      playersUpdated++;
    }

    console.log(`✅ Season carryover complete: ${fromSeason} → ${toSeason}`);
    console.log(`   Team_seasons updated: ${teamsUpdated}`);
    console.log(`   Auction teams created: ${auctionTeamsCreated}`);
    console.log(`   Players updated: ${playersUpdated}`);

    return NextResponse.json({
      success: true,
      message: `Successfully carried over data from ${fromSeason} to ${toSeason}`,
      teamsUpdated,
      auctionTeamsCreated,
      playersUpdated
    });

  } catch (error: any) {
    console.error('❌ Error executing season carryover:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { success: false, error: `Database error: ${error.message}. Please check your network connection and try again.` },
      { status: 500 }
    );
  }
}
