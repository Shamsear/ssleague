import { NextRequest, NextResponse } from 'next/server';
import { isLineupEditable } from '@/lib/lineup-validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const { fixtureId } = await params;
    
    // Get teamId from query params if provided
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('team_id');
    
    const editabilityCheck = await isLineupEditable(fixtureId, teamId || undefined);
    
    return NextResponse.json({
      editable: editabilityCheck.editable,
      reason: editabilityCheck.reason,
      deadline: editabilityCheck.deadline,
      roundStart: editabilityCheck.roundStart,
      homeDeadline: editabilityCheck.homeDeadline,
      awayDeadline: editabilityCheck.awayDeadline
    });
  } catch (error: any) {
    console.error('Error checking lineup editability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check editability', editable: false },
      { status: 500 }
    );
  }
}
