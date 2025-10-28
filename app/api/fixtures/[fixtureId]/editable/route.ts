import { NextRequest, NextResponse } from 'next/server';
import { isLineupEditable } from '@/lib/lineup-validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const { fixtureId } = await params;
    
    const editabilityCheck = await isLineupEditable(fixtureId);
    
    return NextResponse.json({
      editable: editabilityCheck.editable,
      reason: editabilityCheck.reason,
      deadline: editabilityCheck.deadline,
      roundStart: editabilityCheck.roundStart
    });
  } catch (error: any) {
    console.error('Error checking lineup editability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check editability', editable: false },
      { status: 500 }
    );
  }
}
