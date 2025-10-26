import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { fixtures } = await request.json();

    if (!fixtures || !Array.isArray(fixtures) || fixtures.length === 0) {
      return NextResponse.json(
        { error: 'fixtures array is required' },
        { status: 400 }
      );
    }

    console.log(`📥 Inserting ${fixtures.length} fixtures into Neon...`);

    // Insert fixtures one by one (could be optimized with bulk insert)
    for (const fixture of fixtures) {
      await sql`
        INSERT INTO fixtures (
          id,
          season_id,
          round_number,
          match_number,
          home_team_id,
          away_team_id,
          home_team_name,
          away_team_name,
          status,
          leg,
          scheduled_date,
          created_at,
          updated_at
        ) VALUES (
          ${fixture.id},
          ${fixture.season_id},
          ${fixture.round_number},
          ${fixture.match_number},
          ${fixture.home_team_id},
          ${fixture.away_team_id},
          ${fixture.home_team_name},
          ${fixture.away_team_name},
          ${fixture.status || 'scheduled'},
          ${fixture.leg || 'first'},
          ${fixture.scheduled_date || null},
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          season_id = EXCLUDED.season_id,
          round_number = EXCLUDED.round_number,
          match_number = EXCLUDED.match_number,
          home_team_id = EXCLUDED.home_team_id,
          away_team_id = EXCLUDED.away_team_id,
          home_team_name = EXCLUDED.home_team_name,
          away_team_name = EXCLUDED.away_team_name,
          status = EXCLUDED.status,
          leg = EXCLUDED.leg,
          scheduled_date = EXCLUDED.scheduled_date,
          updated_at = NOW()
      `;
    }

    console.log(`✅ Successfully inserted ${fixtures.length} fixtures`);

    return NextResponse.json({ 
      success: true, 
      message: `${fixtures.length} fixtures saved successfully` 
    });
  } catch (error) {
    console.error('Error saving fixtures to Neon:', error);
    return NextResponse.json(
      { error: 'Failed to save fixtures', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
