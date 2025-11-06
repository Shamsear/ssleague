import { NextResponse } from 'next/server';
import { generateTeamId } from '@/lib/id-generator';

/**
 * Generate a new team ID
 * POST /api/teams/generate-id
 */
export async function POST() {
  try {
    const teamId = await generateTeamId();
    
    return NextResponse.json({
      success: true,
      teamId,
    });
  } catch (error: any) {
    console.error('Error generating team ID:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate team ID',
      },
      { status: 500 }
    );
  }
}
