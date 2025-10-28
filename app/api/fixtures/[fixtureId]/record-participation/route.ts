import { NextRequest, NextResponse } from 'next/server';
import { recordPlayerParticipation } from '@/lib/lineup-stats-integration';

/**
 * Record player participation from lineup when match results are submitted
 * This should be called automatically after results are entered
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  try {
    const { fixtureId } = params;

    if (!fixtureId) {
      return NextResponse.json(
        { success: false, error: 'Fixture ID is required' },
        { status: 400 }
      );
    }

    const result = await recordPlayerParticipation(fixtureId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      processed: result.processed
    });
  } catch (error: any) {
    console.error('Error in record-participation endpoint:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record participation' },
      { status: 500 }
    );
  }
}
