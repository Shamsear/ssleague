import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  
  return NextResponse.json({
    success: true,
    message: 'Test route works!',
    teamId: id
  });
}
