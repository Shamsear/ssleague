import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/polls/[pollId]
 * Fetch a single poll by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pollId: string }> }
) {
    try {
        const { pollId } = await params; // Await params in Next.js 15
        const sql = getTournamentDb();

        console.log(`🔍 Fetching poll with ID: ${pollId}`);
        const polls = await sql`
      SELECT * FROM polls 
      WHERE poll_id = ${pollId}
      LIMIT 1
    `;

        console.log(`📊 Found ${polls.length} polls`);
        if (polls.length === 0) {
            console.log(`❌ Poll not found: ${pollId}`);
            return NextResponse.json(
                { success: false, error: 'Poll not found' },
                { status: 404 }
            );
        }

        const poll = polls[0];

        // Parse options if stored as JSON string
        if (poll.options && typeof poll.options === 'string') {
            try {
                poll.options = JSON.parse(poll.options);
            } catch (e) {
                console.error('Error parsing poll options:', e);
            }
        }

        // Calculate total votes from options
        if (Array.isArray(poll.options)) {
            poll.total_votes = poll.options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
        }

        // Determine status
        const now = new Date();
        const closesAt = new Date(poll.closes_at);
        poll.status = closesAt < now ? 'closed' : 'active';

        return NextResponse.json({
            success: true,
            poll,
        });
    } catch (error: any) {
        console.error('Error fetching poll:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/polls/[pollId]
 * Update poll details (deadline, etc.)
 * Note: Authentication is handled at the frontend level (committee admin only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ pollId: string }> }
) {
    try {
        const { pollId } = await params;
        const sql = getTournamentDb();
        const body = await request.json();
        const { closes_at } = body;

        if (!closes_at) {
            return NextResponse.json(
                { success: false, error: 'closes_at is required' },
                { status: 400 }
            );
        }

        // Validate date format
        const closesAtDate = new Date(closes_at);
        if (isNaN(closesAtDate.getTime())) {
            return NextResponse.json(
                { success: false, error: 'Invalid date format' },
                { status: 400 }
            );
        }

        // Update the poll
        await sql`
            UPDATE polls
            SET closes_at = ${closes_at},
                updated_at = NOW()
            WHERE poll_id = ${pollId}
        `;

        console.log(`✅ Updated poll ${pollId} deadline to ${closes_at}`);

        return NextResponse.json({
            success: true,
            message: 'Poll deadline updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating poll:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
