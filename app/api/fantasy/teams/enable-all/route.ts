import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/teams/enable-all
 * Enable fantasy participation for all teams in a season
 * Useful for existing seasons where teams weren't asked during registration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { error: 'Missing required field: season_id' },
        { status: 400 }
      );
    }

    console.log(`🔄 Enabling fantasy participation for all teams in season: ${season_id}`);

    // Ensure fantasy league exists - use new format SSPSLFLS{number}
    const seasonNumber = season_id.replace('SSPSLS', '');
    const league_id = `SSPSLFLS${seasonNumber}`;
    const leagueCheck = await fantasySql`
      SELECT * FROM fantasy_leagues WHERE league_id = ${league_id} LIMIT 1
    `;
    
    if (leagueCheck.length === 0) {
      // Create league
      const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();
      const seasonData = seasonDoc.data();
      const seasonName = seasonData?.description || seasonData?.season_number || season_id;
      
      await fantasySql`
        INSERT INTO fantasy_leagues (
          league_id, season_id, season_name, league_name,
          budget_per_team, max_squad_size, max_transfers_per_window, points_cost_per_transfer
        ) VALUES (
          ${league_id}, ${season_id}, ${seasonName}, ${'Fantasy League - ' + seasonName},
          100.00, 15, 2, 4
        )
      `;
    }
    
    // Get budget from league
    const budget = leagueCheck[0]?.budget_per_team || 100.00;

    // Get all registered teams for this season
    const teamSeasonsSnap = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', season_id)
      .where('status', '==', 'registered')
      .get();

    if (teamSeasonsSnap.empty) {
      return NextResponse.json(
        { error: 'No registered teams found for this season' },
        { status: 404 }
      );
    }

    // Get all team IDs
    const teamIds = teamSeasonsSnap.docs.map(doc => doc.data().team_id);
    console.log(`📋 Found ${teamIds.length} registered teams`);

    // Fetch team documents and update in batches
    const results: { updated: string[]; already_enabled: string[]; errors: string[] } = {
      updated: [],
      already_enabled: [],
      errors: [],
    };

    // Process teams in batches of 10 (Firestore 'in' query limit)
    for (let i = 0; i < teamIds.length; i += 10) {
      const batchIds = teamIds.slice(i, i + 10);
      const teamsSnap = await adminDb
        .collection('teams')
        .where('id', 'in', batchIds)
        .get();

      const batch = adminDb.batch();

      for (const doc of teamsSnap.docs) {
        const teamData = doc.data();
        const teamName = teamData.team_name || teamData.id;
        const teamId = teamData.id;
        const ownerUid = teamData.uid || '';
        const ownerName = teamData.owner_name || '';

        try {
          // Insert or update in PostgreSQL
          await fantasySql`
            INSERT INTO fantasy_teams (
              team_id, league_id, real_team_id, real_team_name,
              owner_uid, owner_name, team_name, budget_remaining, is_enabled
            ) VALUES (
              ${teamId}, ${league_id}, ${teamId}, ${teamName},
              ${ownerUid}, ${ownerName}, ${teamName}, ${budget}, true
            )
            ON CONFLICT (team_id)
            DO UPDATE SET is_enabled = true, updated_at = CURRENT_TIMESTAMP
          `;
          
          // Check if was already enabled
          const existing = await fantasySql`
            SELECT is_enabled FROM fantasy_teams 
            WHERE team_id = ${teamId} AND is_enabled = true
          `;
          
          if (existing.length > 0) {
            results.already_enabled.push(teamName);
            console.log(`✓ ${teamName} - already enabled`);
          } else {
            results.updated.push(teamName);
            console.log(`✅ ${teamName} - enabling fantasy`);
          }
        } catch (error) {
          console.error(`Error enabling ${teamName}:`, error);
          results.errors.push(`${teamName}: ${error}`);
        }
      }

      // No batch commit needed for PostgreSQL
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Updated: ${results.updated.length}`);
    console.log(`  ✓ Already enabled: ${results.already_enabled.length}`);
    console.log(`  ❌ Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      message: `Fantasy participation enabled for ${results.updated.length + results.already_enabled.length} teams`,
      details: {
        season_id,
        total_teams: teamIds.length,
        newly_enabled: results.updated.length,
        already_enabled: results.already_enabled.length,
        errors: results.errors.length,
        updated_teams: results.updated,
        already_enabled_teams: results.already_enabled,
        error_messages: results.errors,
      },
    });
  } catch (error) {
    console.error('Error enabling fantasy for teams:', error);
    return NextResponse.json(
      {
        error: 'Failed to enable fantasy participation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fantasy/teams/enable-all?season_id=SEASON_ID
 * Check which teams have fantasy enabled for a season
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const season_id = searchParams.get('season_id');

    if (!season_id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: season_id' },
        { status: 400 }
      );
    }

    // Get all registered teams for this season
    const teamSeasonsSnap = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', season_id)
      .where('status', '==', 'registered')
      .get();

    if (teamSeasonsSnap.empty) {
      return NextResponse.json(
        { error: 'No registered teams found for this season' },
        { status: 404 }
      );
    }

    const teamIds = teamSeasonsSnap.docs.map(doc => doc.data().team_id);
    const teams: { enabled: any[]; disabled: any[] } = {
      enabled: [],
      disabled: [],
    };

    const seasonNumber = season_id.replace('SSPSLS', '');
    const league_id = `SSPSLFLS${seasonNumber}`;

    // Check teams in batches
    for (let i = 0; i < teamIds.length; i += 10) {
      const batchIds = teamIds.slice(i, i + 10);
      const teamsSnap = await adminDb
        .collection('teams')
        .where('id', 'in', batchIds)
        .get();

      for (const doc of teamsSnap.docs) {
        const teamData = doc.data();
        const teamId = teamData.id;
        
        // Check PostgreSQL for fantasy status
        const fantasyTeam = await fantasySql`
          SELECT * FROM fantasy_teams
          WHERE team_id = ${teamId} AND league_id = ${league_id}
          LIMIT 1
        `;
        
        const isEnabled = fantasyTeam.length > 0 && fantasyTeam[0].is_enabled;
        
        const teamInfo = {
          id: teamData.id,
          name: teamData.team_name,
          fantasy_participating: isEnabled,
          fantasy_joined_at: fantasyTeam[0]?.created_at,
        };

        if (isEnabled) {
          teams.enabled.push(teamInfo);
        } else {
          teams.disabled.push(teamInfo);
        }
      }
    }

    return NextResponse.json({
      success: true,
      season_id,
      total_teams: teamIds.length,
      fantasy_enabled_count: teams.enabled.length,
      fantasy_disabled_count: teams.disabled.length,
      teams_with_fantasy: teams.enabled,
      teams_without_fantasy: teams.disabled,
    });
  } catch (error) {
    console.error('Error checking fantasy status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check fantasy status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
