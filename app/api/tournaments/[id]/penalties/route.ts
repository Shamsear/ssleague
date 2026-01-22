import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - List all penalties for a tournament
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { id } = await params;
        const searchParams = request.nextUrl.searchParams;
        const teamId = searchParams.get('team_id');
        const activeOnly = searchParams.get('active_only') === 'true';

        let penalties;

        if (teamId) {
            // Get penalties for specific team
            if (activeOnly) {
                penalties = await sql`
          SELECT * FROM tournament_penalties
          WHERE tournament_id = ${id}
          AND team_id = ${teamId}
          AND is_active = true
          ORDER BY applied_at DESC
        `;
            } else {
                penalties = await sql`
          SELECT * FROM tournament_penalties
          WHERE tournament_id = ${id}
          AND team_id = ${teamId}
          ORDER BY applied_at DESC
        `;
            }
        } else {
            // Get all penalties for tournament
            if (activeOnly) {
                penalties = await sql`
          SELECT * FROM tournament_penalties
          WHERE tournament_id = ${id}
          AND is_active = true
          ORDER BY applied_at DESC
        `;
            } else {
                penalties = await sql`
          SELECT * FROM tournament_penalties
          WHERE tournament_id = ${id}
          ORDER BY applied_at DESC
        `;
            }
        }

        return NextResponse.json({ success: true, penalties });
    } catch (error) {
        console.error('Error fetching penalties:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch penalties' },
            { status: 500 }
        );
    }
}

// POST - Apply a new penalty
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { id } = await params;
        const body = await request.json();
        const {
            season_id,
            team_id,
            team_name,
            points_deducted,
            ecoin_fine,
            sscoin_fine,
            reason,
            applied_by_id,
            applied_by_name,
        } = body;

        // Validation
        if (!team_id || !team_name || !points_deducted || !reason || !applied_by_id || !applied_by_name) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (points_deducted <= 0) {
            return NextResponse.json(
                { success: false, error: 'Points deducted must be positive' },
                { status: 400 }
            );
        }

        if (reason.length < 10) {
            return NextResponse.json(
                { success: false, error: 'Reason must be at least 10 characters' },
                { status: 400 }
            );
        }

        // Fetch current team balance before applying penalty (for WhatsApp message)
        let oldEcoinBalance = 0;
        let oldSscoinBalance = 0;

        if (season_id && (ecoin_fine > 0 || sscoin_fine > 0)) {
            try {
                const { adminDb } = await import('@/lib/firebase/admin');
                const teamSeasonRef = adminDb.collection('team_seasons').doc(`${team_id}_${season_id}`);
                const teamSeasonDoc = await teamSeasonRef.get();

                if (teamSeasonDoc.exists) {
                    const data = teamSeasonDoc.data();
                    oldEcoinBalance = data?.football_budget || 0;
                    oldSscoinBalance = data?.real_player_budget || 0;
                }
            } catch (error) {
                console.warn('Could not fetch team balance for WhatsApp message:', error);
            }
        }

        // Insert penalty
        const penalty = await sql`
      INSERT INTO tournament_penalties (
        tournament_id,
        season_id,
        team_id,
        team_name,
        points_deducted,
        ecoin_fine,
        sscoin_fine,
        reason,
        applied_by_id,
        applied_by_name
      ) VALUES (
        ${id},
        ${season_id},
        ${team_id},
        ${team_name},
        ${points_deducted},
        ${ecoin_fine || 0},
        ${sscoin_fine || 0},
        ${reason},
        ${applied_by_id},
        ${applied_by_name}
      )
      RETURNING *
    `;

        // Update teamstats - calculate total active penalties for this team
        const activePenalties = await sql`
      SELECT COALESCE(SUM(points_deducted), 0) as total
      FROM tournament_penalties
      WHERE tournament_id = ${id}
      AND team_id = ${team_id}
      AND is_active = true
    `;

        const totalPenalties = activePenalties[0].total;

        console.log(`📊 Total active penalties for ${team_name}: ${totalPenalties} points`);

        // Update teamstats
        const updateResult = await sql`
      UPDATE teamstats
      SET points_deducted = ${totalPenalties},
          updated_at = NOW()
      WHERE tournament_id = ${id}
      AND team_id = ${team_id}
    `;

        console.log(`✅ Teamstats update result: ${updateResult.count} row(s) affected`);

        if (updateResult.count === 0) {
            console.warn(`⚠️ No teamstats row found for tournament ${id}, team ${team_id}`);
        }

        // Deduct fines from Firebase team_seasons budget
        if (season_id && (ecoin_fine > 0 || sscoin_fine > 0)) {
            try {
                const { adminDb } = await import('@/lib/firebase/admin');
                const { FieldValue } = await import('firebase-admin/firestore');
                const teamSeasonRef = adminDb.collection('team_seasons').doc(`${team_id}_${season_id}`);

                const updateData: any = {
                    updated_at: FieldValue.serverTimestamp()
                };

                if (ecoin_fine > 0) {
                    updateData.football_budget = FieldValue.increment(-ecoin_fine);
                }

                if (sscoin_fine > 0) {
                    updateData.real_player_budget = FieldValue.increment(-sscoin_fine);
                }

                await teamSeasonRef.update(updateData);

                // Also create a transaction record
                await adminDb.collection('transactions').add({
                    team_id,
                    season_id,
                    transaction_type: 'penalty_fine',
                    amount_football: ecoin_fine > 0 ? -ecoin_fine : 0,
                    amount_real: sscoin_fine > 0 ? -sscoin_fine : 0,
                    description: `Penalty: ${reason.substring(0, 100)}`,
                    created_at: FieldValue.serverTimestamp()
                });

                console.log(`✅ Firebase budgets updated: ECoin -${ecoin_fine}, SSCoin -${sscoin_fine}`);
            } catch (error) {
                console.error('Error updating Firebase budgets:', error);
                // Don't fail the whole operation if Firebase update fails
            }
        }

        // Deduct ECoin fine from auction DB teams table
        if (season_id && ecoin_fine > 0) {
            try {
                const { getAuctionDb } = await import('@/lib/neon/auction-config');
                const auctionSql = getAuctionDb();

                await auctionSql`
                    UPDATE teams
                    SET football_budget = COALESCE(football_budget, 0) - ${ecoin_fine},
                        updated_at = NOW()
                    WHERE id = ${team_id}
                    AND season_id = ${season_id}
                `;

                console.log(`✅ Auction DB football_budget updated: -${ecoin_fine}`);
            } catch (error) {
                console.error('Error updating auction DB:', error);
                // Don't fail the whole operation if auction DB update fails
            }
        }

        console.log(`✅ Penalty applied: ${team_name} -${points_deducted} points, ECoin: ${ecoin_fine || 0}, SSCoin: ${sscoin_fine || 0} (${reason})`);

        // Generate WhatsApp message
        let whatsappMessage = `⚠️ *PENALTY NOTICE*\n\n`;
        whatsappMessage += `🏆 *Tournament:* ${id}\n`;
        whatsappMessage += `👥 *Team:* ${team_name}\n\n`;
        whatsappMessage += `📋 *Penalty Details:*\n`;
        whatsappMessage += `   ⚽ Points Deducted: *${points_deducted}*\n`;

        if (ecoin_fine && ecoin_fine > 0) {
            whatsappMessage += `   💰 ECoin Fine: *${ecoin_fine.toLocaleString()}*\n`;
        }
        if (sscoin_fine && sscoin_fine > 0) {
            whatsappMessage += `   💵 SSCoin Fine: *${sscoin_fine.toLocaleString()}*\n`;
        }

        // Add balance information if fines were applied
        if ((ecoin_fine > 0 || sscoin_fine > 0) && (oldEcoinBalance > 0 || oldSscoinBalance > 0)) {
            whatsappMessage += `\n💳 *Updated Balance:*\n`;

            if (ecoin_fine > 0) {
                const newEcoin = oldEcoinBalance - ecoin_fine;
                whatsappMessage += `   💰 ECoin: ${oldEcoinBalance.toLocaleString()} → *${newEcoin.toLocaleString()}*\n`;
            }

            if (sscoin_fine > 0) {
                const newSscoin = oldSscoinBalance - sscoin_fine;
                whatsappMessage += `   💵 SSCoin: ${oldSscoinBalance.toLocaleString()} → *${newSscoin.toLocaleString()}*\n`;
            }
        }


        whatsappMessage += `\n📝 *Reason:*\n${reason}\n\n`;
        whatsappMessage += `👤 Applied by: ${applied_by_name}\n`;
        whatsappMessage += `📅 Date: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`;

        return NextResponse.json({
            success: true,
            penalty: penalty[0],
            message: `${points_deducted} points deducted from ${team_name}`,
            whatsapp_message: whatsappMessage,
        });
    } catch (error) {
        console.error('Error applying penalty:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to apply penalty' },
            { status: 500 }
        );
    }
}
