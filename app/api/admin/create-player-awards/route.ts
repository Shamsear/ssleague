import { NextRequest, NextResponse } from 'next/server';
import { createPlayerAwardsTable } from '@/lib/neon/playerAwards';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    // Create player_awards table
    await createPlayerAwardsTable();
    
    // Verify table exists and get structure
    const sql = getTournamentDb();
    
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'player_awards'
    `;
    
    if (result.length === 0) {
      throw new Error('Table creation verification failed');
    }
    
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_awards'
      ORDER BY ordinal_position
    `;
    
    return NextResponse.json({
      success: true,
      message: 'player_awards table created successfully (Tournament DB)',
      data: {
        table: 'player_awards',
        columns: columns.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES'
        }))
      }
    });
    
  } catch (error: any) {
    console.error('Error creating player_awards table:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
