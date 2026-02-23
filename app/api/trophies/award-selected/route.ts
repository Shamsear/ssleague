import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, trophies } = body;

    if (!season_id || !trophies || !Array.isArray(trophies)) {
      return NextResponse.json(
        { success: false, error: 'season_id and trophies array are required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    let trophiesAwarded = 0;
    const awards = [];

    console.log(`🏆 Awarding ${trophies.length} selected trophies for season ${season_id}...`);

    for (const trophy of trophies) {
      console.log(`  📋 Awarding: ${trophy.trophy_name} to ${trophy.team_name}`);
      
      try {
        const result = await sql`
          INSERT INTO team_trophies (
            team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, position, awarded_by
          )
          VALUES (
            ${trophy.team_id}, ${trophy.team_name}, ${season_id}, ${trophy.trophy_type},
            ${trophy.tournament_name}, ${trophy.trophy_name.replace(trophy.tournament_name, '').trim()}, 
            ${trophy.position}, 'system'
          )
          ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
          RETURNING *
        `;

        if (result.length > 0) {
          trophiesAwarded++;
          awards.push({
            team_name: trophy.team_name,
            trophy_name: trophy.trophy_name,
            position: trophy.position
          });
          console.log(`    ✅ Awarded`);
        } else {
          console.log(`    ℹ️  Already awarded`);
        }
      } catch (err) {
        console.error(`    ❌ Error awarding trophy:`, err);
      }
    }

    console.log(`\n🏆 Selected trophies award complete: ${trophiesAwarded} new trophies awarded`);

    return NextResponse.json({
      success: true,
      trophiesAwarded,
      awards,
      message: `Successfully awarded ${trophiesAwarded} trophies`
    });

  } catch (error: any) {
    console.error('❌ Error awarding selected trophies:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to award trophies' },
      { status: 500 }
    );
  }
}
