import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { POSITION_GROUPS } from '@/lib/constants/positions';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting player stats API...');
    const auctionSql = getAuctionDb();
    console.log('✅ Got auction database connection');

    console.log('📊 Fetching football players from auction DB');

    // Fetch all football players from footballplayers (auction DB)
    const players = await auctionSql`
      SELECT 
        player_id,
        name,
        position,
        is_auction_eligible
      FROM footballplayers
      ORDER BY name
    `;

    console.log(`✅ Found ${players.length} football players in auction DB`);

    // Calculate stats
    const total = players.length; // Total players in footballplayers table
    const eligible = players.filter((p: any) => p.is_auction_eligible).length; // Auction-eligible players

    console.log(`📊 Stats: Total=${total}, Eligible=${eligible}`);

    // Group by position - only count eligible players
    const positionGroups: { [key: string]: number } = {
      'GK': 0,
      'DEF': 0,
      'MID': 0,
      'FWD': 0
    };

    players.forEach((player: any) => {
      // Only count eligible players for position groups
      if (!player.is_auction_eligible) return;
      
      const pos = player.position?.toUpperCase();
      
      for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
        if ((positions as readonly string[]).includes(pos)) {
          positionGroups[group]++;
          break;
        }
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        total,
        eligible,
        byPosition: positionGroups
      },
      players
    });
  } catch (error: any) {
    console.error('❌ Error fetching registered players:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch registered players', 
        details: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
