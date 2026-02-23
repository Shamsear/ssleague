import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getFantasyDb } from '@/lib/neon/fantasy-config';

// GET - Fetch all awards/trophies with their display order
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    const sql = getTournamentDb();
    const fantasySql = getFantasyDb();

    // Fetch awards
    const awardsQuery = seasonId && seasonId !== 'all'
      ? sql`SELECT id, award_type, player_name, season_id, selected_at, display_order, round_number, week_number, instagram_link FROM awards WHERE season_id = ${seasonId} ORDER BY display_order DESC, selected_at DESC`
      : sql`SELECT id, award_type, player_name, season_id, selected_at, display_order, round_number, week_number, instagram_link FROM awards ORDER BY display_order DESC, selected_at DESC`;

    // Fetch player awards
    const playerAwardsQuery = seasonId && seasonId !== 'all'
      ? sql`SELECT id, award_type, player_name, season_id, created_at, display_order, award_position, instagram_link FROM player_awards WHERE season_id = ${seasonId} ORDER BY display_order DESC, created_at DESC`
      : sql`SELECT id, award_type, player_name, season_id, created_at, display_order, award_position, instagram_link FROM player_awards ORDER BY display_order DESC, created_at DESC`;

    // Fetch trophies
    const trophiesQuery = seasonId && seasonId !== 'all'
      ? sql`SELECT id, trophy_name, team_name, season_id, created_at, display_order, trophy_position, instagram_link FROM team_trophies WHERE season_id = ${seasonId} ORDER BY display_order DESC, created_at DESC`
      : sql`SELECT id, trophy_name, team_name, season_id, created_at, display_order, trophy_position, instagram_link FROM team_trophies ORDER BY display_order DESC, created_at DESC`;

    const [awards, playerAwards, trophies] = await Promise.all([
      awardsQuery,
      playerAwardsQuery,
      trophiesQuery
    ]);

    // Combine and format items
    const items = [
      ...awards.map((a: any) => ({
        id: a.id,
        type: 'award',
        title: a.award_type,
        subtitle: a.player_name || 'Unknown',
        season_id: a.season_id,
        display_order: a.display_order || 0,
        date: a.selected_at,
        round_number: a.round_number,
        week_number: a.week_number,
        instagram_link: a.instagram_link,
        meta: a.round_number ? `Round ${a.round_number}` : a.week_number ? `Week ${a.week_number}` : 'Season Award'
      })),
      ...playerAwards.map((p: any) => ({
        id: p.id,
        type: 'player_award',
        title: p.award_type,
        subtitle: `${p.player_name}${p.award_position ? ` - ${p.award_position}` : ''}`,
        season_id: p.season_id,
        display_order: p.display_order || 0,
        date: p.created_at,
        instagram_link: p.instagram_link,
        meta: p.award_position || 'Winner'
      })),
      ...trophies.map((t: any) => ({
        id: t.id,
        type: 'trophy',
        title: t.trophy_name,
        subtitle: `${t.team_name}${t.trophy_position ? ` - ${t.trophy_position}` : ''}`,
        season_id: t.season_id,
        display_order: t.display_order || 0,
        date: t.created_at,
        instagram_link: t.instagram_link,
        meta: t.trophy_position || 'Winner'
      }))
    ];

    // Sort by display_order (desc) then by date (desc)
    items.sort((a, b) => {
      if (b.display_order !== a.display_order) {
        return b.display_order - a.display_order;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Get unique seasons
    const seasons = [...new Set(items.map(i => i.season_id))].sort().reverse();

    return NextResponse.json({
      success: true,
      items,
      seasons
    });

  } catch (error: any) {
    console.error('Error fetching awards order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// POST - Update display order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { success: false, error: 'updates array is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Group updates by type
    const awardUpdates = updates.filter(u => u.type === 'award');
    const playerAwardUpdates = updates.filter(u => u.type === 'player_award');
    const trophyUpdates = updates.filter(u => u.type === 'trophy');

    // Update each type
    for (const update of awardUpdates) {
      await sql`
        UPDATE awards 
        SET display_order = ${update.display_order}
        WHERE id = ${update.id}
      `;
    }

    for (const update of playerAwardUpdates) {
      await sql`
        UPDATE player_awards 
        SET display_order = ${update.display_order}
        WHERE id = ${update.id}
      `;
    }

    for (const update of trophyUpdates) {
      await sql`
        UPDATE team_trophies 
        SET display_order = ${update.display_order}
        WHERE id = ${update.id}
      `;
    }

    console.log(`✅ Updated display order for ${updates.length} items`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} items`
    });

  } catch (error: any) {
    console.error('Error updating awards order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update order' },
      { status: 500 }
    );
  }
}
