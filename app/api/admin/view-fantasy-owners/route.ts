import { NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

export async function GET() {
  try {
    const teams = await fantasySql`
      SELECT 
        id,
        team_id,
        league_id,
        real_team_name,
        team_name,
        owner_uid,
        owner_name,
        total_points,
        rank
      FROM fantasy_teams
      ORDER BY id ASC
    `;
    
    return NextResponse.json({
      success: true,
      teams: teams.map((t: any) => ({
        id: t.id,
        team_id: t.team_id,
        league_id: t.league_id,
        real_team_name: t.real_team_name,
        team_name: t.team_name,
        owner_uid: t.owner_uid || '(empty)',
        owner_name: t.owner_name || '(empty)',
        total_points: t.total_points,
        rank: t.rank
      }))
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}
