import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/polls/[pollId]/stats
 * Fetch player/team stats for poll candidates using matchups table
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pollId: string }> }
) {
    try {
        const { pollId } = await params;
        const sql = getTournamentDb();

        // Get poll details
        const polls = await sql`
            SELECT poll_id, poll_type, related_round_id, season_id, options
            FROM polls 
            WHERE poll_id = ${pollId}
            LIMIT 1
        `;

        if (polls.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Poll not found' },
                { status: 404 }
            );
        }

        const poll = polls[0];
        const pollType = poll.poll_type;
        const relatedRoundId = poll.related_round_id;

        // Parse options
        const options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

        // Determine if it's a player or team poll
        const isPlayerPoll = pollType.includes('pot'); // POTD or POTW
        const isWeekPoll = pollType.includes('w'); // POTW or TOW

        // Calculate round range
        let startRound, endRound;
        if (isWeekPoll && relatedRoundId) {
            // For week polls, calculate the week from the round
            const roundNum = parseInt(relatedRoundId);
            const weekNum = Math.ceil(roundNum / 7);
            startRound = (weekNum - 1) * 7 + 1;
            endRound = weekNum * 7;
        } else {
            // For day polls, just use the single round
            startRound = relatedRoundId ? parseInt(relatedRoundId) : null;
            endRound = startRound;
        }

        const stats: any = {};

        if (isPlayerPoll) {
            // Fetch player stats from matchups table
            for (const option of options) {
                if (option.player_id) {
                    // Get all matchups for this player
                    const matchups = await sql`
                        SELECT 
                            m.home_player_id,
                            m.away_player_id,
                            m.home_goals,
                            m.away_goals,
                            f.motm_player_id
                        FROM matchups m
                        JOIN fixtures f ON m.fixture_id = f.id
                        WHERE (m.home_player_id = ${option.player_id} OR m.away_player_id = ${option.player_id})
                            AND f.round_number >= ${startRound}
                            AND f.round_number <= ${endRound}
                            AND f.status = 'completed'
                    `;

                    let matches = 0;
                    let goals = 0;
                    let conceded = 0;
                    let wins = 0;
                    let draws = 0;
                    let losses = 0;
                    let cleanSheets = 0;
                    let motm = 0;
                    let points = 0;

                    matchups.forEach((m: any) => {
                        matches++;
                        
                        if (m.home_player_id === option.player_id) {
                            // Player is home
                            goals += m.home_goals || 0;
                            conceded += m.away_goals || 0;
                            const gd = (m.home_goals || 0) - (m.away_goals || 0);
                            points += Math.max(-5, Math.min(5, gd)); // Cap at ±5 per match
                            
                            if (m.home_goals > m.away_goals) wins++;
                            else if (m.home_goals === m.away_goals) draws++;
                            else losses++;
                            
                            if (m.away_goals === 0) cleanSheets++;
                        } else {
                            // Player is away
                            goals += m.away_goals || 0;
                            conceded += m.home_goals || 0;
                            const gd = (m.away_goals || 0) - (m.home_goals || 0);
                            points += Math.max(-5, Math.min(5, gd)); // Cap at ±5 per match
                            
                            if (m.away_goals > m.home_goals) wins++;
                            else if (m.away_goals === m.home_goals) draws++;
                            else losses++;
                            
                            if (m.home_goals === 0) cleanSheets++;
                        }
                        
                        if (m.motm_player_id === option.player_id) motm++;
                    });

                    stats[option.id] = {
                        matches_played: matches,
                        wins: wins,
                        draws: draws,
                        losses: losses,
                        goals_scored: goals,
                        goals_conceded: conceded,
                        goal_difference: goals - conceded,
                        points_gained: points, // Sum of capped GD per match
                        potm_count: motm,
                        clean_sheets: cleanSheets,
                        star_points: 0 // Not available in matchups table
                    };
                }
            }
        } else {
            // Fetch team stats from fixtures
            for (const option of options) {
                if (option.team_id) {
                    // Get stats from fixtures where team is home team
                    const homeStats = await sql`
                        SELECT 
                            COUNT(*) as matches,
                            SUM(f.home_score) as goals,
                            SUM(f.away_score) as conceded,
                            SUM(CASE WHEN f.home_score > f.away_score THEN 1 ELSE 0 END) as wins,
                            SUM(CASE WHEN f.home_score = f.away_score THEN 1 ELSE 0 END) as draws,
                            SUM(CASE WHEN f.home_score < f.away_score THEN 1 ELSE 0 END) as losses
                        FROM fixtures f
                        WHERE f.home_team_id = ${option.team_id}
                            AND f.round_number >= ${startRound}
                            AND f.round_number <= ${endRound}
                            AND f.status = 'completed'
                    `;

                    // Get stats from fixtures where team is away team
                    const awayStats = await sql`
                        SELECT 
                            COUNT(*) as matches,
                            SUM(f.away_score) as goals,
                            SUM(f.home_score) as conceded,
                            SUM(CASE WHEN f.away_score > f.home_score THEN 1 ELSE 0 END) as wins,
                            SUM(CASE WHEN f.away_score = f.home_score THEN 1 ELSE 0 END) as draws,
                            SUM(CASE WHEN f.away_score < f.home_score THEN 1 ELSE 0 END) as losses
                        FROM fixtures f
                        WHERE f.away_team_id = ${option.team_id}
                            AND f.round_number >= ${startRound}
                            AND f.round_number <= ${endRound}
                            AND f.status = 'completed'
                    `;

                    const home = homeStats[0] || { matches: 0, goals: 0, conceded: 0, wins: 0, draws: 0, losses: 0 };
                    const away = awayStats[0] || { matches: 0, goals: 0, conceded: 0, wins: 0, draws: 0, losses: 0 };

                    const totalMatches = Number(home.matches) + Number(away.matches);
                    const totalGoals = Number(home.goals || 0) + Number(away.goals || 0);
                    const totalConceded = Number(home.conceded || 0) + Number(away.conceded || 0);
                    const totalWins = Number(home.wins || 0) + Number(away.wins || 0);
                    const totalDraws = Number(home.draws || 0) + Number(away.draws || 0);
                    const totalLosses = Number(home.losses || 0) + Number(away.losses || 0);

                    stats[option.id] = {
                        matches_played: totalMatches,
                        wins: totalWins,
                        draws: totalDraws,
                        losses: totalLosses,
                        goals_scored: totalGoals,
                        goals_conceded: totalConceded,
                        goal_difference: totalGoals - totalConceded,
                        points: (totalWins * 3) + totalDraws
                    };
                }
            }
        }

        return NextResponse.json({
            success: true,
            stats,
            period: {
                startRound,
                endRound,
                isWeekPoll
            }
        });
    } catch (error: any) {
        console.error('Error fetching poll stats:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
