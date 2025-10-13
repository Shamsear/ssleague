import { NextRequest, NextResponse } from 'next/server';
import { getTotalPlayerCount, getPlayerCountByPosition } from '@/lib/neon/players';

export async function GET(request: NextRequest) {
  try {
    const [total, byPosition] = await Promise.all([
      getTotalPlayerCount(),
      getPlayerCountByPosition()
    ]);
    
    // Convert array to object for easier frontend use
    const byPositionObj: { [key: string]: number } = {};
    byPosition.forEach(item => {
      byPositionObj[item.position] = item.count;
    });
    
    return NextResponse.json({
      success: true,
      data: {
        total,
        byPosition: byPositionObj
      }
    });
  } catch (error: any) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
