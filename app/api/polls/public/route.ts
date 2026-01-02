import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/polls/public
 * Fetch public polls list (no authentication required)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'active' or 'closed'
        const limit = parseInt(searchParams.get('limit') || '50');

        const sql = getTournamentDb();

        // Build query
        let query = sql`SELECT poll_id, season_id, poll_type, title_en, title_ml, closes_at, created_at FROM polls WHERE 1=1`;

        // Filter by status
        if (status === 'active') {
            query = sql`${query} AND closes_at > NOW()`;
        } else if (status === 'closed') {
            query = sql`${query} AND closes_at <= NOW()`;
        }

        // Order by creation date (newest first)
        query = sql`${query} ORDER BY created_at DESC LIMIT ${limit}`;

        const polls = await query;

        // Calculate total votes and status for each poll
        const pollsWithStats = polls.map((poll: any) => {
            // Parse options if stored as JSON string
            let totalVotes = 0;
            if (poll.options) {
                try {
                    const options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;
                    if (Array.isArray(options)) {
                        totalVotes = options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }

            // Determine status
            const now = new Date();
            const closesAt = new Date(poll.closes_at);
            const pollStatus = closesAt < now ? 'closed' : 'active';

            return {
                poll_id: poll.poll_id,
                season_id: poll.season_id,
                poll_type: poll.poll_type,
                title_en: poll.title_en,
                title_ml: poll.title_ml,
                closes_at: poll.closes_at,
                created_at: poll.created_at,
                total_votes: totalVotes,
                status: pollStatus,
            };
        });

        return NextResponse.json({
            success: true,
            data: pollsWithStats,
            count: pollsWithStats.length,
        });
    } catch (error: any) {
        console.error('Error fetching public polls:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
