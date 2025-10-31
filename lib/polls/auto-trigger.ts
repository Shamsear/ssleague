import { getTournamentDb } from '@/lib/neon/tournament-config';
import {
  createMatchPredictionPoll,
  createPlayerOfMatchPoll,
  createDailyBestPlayerPoll,
  createDailyBestTeamPoll,
  createWeeklyTopPlayerPoll,
  createWeeklyTopTeamPoll,
  createSeasonChampionPoll,
  createSeasonMVPPoll,
} from './poll-helpers';

/**
 * Auto-trigger poll creation when a match is scheduled
 * Creates a match prediction poll that closes when the match starts
 */
export async function triggerMatchPredictionPoll(fixtureId: string): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Fetch fixture details
    const [fixture] = await sql`
      SELECT 
        id, season_id, home_team_id, away_team_id, 
        home_team_name, away_team_name, scheduled_date
      FROM fixtures
      WHERE id = ${fixtureId}
    `;

    if (!fixture) {
      console.error('Fixture not found:', fixtureId);
      return null;
    }

    // Check if poll already exists for this fixture
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'match_prediction'
        AND metadata->>'fixture_id' = ${fixtureId}
    `;

    if (existingPoll) {
      console.log('Match prediction poll already exists for fixture:', fixtureId);
      return existingPoll.id;
    }

    // Create match prediction poll
    const pollId = await createMatchPredictionPoll({
      seasonId: fixture.season_id,
      fixtureId: fixture.id,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeTeamName: fixture.home_team_name,
      awayTeamName: fixture.away_team_name,
      scheduledDate: fixture.scheduled_date,
    });

    console.log('✅ Match prediction poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering match prediction poll:', error);
    return null;
  }
}

/**
 * Auto-trigger player of the match poll after match completion
 */
export async function triggerPlayerOfMatchPoll(fixtureId: string): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Fetch fixture details with participating players
    const [fixture] = await sql`
      SELECT 
        f.id, f.season_id, f.home_team_id, f.away_team_id,
        f.home_team_name, f.away_team_name
      FROM fixtures f
      WHERE f.id = ${fixtureId}
    `;

    if (!fixture) {
      console.error('Fixture not found:', fixtureId);
      return null;
    }

    // Check if poll already exists
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'player_of_match'
        AND metadata->>'fixture_id' = ${fixtureId}
    `;

    if (existingPoll) {
      console.log('Player of match poll already exists for fixture:', fixtureId);
      return existingPoll.id;
    }

    // Fetch players who participated in the match
    const players = await sql`
      SELECT DISTINCT
        p.id, p.current_name as name, p.star_rating,
        COALESCE(lp.team_id, fp.team_id) as team_id
      FROM players p
      LEFT JOIN lineup_players lp ON lp.player_id = p.id AND lp.fixture_id = ${fixtureId}
      LEFT JOIN fixture_participation fp ON fp.player_id = p.id AND fp.fixture_id = ${fixtureId}
      WHERE (lp.player_id IS NOT NULL OR fp.player_id IS NOT NULL)
        AND (lp.team_id IN (${fixture.home_team_id}, ${fixture.away_team_id})
         OR fp.team_id IN (${fixture.home_team_id}, ${fixture.away_team_id}))
      ORDER BY p.star_rating DESC
      LIMIT 20
    `;

    if (players.length === 0) {
      console.log('No players found for fixture:', fixtureId);
      return null;
    }

    // Create player of match poll
    const pollId = await createPlayerOfMatchPoll({
      seasonId: fixture.season_id,
      fixtureId: fixture.id,
      players: players.map((p: any) => ({
        id: p.id,
        name: p.name,
        teamId: p.team_id,
        starRating: p.star_rating,
      })),
    });

    console.log('✅ Player of match poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering player of match poll:', error);
    return null;
  }
}

/**
 * Auto-trigger daily best player poll
 * Should be run at the end of each day that has matches
 */
export async function triggerDailyBestPlayerPoll(seasonId: string, date: Date): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Check if poll already exists for this date
    const dateStr = date.toISOString().split('T')[0];
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'daily_best_player'
        AND season_id = ${seasonId}
        AND metadata->>'date' = ${dateStr}
    `;

    if (existingPoll) {
      console.log('Daily best player poll already exists for date:', dateStr);
      return existingPoll.id;
    }

    // Get matches completed on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const fixtures = await sql`
      SELECT id FROM fixtures
      WHERE season_id = ${seasonId}
        AND status = 'completed'
        AND updated_at >= ${startOfDay.toISOString()}
        AND updated_at <= ${endOfDay.toISOString()}
    `;

    if (fixtures.length === 0) {
      console.log('No completed matches found for date:', dateStr);
      return null;
    }

    const fixtureIds = fixtures.map((f: any) => f.id);

    // Get all players who participated in these matches
    const players = await sql`
      SELECT DISTINCT
        p.id, p.current_name as name, p.star_rating
      FROM players p
      WHERE EXISTS (
        SELECT 1 FROM lineup_players lp
        WHERE lp.player_id = p.id
          AND lp.fixture_id = ANY(${fixtureIds})
      ) OR EXISTS (
        SELECT 1 FROM fixture_participation fp
        WHERE fp.player_id = p.id
          AND fp.fixture_id = ANY(${fixtureIds})
      )
      ORDER BY p.star_rating DESC
      LIMIT 20
    `;

    if (players.length === 0) {
      console.log('No players found for daily poll');
      return null;
    }

    // Create daily best player poll
    const pollId = await createDailyBestPlayerPoll({
      seasonId,
      date: dateStr,
      players: players.map((p: any) => ({
        id: p.id,
        name: p.name,
        starRating: p.star_rating,
      })),
    });

    console.log('✅ Daily best player poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering daily best player poll:', error);
    return null;
  }
}

/**
 * Auto-trigger daily best team poll
 * Should be run at the end of each day that has matches
 */
export async function triggerDailyBestTeamPoll(seasonId: string, date: Date): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Check if poll already exists for this date
    const dateStr = date.toISOString().split('T')[0];
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'daily_best_team'
        AND season_id = ${seasonId}
        AND metadata->>'date' = ${dateStr}
    `;

    if (existingPoll) {
      console.log('Daily best team poll already exists for date:', dateStr);
      return existingPoll.id;
    }

    // Get teams that played on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const teams = await sql`
      SELECT DISTINCT
        t.id, t.name
      FROM teams t
      WHERE EXISTS (
        SELECT 1 FROM fixtures f
        WHERE (f.home_team_id = t.id OR f.away_team_id = t.id)
          AND f.season_id = ${seasonId}
          AND f.status = 'completed'
          AND f.updated_at >= ${startOfDay.toISOString()}
          AND f.updated_at <= ${endOfDay.toISOString()}
      )
      ORDER BY t.name
    `;

    if (teams.length === 0) {
      console.log('No teams found for daily poll');
      return null;
    }

    // Create daily best team poll
    const pollId = await createDailyBestTeamPoll({
      seasonId,
      date: dateStr,
      teams: teams.map((t: any) => ({
        id: t.id,
        name: t.name,
      })),
    });

    console.log('✅ Daily best team poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering daily best team poll:', error);
    return null;
  }
}

/**
 * Auto-trigger weekly top player poll
 * Should be run at the end of each week
 */
export async function triggerWeeklyTopPlayerPoll(seasonId: string, weekNumber: number): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Check if poll already exists for this week
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'weekly_top_player'
        AND season_id = ${seasonId}
        AND metadata->>'week_number' = ${weekNumber.toString()}
    `;

    if (existingPoll) {
      console.log('Weekly top player poll already exists for week:', weekNumber);
      return existingPoll.id;
    }

    // Get top performing players from this week
    // This is a simplified version - you might want to add more sophisticated stats
    const players = await sql`
      SELECT DISTINCT
        p.id, p.current_name as name, p.star_rating
      FROM players p
      JOIN fixture_participation fp ON fp.player_id = p.id
      JOIN fixtures f ON f.id = fp.fixture_id
      WHERE f.season_id = ${seasonId}
        AND f.status = 'completed'
      GROUP BY p.id, p.current_name, p.star_rating
      ORDER BY p.star_rating DESC
      LIMIT 15
    `;

    if (players.length === 0) {
      console.log('No players found for weekly poll');
      return null;
    }

    // Create weekly top player poll
    const pollId = await createWeeklyTopPlayerPoll({
      seasonId,
      weekNumber,
      players: players.map((p: any) => ({
        id: p.id,
        name: p.name,
        starRating: p.star_rating,
      })),
    });

    console.log('✅ Weekly top player poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering weekly top player poll:', error);
    return null;
  }
}

/**
 * Auto-trigger weekly top team poll
 * Should be run at the end of each week
 */
export async function triggerWeeklyTopTeamPoll(seasonId: string, weekNumber: number): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Check if poll already exists for this week
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'weekly_top_team'
        AND season_id = ${seasonId}
        AND metadata->>'week_number' = ${weekNumber.toString()}
    `;

    if (existingPoll) {
      console.log('Weekly top team poll already exists for week:', weekNumber);
      return existingPoll.id;
    }

    // Get all teams in the season
    const teams = await sql`
      SELECT DISTINCT
        t.id, t.name
      FROM teams t
      WHERE EXISTS (
        SELECT 1 FROM fixtures f
        WHERE (f.home_team_id = t.id OR f.away_team_id = t.id)
          AND f.season_id = ${seasonId}
      )
      ORDER BY t.name
    `;

    if (teams.length === 0) {
      console.log('No teams found for weekly poll');
      return null;
    }

    // Create weekly top team poll
    const pollId = await createWeeklyTopTeamPoll({
      seasonId,
      weekNumber,
      teams: teams.map((t: any) => ({
        id: t.id,
        name: t.name,
      })),
    });

    console.log('✅ Weekly top team poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering weekly top team poll:', error);
    return null;
  }
}

/**
 * Auto-trigger season champion poll
 * Should be triggered when finals/semifinals begin
 */
export async function triggerSeasonChampionPoll(seasonId: string): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Check if poll already exists
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'season_champion'
        AND season_id = ${seasonId}
    `;

    if (existingPoll) {
      console.log('Season champion poll already exists');
      return existingPoll.id;
    }

    // Get top teams or all teams depending on tournament stage
    const teams = await sql`
      SELECT DISTINCT
        t.id, t.name
      FROM teams t
      WHERE EXISTS (
        SELECT 1 FROM fixtures f
        WHERE (f.home_team_id = t.id OR f.away_team_id = t.id)
          AND f.season_id = ${seasonId}
      )
      ORDER BY t.name
    `;

    if (teams.length === 0) {
      console.log('No teams found for season champion poll');
      return null;
    }

    // Create season champion poll
    const pollId = await createSeasonChampionPoll({
      seasonId,
      teams: teams.map((t: any) => ({
        id: t.id,
        name: t.name,
      })),
    });

    console.log('✅ Season champion poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering season champion poll:', error);
    return null;
  }
}

/**
 * Auto-trigger season MVP poll
 * Should be triggered near the end of the season
 */
export async function triggerSeasonMVPPoll(seasonId: string): Promise<string | null> {
  try {
    const sql = getTournamentDb();
    
    // Check if poll already exists
    const [existingPoll] = await sql`
      SELECT id FROM polls
      WHERE poll_type = 'season_mvp'
        AND season_id = ${seasonId}
    `;

    if (existingPoll) {
      console.log('Season MVP poll already exists');
      return existingPoll.id;
    }

    // Get top players based on participation and star rating
    const players = await sql`
      SELECT DISTINCT
        p.id, p.current_name as name, p.star_rating,
        COUNT(DISTINCT fp.fixture_id) as matches_played
      FROM players p
      JOIN fixture_participation fp ON fp.player_id = p.id
      JOIN fixtures f ON f.id = fp.fixture_id
      WHERE f.season_id = ${seasonId}
        AND f.status = 'completed'
      GROUP BY p.id, p.current_name, p.star_rating
      HAVING COUNT(DISTINCT fp.fixture_id) >= 3
      ORDER BY p.star_rating DESC, matches_played DESC
      LIMIT 20
    `;

    if (players.length === 0) {
      console.log('No players found for season MVP poll');
      return null;
    }

    // Create season MVP poll
    const pollId = await createSeasonMVPPoll({
      seasonId,
      players: players.map((p: any) => ({
        id: p.id,
        name: p.name,
        starRating: p.star_rating,
      })),
    });

    console.log('✅ Season MVP poll created:', pollId);
    return pollId;
  } catch (error) {
    console.error('Error triggering season MVP poll:', error);
    return null;
  }
}

/**
 * Run all daily poll triggers for a given season and date
 */
export async function runDailyPollTriggers(seasonId: string, date: Date = new Date()): Promise<void> {
  console.log('🤖 Running daily poll triggers for:', date.toISOString().split('T')[0]);
  
  await triggerDailyBestPlayerPoll(seasonId, date);
  await triggerDailyBestTeamPoll(seasonId, date);
}

/**
 * Run all weekly poll triggers for a given season and week
 */
export async function runWeeklyPollTriggers(seasonId: string, weekNumber: number): Promise<void> {
  console.log('🤖 Running weekly poll triggers for week:', weekNumber);
  
  await triggerWeeklyTopPlayerPoll(seasonId, weekNumber);
  await triggerWeeklyTopTeamPoll(seasonId, weekNumber);
}
