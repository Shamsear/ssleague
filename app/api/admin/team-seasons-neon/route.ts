import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching teams from Neon for season:', seasonId);

    // Fetch teams with their budgets from Neon
    // Use 'id' as the team identifier (e.g., SSPSLT0002)
    const teams = await sql`
      SELECT 
        id,
        firebase_uid,
        name,
        football_budget,
        football_spent
      FROM teams
      WHERE season_id = ${seasonId}
      ORDER BY name
    `;

    console.log(`📊 Found ${teams.length} teams in Neon`);
    if (teams.length > 0) {
      console.log('Sample team:', {
        id: teams[0].id,
        firebase_uid: teams[0].firebase_uid,
        name: teams[0].name,
        football_budget: teams[0].football_budget,
        football_spent: teams[0].football_spent
      });
    }

    return NextResponse.json({
      teams: teams.map(team => ({
        id: team.id, // Team ID like SSPSLT0002
        firebase_uid: team.firebase_uid, // User's Firebase UID
        name: team.name,
        football_budget: team.football_budget ?? 0,
        football_spent: team.football_spent ?? 0
      })),
      debug: {
        seasonId,
        totalTeams: teams.length,
        sampleData: teams.length > 0 ? {
          id: teams[0].id,
          firebase_uid: teams[0].firebase_uid,
          name: teams[0].name,
          football_budget: teams[0].football_budget,
          football_spent: teams[0].football_spent
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching team seasons from Neon:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team seasons', teams: [] },
      { status: 500 }
    );
  }
}
