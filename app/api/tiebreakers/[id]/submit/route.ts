import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { isTiebreakerExpired, allTeamsSubmitted, resolveTiebreaker } from '@/lib/tiebreaker';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/tiebreakers/[id]/submit
 * Submit a new bid for a tiebreaker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const { id: tiebreakerId } = await params;
    const body = await request.json();
    const { newBidAmount } = body;

    console.log('🔍 Tiebreaker submission received:');
    console.log('   User ID:', userId);
    console.log('   Tiebreaker ID:', tiebreakerId);
    console.log('   Request body:', body);
    console.log('   New bid amount:', newBidAmount, 'Type:', typeof newBidAmount);

    if (!newBidAmount || typeof newBidAmount !== 'number' || newBidAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid bid amount is required' },
        { status: 400 }
      );
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    // Use userId directly as team_id (since team_id in bids is the user's UID)
    const teamId = userId;

    // Fetch tiebreaker details
    const tiebreakerResult = await sql`
      SELECT 
        t.*
      FROM tiebreakers t
      WHERE t.id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerResult[0];

    // Check if tiebreaker is still active
    if (tiebreaker.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker is no longer active' },
        { status: 400 }
      );
    }

    // Check if tiebreaker has expired
    const expired = await isTiebreakerExpired(tiebreakerId);
    if (expired) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker has expired' },
        { status: 400 }
      );
    }

    // Check if team is part of this tiebreaker
    const teamTiebreakerResult = await sql`
      SELECT 
        tt.*,
        b.team_id
      FROM team_tiebreakers tt
      INNER JOIN bids b ON tt.original_bid_id = b.id
      WHERE tt.tiebreaker_id = ${tiebreakerId}
      AND b.team_id = ${teamId}
    `;

    if (teamTiebreakerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team is not part of this tiebreaker' },
        { status: 403 }
      );
    }

    const teamTiebreaker = teamTiebreakerResult[0];

    // Check if team has already submitted
    if (teamTiebreaker.submitted) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You have already submitted a bid for this tiebreaker. Each team can only submit once.' 
        },
        { status: 400 }
      );
    }
    
    // Validate that new bid is at least equal to the tied bid amount (minimum)
    if (newBidAmount < tiebreaker.original_amount) {
      return NextResponse.json(
        { 
          success: false, 
          error: `New bid must be at least £${tiebreaker.original_amount.toLocaleString()} (the tied bid amount)` 
        },
        { status: 400 }
      );
    }

    // Check team budget from team_seasons
    const roundResult = await sql`
      SELECT season_id FROM rounds WHERE id = ${tiebreaker.round_id}
    `;
    const seasonId = roundResult[0]?.season_id;
    
    if (seasonId) {
      const teamSeasonId = `${teamId}_${seasonId}`;
      const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
      
      if (teamSeasonDoc.exists) {
        const teamData = teamSeasonDoc.data();
        const budgetRemaining = teamData?.budget || 0;
        
        console.log(`Team ${teamId} budget check: budget=${budgetRemaining}, newBid=${newBidAmount}`);
        
        if (newBidAmount > budgetRemaining) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Insufficient budget. Available: £${budgetRemaining.toLocaleString()}` 
            },
            { status: 400 }
          );
        }
      } else {
        console.warn(`Team season doc not found for ${teamSeasonId}`);
        return NextResponse.json(
          { success: false, error: 'Team budget information not found' },
          { status: 400 }
        );
      }
    }

    // Update team_tiebreaker with new bid
    console.log('💾 Updating database with:');
    console.log('   Team tiebreaker ID:', teamTiebreaker.id);
    console.log('   New bid amount:', newBidAmount);
    
    const updateResult = await sql`
      UPDATE team_tiebreakers
      SET 
        new_bid_amount = ${newBidAmount},
        submitted = true,
        submitted_at = NOW()
      WHERE id = ${teamTiebreaker.id}
      RETURNING *
    `;
    
    console.log('✅ Database updated:', updateResult[0]);
    console.log(`✅ Team ${teamId} submitted tiebreaker bid: £${newBidAmount}`);

    // Check if all teams have now submitted - if so, auto-resolve
    const allSubmitted = await allTeamsSubmitted(tiebreakerId);
    
    if (allSubmitted) {
      console.log(`🎯 All teams submitted for tiebreaker ${tiebreakerId} - auto-resolving...`);
      
      // Get round ID for this tiebreaker
      const tiebreakerInfo = await sql`
        SELECT round_id FROM tiebreakers WHERE id = ${tiebreakerId}
      `;
      const roundId = tiebreakerInfo[0]?.round_id;
      
      // Automatically resolve the tiebreaker
      const resolutionResult = await resolveTiebreaker(tiebreakerId, 'auto');
      
      if (!resolutionResult.success) {
        console.error('⚠️ Auto-resolution failed:', resolutionResult.error);
        return NextResponse.json({
          success: true,
          message: 'Bid submitted but resolution failed',
          data: {
            tiebreakerId,
            newBidAmount,
            submittedAt: new Date().toISOString(),
            autoResolved: false,
            resolutionError: resolutionResult.error,
          },
        });
      }
      
      console.log('✅ Tiebreaker resolved:', resolutionResult.data);
      
      // If status is 'resolved' (not tied_again), trigger finalization
      if (resolutionResult.data?.status === 'resolved' && roundId) {
        console.log(`🚀 Tiebreaker resolved - auto-triggering round finalization...`);
        
        // Automatically finalize the round
        const finalizationResult = await finalizeRound(roundId);
        
        if (finalizationResult.success) {
          console.log('✅ Round finalized automatically!');
          
          // Apply results to database
          const applyResult = await applyFinalizationResults(
            roundId,
            finalizationResult.allocations
          );
          
          if (applyResult.success) {
            return NextResponse.json({
              success: true,
              message: 'Tiebreaker resolved and round finalized automatically!',
              data: {
                tiebreakerId,
                newBidAmount,
                submittedAt: new Date().toISOString(),
                autoResolved: true,
                resolution: resolutionResult.data,
                roundFinalized: true,
                allocations: finalizationResult.allocations.length,
              },
            });
          } else {
            console.error('⚠️ Failed to apply finalization results');
          }
        } else if (finalizationResult.tieDetected) {
          // Another tie detected - new tiebreaker created
          console.log('⚠️ Another tie detected - new tiebreaker created');
          return NextResponse.json({
            success: true,
            message: 'Tiebreaker resolved but another tie detected',
            data: {
              tiebreakerId,
              newBidAmount,
              submittedAt: new Date().toISOString(),
              autoResolved: true,
              resolution: resolutionResult.data,
              roundFinalized: false,
              newTiebreakerId: finalizationResult.tiebreakerId,
              message: 'Another tie detected - resolve new tiebreaker',
            },
          });
        }
      }
      
      // Status is 'tied_again' - new tiebreaker already created
      return NextResponse.json({
        success: true,
        message: 'Bid submitted and tiebreaker resolved',
        data: {
          tiebreakerId,
          newBidAmount,
          submittedAt: new Date().toISOString(),
          autoResolved: true,
          resolution: resolutionResult.data,
          roundFinalized: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Bid submitted successfully',
      data: {
        tiebreakerId,
        newBidAmount,
        submittedAt: new Date().toISOString(),
        autoResolved: false,
      },
    });
  } catch (error: any) {
    console.error('Error submitting tiebreaker bid:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
