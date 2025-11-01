import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/teams/toggle
 * Toggle fantasy participation for a single team
 * Creates/updates record in Fantasy PostgreSQL database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, league_id, enable } = body;

    if (!team_id || !league_id || enable === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: team_id, league_id, enable' },
        { status: 400 }
      );
    }

    console.log(`${enable ? '✅ Enabling' : '❌ Disabling'} fantasy for team: ${team_id}`);

    // Get team data from Firestore
    const teamRef = adminDb.collection('teams').doc(team_id);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamData = teamDoc.data();
    const teamName = teamData?.team_name || team_id;
    const ownerUid = teamData?.uid || '';
    const ownerName = teamData?.owner_name || '';

    // Log warning if owner_uid is missing
    if (!ownerUid) {
      console.warn(`⚠️  Warning: Team ${team_id} (${teamName}) has no 'uid' field in Firestore!`);
      console.warn(`   Available fields: ${Object.keys(teamData || {}).join(', ')}`);
    }

    // Get league budget from fantasy_leagues
    const leagueResult = await fantasySql`
      SELECT budget_per_team, max_squad_size 
      FROM fantasy_leagues 
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    const budgetPerTeam = leagueResult[0]?.budget_per_team || 100.00;

    if (enable) {
      // Check if fantasy team already exists for this league
      const existingTeams = await fantasySql`
        SELECT team_id FROM fantasy_teams
        WHERE real_team_id = ${team_id} AND league_id = ${league_id}
        LIMIT 1
      `;
      
      if (existingTeams.length > 0) {
        // Update existing team
        await fantasySql`
          UPDATE fantasy_teams
          SET is_enabled = true,
              owner_uid = ${ownerUid},
              owner_name = ${ownerName},
              updated_at = CURRENT_TIMESTAMP
          WHERE real_team_id = ${team_id} AND league_id = ${league_id}
        `;
        console.log(`✅ ${teamName} - fantasy re-enabled (existing record updated)`);
      } else {
        // Create new fantasy team in PostgreSQL
        await fantasySql`
          INSERT INTO fantasy_teams (
            team_id,
            league_id,
            real_team_id,
            real_team_name,
            owner_uid,
            owner_name,
            team_name,
            budget_remaining,
            is_enabled
          ) VALUES (
            ${team_id},
            ${league_id},
            ${team_id},
            ${teamName},
            ${ownerUid},
            ${ownerName},
            ${teamName},
            ${budgetPerTeam},
            true
          )
        `;
        console.log(`✅ ${teamName} - fantasy enabled (new record created)`);
      }
    } else {
      // Disable fantasy team
      await fantasySql`
        UPDATE fantasy_teams
        SET is_enabled = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE real_team_id = ${team_id} AND league_id = ${league_id}
      `;

      console.log(`❌ ${teamName} - fantasy disabled`);
    }

    return NextResponse.json({
      success: true,
      message: `Fantasy ${enable ? 'enabled' : 'disabled'} for ${teamName}`,
      team: {
        id: team_id,
        name: teamName,
        fantasy_participating: enable,
      },
    });
  } catch (error) {
    console.error('Error toggling fantasy for team:', error);
    return NextResponse.json(
      {
        error: 'Failed to toggle fantasy participation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
