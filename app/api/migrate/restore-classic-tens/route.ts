import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Emergency restoration for Classic Tens team that was overwritten
 */
export async function POST(request: NextRequest) {
  try {
    const teamDocId = 'SSPSLT0001';
    
    console.log(`🔄 Restoring Classic Tens team data...`);

    // Classic Tens original data
    const classicTensData = {
      id: 'SSPSLT0001',
      team_name: 'Classic Tens',
      teamName: 'Classic Tens', // Add both for consistency
      owner_name: 'AKSHAY',
      userId: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
      user_id: 'peqzXzrQDRTYLRtgbdWcOTE36c63', // Add both for consistency
      uid: 'peqzXzrQDRTYLRtgbdWcOTE36c63', // Add this too
      userEmail: 'classictens@historical.team',
      email: 'classictens@historical.team', // Add both for consistency
      logoUrl: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
      logo_url: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
      teamLogo: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
      
      current_season_id: 'SSPSLS15',
      seasons: ['SSPSLS15'],
      
      is_active: true,
      isActive: true,
      is_historical: true,
      
      hasUserAccount: true,
      
      name_history: [],
      previous_names: [],
      
      total_seasons_participated: 1,
      
      // Add standard fields that might be missing
      role: 'team',
      
      // Approval fields (auto-approved for historical team)
      is_approved: true,
      isApproved: true,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: 'system',
      
      committeeId: '',
      players: [],
      
      created_at: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      
      // Fantasy fields
      fantasy_participating: false,
      fantasy_joined_at: null,
      fantasy_league_id: null,
      fantasy_player_points: 0,
      fantasy_team_bonus_points: 0,
      fantasy_total_points: 0,
      
      manager_name: ''
    };

    // Restore the document
    await adminDb.collection('teams').doc(teamDocId).set(classicTensData, { merge: true });

    console.log(`✅ Restored Classic Tens team data`);

    return NextResponse.json({
      success: true,
      message: 'Successfully restored Classic Tens team data',
      data: {
        team_id: teamDocId,
        team_name: 'Classic Tens',
        owner_name: 'AKSHAY',
      },
    });

  } catch (error) {
    console.error('Restoration error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to restore Classic Tens',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
