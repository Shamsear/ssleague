import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';

/**
 * GET /api/teams/list
 * Returns list of all teams from auction DB
 */
export async function GET() {
  try {
    const teams = await sql`
      SELECT id, name
      FROM teams
      ORDER BY name ASC
    `;

    return NextResponse.json({
      success: true,
      data: teams,
    });
  } catch (error: any) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch teams',
      },
      { status: 500 }
    );
  }
}
