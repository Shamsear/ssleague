import { NextRequest, NextResponse } from 'next/server';
import { sendManualWarning } from '@/lib/lineup-notifications';

/**
 * Send manual warning to team for missing lineup
 * Called by committee members
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, team_id, team_name, round_number, match_number } = body;

    if (!fixture_id || !team_id || !team_name || !round_number || !match_number) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    const result = await sendManualWarning(
      fixture_id,
      team_id,
      team_name,
      round_number,
      match_number
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error sending warning:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send warning' },
      { status: 500 }
    );
  }
}
