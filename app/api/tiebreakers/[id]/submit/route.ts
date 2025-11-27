import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { isTiebreakerExpired, allTeamsSubmitted, resolveTiebreaker } from '@/lib/tiebreaker';
import { finalizeRound, applyFinalizationResults } from '@/lib/finalize-round';
import { broadcastTiebreakerBid } from '@/lib/realtime/broadcast';
import { calculateReserve } from '@/lib/reserve-calculator';

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
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId!;
    const { id: tiebreakerId } = await params;
    const body = await request.json();
    const { newBidAmount } = body;

    if (!newBidAmount || typeof newBidAmount !== 'number' || newBidAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid bid amount is required' },
        { status: 400 }
      );
    }
    
    // Get user's team ID from teams table
    let teamId: string | null = null;
    
    // Fetch tiebreaker details first to get season_id
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
    
    // Get season_id to look up team
    const roundResult = await sql`
      SELECT season_id FROM rounds WHERE id = ${tiebreaker.round_id}
    `;
    const seasonId = roundResult[0]?.season_id;
    
    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }
    
    // Get user's team ID from teams table or team_seasons
    const teamResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} AND season_id = ${seasonId} LIMIT 1
    `;
    
    if (teamResult.length > 0) {
      teamId = teamResult[0].id;
    } else {
      // Fallback: Try team_seasons
      let teamSeasonId = `${userId}_${seasonId}`;
      let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
      
      if (!teamSeasonDoc.exists) {
        const teamSeasonQuery = await adminDb.collection('team_seasons')
          .where('user_id', '==', userId)
          .where('season_id', '==', seasonId)
          .where('status', '==', 'registered')
          .limit(1)
          .get();
        
        if (!teamSeasonQuery.empty) {
          teamSeasonDoc = teamSeasonQuery.docs[0];
        }
      }
      
      if (teamSeasonDoc.exists) {
        const teamSeasonData = teamSeasonDoc.data();
        teamId = teamSeasonData?.team_id || null;
      }
    }
    
    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Team not found for user' },
        { status: 403 }
      );
    }

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
      INNER JOIN bids b ON b.id::text = tt.original_bid_id
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
    if (seasonId) {
      let teamSeasonId = `${teamId}_${seasonId}`;
      let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
      
      // Fallback: Query by user_id field if direct lookup fails
      if (!teamSeasonDoc.exists) {
        const teamSeasonQuery = await adminDb.collection('team_seasons')
          .where('user_id', '==', teamId)
          .where('season_id', '==', seasonId)
          .where('status', '==', 'registered')
          .limit(1)
          .get();
        
        if (!teamSeasonQuery.empty) {
          teamSeasonDoc = teamSeasonQuery.docs[0];
          teamSeasonId = teamSeasonDoc.id;
        }
      }
      
      if (teamSeasonDoc.exists) {
        const teamData = teamSeasonDoc.data();
        
        // Determine currency system and get appropriate balance
        const currencySystem = teamData?.currency_system || 'single';
        const isDualCurrency = currencySystem === 'dual';
        
        let budgetRemaining = 0;
        if (isDualCurrency) {
          // For dual currency, use football_budget (since this is for football players)
          budgetRemaining = teamData?.football_budget || 0;
        } else {
          // For single currency, use budget
          budgetRemaining = teamData?.budget || 0;
        }
        
        console.log(`Team ${teamId} budget check: currency=${currencySystem}, budget=${budgetRemaining}, newBid=${newBidAmount}`);
        
        if (newBidAmount > budgetRemaining) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Insufficient budget. Available: £${budgetRemaining.toLocaleString()}` 
            },
            { status: 400 }
          );
        }
        
        // Check phase-based reserve requirement
        try {
          const reserveCheck = await calculateReserve(teamId, tiebreaker.round_id, seasonId);
          
          if (reserveCheck.requiresReserve) {
            const maxAllowedBid = budgetRemaining - reserveCheck.minimumReserve;
            
            if (newBidAmount > maxAllowedBid) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Bid exceeds reserve. You must maintain £${reserveCheck.minimumReserve} for future rounds (${reserveCheck.explanation}). Maximum safe bid: £${Math.max(0, maxAllowedBid)}`
                },
                { status: 400 }
              );
            }
          }
        } catch (reserveErr) {
          console.error('Reserve calculation failed:', reserveErr);
          // Don't block bid if reserve calculation fails
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
        status = 'submitted',
        submitted_at = NOW()
      WHERE id = ${teamTiebreaker.id}
      RETURNING *
    `;
    
    console.log('✅ Database updated:', updateResult[0]);
    console.log(`✅ Team ${teamId} submitted tiebreaker bid: £${newBidAmount}`);
    
    // Broadcast tiebreaker bid update
    await broadcastTiebreakerBid(tiebreakerId, {
      team_id: teamId,
      team_name: updateResult[0].team_name || 'Team',
      bid_amount: newBidAmount,
    });

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
        console.log(`🚀 Tiebreaker resolved - checking round finalization mode...`);
        
        // Check round's finalization mode
        const roundInfo = await sql`
          SELECT finalization_mode, status
          FROM rounds
          WHERE id = ${roundId}
        `;
        
        const finalizationMode = roundInfo[0]?.finalization_mode || 'auto';
        
        if (finalizationMode === 'manual') {
          console.log('📋 Manual finalization mode - creating preview instead of auto-finalizing');
          
          // For manual mode, just run finalization to create pending allocations (preview)
          const finalizationResult = await finalizeRound(roundId);
          
          if (finalizationResult.success) {
            console.log('✅ Preview created - waiting for committee approval');
            
            // Store allocations in pending_allocations table
            console.log(`💾 Storing ${finalizationResult.allocations.length} pending allocations`);
            
            // Clear any existing pending allocations for this round
            await sql`DELETE FROM pending_allocations WHERE round_id = ${roundId}`;
            
            // Insert new pending allocations
            for (const allocation of finalizationResult.allocations) {
              await sql`
                INSERT INTO pending_allocations (
                  round_id,
                  team_id,
                  team_name,
                  player_id,
                  player_name,
                  amount,
                  bid_id,
                  phase,
                  created_at
                ) VALUES (
                  ${roundId},
                  ${allocation.team_id},
                  ${allocation.team_name},
                  ${allocation.player_id},
                  ${allocation.player_name},
                  ${allocation.amount},
                  ${allocation.bid_id},
                  ${allocation.phase},
                  NOW()
                )
              `;
            }
            
            // Update round status from tiebreaker_pending to pending_finalization
            await sql`
              UPDATE rounds
              SET status = 'pending_finalization',
                  updated_at = NOW()
              WHERE id = ${roundId}
            `;
            
            console.log(`✅ Round status updated: tiebreaker_pending -> pending_finalization`);
            
            return NextResponse.json({
              success: true,
              message: 'Tiebreaker resolved! Preview created - awaiting committee approval.',
              data: {
                tiebreakerId,
                newBidAmount,
                submittedAt: new Date().toISOString(),
                autoResolved: true,
                resolution: resolutionResult.data,
                roundFinalized: false,
                previewCreated: true,
                allocations: finalizationResult.allocations.length,
              },
            });
          }
        } else {
          console.log('🚀 Auto finalization mode - finalizing round automatically');
          
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
              console.error('⚠️ Failed to apply finalization results:', applyResult.error);
              return NextResponse.json({
                success: true,
                message: 'Tiebreaker resolved but finalization failed',
                data: {
                  tiebreakerId,
                  newBidAmount,
                  submittedAt: new Date().toISOString(),
                  autoResolved: true,
                  resolution: resolutionResult.data,
                  roundFinalized: false,
                  finalizationError: applyResult.error,
                },
              });
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
