import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

const VALID_REACTIONS = ['like', 'dislike', 'love', 'funny', 'wow', 'sad', 'angry', 'insightful', 'inspiring'];

export async function POST(
  request: NextRequest,
  { params }: { params: { newsId: string } }
) {
  try {
    const { newsId } = params;
    const { reaction_type, device_fingerprint, user_id } = await request.json();

    if (!VALID_REACTIONS.includes(reaction_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reaction type' },
        { status: 400 }
      );
    }

    if (!device_fingerprint) {
      return NextResponse.json(
        { success: false, error: 'Device fingerprint required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    const ip_address = request.headers.get('x-forwarded-for') || 'unknown';

    // Check if device already reacted
    const existing = await sql`
      SELECT reaction_id, reaction_type
      FROM news_reactions
      WHERE news_id = ${newsId}
        AND device_fingerprint = ${device_fingerprint}
    `;

    const reaction_id = `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (existing.length > 0) {
      const old_type = existing[0].reaction_type;

      // Update reaction
      await sql`
        UPDATE news_reactions
        SET reaction_type = ${reaction_type},
            created_at = NOW()
        WHERE news_id = ${newsId}
          AND device_fingerprint = ${device_fingerprint}
      `;

      // Update counts (decrement old, increment new)
      await sql`
        INSERT INTO news_reaction_counts (news_id, reaction_type, count)
        VALUES (${newsId}, ${old_type}, -1)
        ON CONFLICT (news_id, reaction_type)
        DO UPDATE SET count = news_reaction_counts.count - 1, last_updated = NOW()
      `;

      await sql`
        INSERT INTO news_reaction_counts (news_id, reaction_type, count)
        VALUES (${newsId}, ${reaction_type}, 1)
        ON CONFLICT (news_id, reaction_type)
        DO UPDATE SET count = news_reaction_counts.count + 1, last_updated = NOW()
      `;

      return NextResponse.json({
        success: true,
        message: 'Reaction updated',
        changed_from: old_type
      });
    }

    // New reaction
    await sql`
      INSERT INTO news_reactions (
        reaction_id, news_id, user_id, device_fingerprint,
        reaction_type, ip_address
      ) VALUES (
        ${reaction_id}, ${newsId}, ${user_id || null}, ${device_fingerprint},
        ${reaction_type}, ${ip_address}
      )
    `;

    // Update count
    await sql`
      INSERT INTO news_reaction_counts (news_id, reaction_type, count)
      VALUES (${newsId}, ${reaction_type}, 1)
      ON CONFLICT (news_id, reaction_type)
      DO UPDATE SET count = news_reaction_counts.count + 1, last_updated = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: 'Reaction added',
      reaction_id
    });

  } catch (error: any) {
    console.error('Error adding reaction:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { newsId: string } }
) {
  try {
    const { newsId } = params;
    const { searchParams } = new URL(request.url);
    const device_fingerprint = searchParams.get('device_fingerprint');

    const sql = getTournamentDb();

    // Get counts
    const counts = await sql`
      SELECT reaction_type, count
      FROM news_reaction_counts
      WHERE news_id = ${newsId}
      ORDER BY count DESC
    `;

    // Get user's reaction if device provided
    let user_reaction = null;
    if (device_fingerprint) {
      const user = await sql`
        SELECT reaction_type
        FROM news_reactions
        WHERE news_id = ${newsId}
          AND device_fingerprint = ${device_fingerprint}
      `;
      user_reaction = user[0]?.reaction_type || null;
    }

    return NextResponse.json({
      success: true,
      counts: counts.reduce((acc, row) => ({
        ...acc,
        [row.reaction_type]: row.count
      }), {}),
      user_reaction
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
