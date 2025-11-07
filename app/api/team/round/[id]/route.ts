import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { checkAndFinalizeExpiredRound } from '@/lib/lazy-finalize-round';
import { decryptBidData } from '@/lib/encryption';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;

    const { id: roundId } = await params;

    // Check and auto-finalize if expired (lazy finalization)
    await checkAndFinalizeExpiredRound(roundId);

    // Get round details (seasons table doesn't exist in Neon, only rounds)
    const roundResult = await sql`
      SELECT *
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Check if round is active
    if (round.status !== 'active') {
      // Check if there's another active round
      const activeRoundResult = await sql`
        SELECT id FROM rounds 
        WHERE season_id = ${round.season_id} 
        AND status = 'active'
        LIMIT 1
      `;

      if (activeRoundResult.length > 0) {
        return NextResponse.json({
          success: false,
          redirect: `/dashboard/team/round/${activeRoundResult[0].id}`,
          error: 'This round is no longer active',
        });
      }

      return NextResponse.json({
        success: false,
        redirect: '/dashboard/team',
        error: 'No active rounds available',
      });
    }

    // Check if round has ended
    const now = new Date();
    const endTime = new Date(round.end_time);
    if (now > endTime) {
      return NextResponse.json({
        success: false,
        redirect: '/dashboard/team',
        error: 'This round has ended',
      });
    }

    // Get team's season data first to check registration
    let teamSeasonId = `${userId}_${round.season_id}`;
    let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
    
    // Fallback: Query by user_id field if direct lookup fails
    if (!teamSeasonDoc.exists) {
      const teamSeasonQuery = await adminDb.collection('team_seasons')
        .where('user_id', '==', userId)
        .where('season_id', '==', round.season_id)
        .where('status', '==', 'registered')
        .limit(1)
        .get();
      
      if (teamSeasonQuery.empty) {
        return NextResponse.json(
          { success: false, error: 'Team not registered for this season' },
          { status: 404 }
        );
      }
      
      teamSeasonDoc = teamSeasonQuery.docs[0];
      teamSeasonId = teamSeasonDoc.id;
    }
    
    const teamSeasonData = teamSeasonDoc.data();
    const teamName = teamSeasonData?.team_name || teamSeasonData?.name || 'Team';
    
    // Get or create team_id from teams table
    console.log(`🔍 Looking up team for Firebase UID: ${userId}`);
    let teamIdResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
    `;
    
    let teamId: string;
    if (teamIdResult.length === 0) {
      // Team doesn't exist in Neon - use team_id from Firebase and create record
      console.log(`🔨 Creating new team record for user ${userId}`);
      
      // Get team_id from Firebase team_seasons (already exists there)
      teamId = teamSeasonData?.team_id;
      
      if (!teamId) {
        console.error(`❌ No team_id found in Firebase team_seasons for user ${userId}`);
        return NextResponse.json(
          { success: false, error: 'Team configuration error - no team_id in Firebase' },
          { status: 500 }
        );
      }
      
      // Get budget from Firebase to populate Neon
      const footballBudget = teamSeasonData?.football_budget || 0;
      const footballSpent = teamSeasonData?.football_spent || 0;
      
      try {
        await sql`
          INSERT INTO teams (id, name, firebase_uid, season_id, football_budget, football_spent, created_at, updated_at)
          VALUES (${teamId}, ${teamName}, ${userId}, ${round.season_id}, ${footballBudget}, ${footballSpent}, NOW(), NOW())
        `;
        console.log(`✅ Created team: ${teamId} (${teamName}) with budget £${footballBudget}`);
      } catch (insertError: any) {
        if (insertError.code === '23505') {
          // Duplicate - someone else created it, fetch it
          console.log(`⚠️ Duplicate team (race condition), fetching...`);
          teamIdResult = await sql`SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1`;
          teamId = teamIdResult[0]?.id || teamId;
        } else {
          throw insertError;
        }
      }
    } else {
      teamId = teamIdResult[0].id;
      console.log(`✅ Found team: ${teamId}`);
    }
    
    console.log(`   Team Name: ${teamName}`);
    console.log(`   Season: ${round.season_id}`);
    
    // Determine currency system and get appropriate balance
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';
    
    let teamBalance = 0;
    if (isDualCurrency) {
      // For dual currency, use football_budget (since this is for football players)
      teamBalance = teamSeasonData?.football_budget || 0;
    } else {
      // For single currency, use budget
      teamBalance = teamSeasonData?.budget || 0;
    }

    // Get available players for this position or position group
    // Supports multi-position rounds (e.g., "LB,LWF") and position groups (e.g., "CF-1")
    const positions = round.position.split(',').map((p: string) => p.trim());
    
    // Check if any position is a position group (e.g., "CF-1")
    const hasPositionGroups = positions.some((p: string) => /^[A-Z]+-\d+$/.test(p));
    
    const playersResult = await sql`
      SELECT 
        p.id,
        p.player_id,
        p.name,
        p.position,
        p.team_name,
        p.nationality,
        p.age,
        p.club,
        p.playing_style,
        p.overall_rating,
        p.offensive_awareness,
        p.ball_control,
        p.dribbling,
        p.tight_possession,
        p.low_pass,
        p.lofted_pass,
        p.finishing,
        p.heading,
        p.set_piece_taking,
        p.curl,
        p.speed,
        p.acceleration,
        p.kicking_power,
        p.jumping,
        p.physical_contact,
        p.balance,
        p.stamina,
        p.defensive_awareness,
        p.tackling,
        p.aggression,
        p.defensive_engagement,
        p.gk_awareness,
        p.gk_catching,
        p.gk_parrying,
        p.gk_reflexes,
        p.gk_reach,
        CASE WHEN sp.player_id IS NOT NULL THEN true ELSE false END as is_starred_by_user
      FROM footballplayers p
      LEFT JOIN starred_players sp ON p.id = sp.player_id AND sp.team_id = ${teamId}
      WHERE (p.position = ANY(${positions}) OR p.position_group = ANY(${positions}))
      AND p.is_auction_eligible = true
      AND (p.is_sold = false OR p.is_sold IS NULL)
      AND (p.team_id IS NULL OR p.team_id = '')
      ORDER BY is_starred_by_user DESC, p.overall_rating DESC
    `;

    // Get user's bids for this round (including encrypted_bid_data for decryption)
    const bidsResult = await sql`
      SELECT 
        b.id,
        b.player_id,
        b.amount,
        b.encrypted_bid_data,
        b.round_id,
        b.created_at,
        p.id as "player.id",
        p.name as "player.name",
        p.position as "player.position",
        p.team_name as "player.team_name",
        p.overall_rating as "player.overall_rating",
        p.playing_style as "player.playing_style",
        CASE WHEN sp.player_id IS NOT NULL THEN true ELSE false END as "player.is_starred"
      FROM bids b
      JOIN footballplayers p ON b.player_id = p.id
      LEFT JOIN starred_players sp ON p.id = sp.player_id AND sp.team_id = ${teamId}
      WHERE b.team_id = ${teamId}
      AND b.round_id = ${roundId}
      AND b.status = 'active'
      ORDER BY b.created_at DESC
    `;

    // Transform bids to nest player object and decrypt amounts
    const myBids = bidsResult.map((bid) => {
      // Decrypt the bid amount if it's null (blind bidding)
      let decryptedAmount = bid.amount;
      if (bid.amount === null && bid.encrypted_bid_data) {
        try {
          const decrypted = decryptBidData(bid.encrypted_bid_data);
          decryptedAmount = decrypted.amount;
        } catch (err) {
          console.error('Failed to decrypt bid:', err);
          decryptedAmount = 0; // Fallback
        }
      }

      return {
        id: bid.id,
        player_id: bid.player_id,
        amount: decryptedAmount,
        round_id: bid.round_id,
        created_at: bid.created_at,
        player: {
          id: bid['player.id'],
          name: bid['player.name'],
          position: bid['player.position'],
          team_name: bid['player.team_name'],
          overall_rating: bid['player.overall_rating'],
          playing_style: bid['player.playing_style'],
          is_starred: bid['player.is_starred'],
        },
      };
    });

    // Get auction progress (completed rounds and total rounds)
    const roundsProgressResult = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_rounds,
        COUNT(*) as total_rounds
      FROM rounds
      WHERE season_id = ${round.season_id}
    `;

    const completedRounds = parseInt(roundsProgressResult[0]?.completed_rounds || '0');
    const totalRounds = parseInt(roundsProgressResult[0]?.total_rounds || '0');

    // Check if team has submitted bids for this round
    const submissionResult = await sql`
      SELECT submitted_at, is_locked, bid_count
      FROM bid_submissions
      WHERE team_id = ${teamId}
      AND round_id = ${roundId}
      LIMIT 1
    `;

    const hasSubmitted = submissionResult.length > 0;
    const submissionData = hasSubmitted ? submissionResult[0] : null;

    return NextResponse.json({
      success: true,
      round: {
        id: round.id,
        position: round.position,
        max_bids_per_team: round.max_bids_per_team,
        end_time: round.end_time,
        status: round.status,
        season_id: round.season_id,
      },
      players: playersResult,
      myBids,
      teamBalance,
      completedRounds,
      totalRounds,
      submission: submissionData ? {
        submitted_at: submissionData.submitted_at,
        is_locked: submissionData.is_locked,
        bid_count: submissionData.bid_count,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching round data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
