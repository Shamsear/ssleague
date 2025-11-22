import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';

export async function GET() {
  try {
    // Get unique positions
    const positionsResult = await sql`
      SELECT DISTINCT position 
      FROM footballplayers 
      WHERE position IS NOT NULL 
      ORDER BY position
    `;
    
    // Get unique position groups
    const positionGroupsResult = await sql`
      SELECT DISTINCT position_group 
      FROM footballplayers 
      WHERE position_group IS NOT NULL 
      ORDER BY position_group
    `;
    
    // Get unique playing styles
    const playingStylesResult = await sql`
      SELECT DISTINCT playing_style 
      FROM footballplayers 
      WHERE playing_style IS NOT NULL 
      ORDER BY playing_style
    `;
    
    const positions = positionsResult.map(r => r.position);
    const positionGroups = positionGroupsResult.map(r => r.position_group);
    const playingStyles = playingStylesResult.map(r => r.playing_style);

    return NextResponse.json({
      success: true,
      data: {
        positions,
        positionGroups,
        playingStyles
      }
    });
  } catch (error: any) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch filter options'
      },
      { status: 500 }
    );
  }
}
