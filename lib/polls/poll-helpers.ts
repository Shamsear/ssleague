import { getTournamentDb } from '@/lib/neon/tournament-config';

interface MatchPredictionPollParams {
  seasonId: string;
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledDate: string;
}

interface PlayerOfMatchPollParams {
  seasonId: string;
  fixtureId: string;
  players: Array<{
    id: string;
    name: string;
    teamId: string;
    starRating?: number;
  }>;
}

interface DailyPollParams {
  seasonId: string;
  date: string;
  players?: Array<{ id: string; name: string; starRating?: number }>;
  teams?: Array<{ id: string; name: string }>;
}

interface WeeklyPollParams {
  seasonId: string;
  weekNumber: number;
  players?: Array<{ id: string; name: string; starRating?: number }>;
  teams?: Array<{ id: string; name: string }>;
}

interface SeasonPollParams {
  seasonId: string;
  seasonName: string;
  teams?: Array<{ id: string; name: string }>;
  players?: Array<{ id: string; name: string; starRating?: number }>;
}

/**
 * Create a match prediction poll
 */
export async function createMatchPredictionPoll(params: MatchPredictionPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = [
    { id: 'home_win', text_en: `${params.homeTeamName} Win`, text_ml: `${params.homeTeamName} ജയം`, votes: 0 },
    { id: 'away_win', text_en: `${params.awayTeamName} Win`, text_ml: `${params.awayTeamName} ജയം`, votes: 0 },
    { id: 'draw', text_en: 'Draw', text_ml: 'സമനില', votes: 0 },
  ];

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'match_prediction',
      'active',
      ${'Who will win this match?'},
      ${'ഈ മത്സരത്തിൽ ആരാണ് വിജയിക്കുക?'},
      ${JSON.stringify(options)},
      0,
      ${params.scheduledDate},
      ${JSON.stringify({ fixture_id: params.fixtureId, home_team_id: params.homeTeamId, away_team_id: params.awayTeamId })}
    )
  `;

  return pollId;
}

/**
 * Create a player of the match poll
 */
export async function createPlayerOfMatchPoll(params: PlayerOfMatchPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = params.players.map((player) => ({
    id: player.id,
    text_en: player.name,
    text_ml: player.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'player_of_match',
      'active',
      ${'Who was the Player of the Match?'},
      ${'മത്സരത്തിന്റെ മികച്ച കളിക്കാരൻ ആരാണ്?'},
      ${JSON.stringify(options)},
      0,
      ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()},
      ${JSON.stringify({ fixture_id: params.fixtureId })}
    )
  `;

  return pollId;
}

/**
 * Create a daily best player poll
 */
export async function createDailyBestPlayerPoll(params: DailyPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = (params.players || []).map((player) => ({
    id: player.id,
    text_en: player.name,
    text_ml: player.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'daily_best_player',
      'active',
      ${'Best Player of the Day'},
      ${'ദിവസത്തെ മികച്ച കളിക്കാരൻ'},
      ${JSON.stringify(options)},
      0,
      ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()},
      ${JSON.stringify({ date: params.date })}
    )
  `;

  return pollId;
}

/**
 * Create a daily best team poll
 */
export async function createDailyBestTeamPoll(params: DailyPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = (params.teams || []).map((team) => ({
    id: team.id,
    text_en: team.name,
    text_ml: team.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'daily_best_team',
      'active',
      ${'Best Team Performance of the Day'},
      ${'ദിവസത്തെ മികച്ച ടീം പ്രകടനം'},
      ${JSON.stringify(options)},
      0,
      ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()},
      ${JSON.stringify({ date: params.date })}
    )
  `;

  return pollId;
}

/**
 * Create a weekly top player poll
 */
export async function createWeeklyTopPlayerPoll(params: WeeklyPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = (params.players || []).map((player) => ({
    id: player.id,
    text_en: player.name,
    text_ml: player.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'weekly_top_player',
      'active',
      ${`Top Player of Week ${params.weekNumber}`},
      ${`ആഴ്ച ${params.weekNumber} ന്റെ മികച്ച കളിക്കാരൻ`},
      ${JSON.stringify(options)},
      0,
      ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()},
      ${JSON.stringify({ week_number: params.weekNumber })}
    )
  `;

  return pollId;
}

/**
 * Create a weekly top team poll
 */
export async function createWeeklyTopTeamPoll(params: WeeklyPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = (params.teams || []).map((team) => ({
    id: team.id,
    text_en: team.name,
    text_ml: team.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'weekly_top_team',
      'active',
      ${`Top Team of Week ${params.weekNumber}`},
      ${`ആഴ്ച ${params.weekNumber} ന്റെ മികച്ച ടീം`},
      ${JSON.stringify(options)},
      0,
      ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()},
      ${JSON.stringify({ week_number: params.weekNumber })}
    )
  `;

  return pollId;
}

/**
 * Create a season champion poll
 */
export async function createSeasonChampionPoll(params: SeasonPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = (params.teams || []).map((team) => ({
    id: team.id,
    text_en: team.name,
    text_ml: team.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'season_champion',
      'active',
      ${`Who will win ${params.seasonName}?`},
      ${`${params.seasonName} ആരാണ് ജയിക്കുക?`},
      ${JSON.stringify(options)},
      0,
      NULL,
      ${JSON.stringify({ season_name: params.seasonName })}
    )
  `;

  return pollId;
}

/**
 * Create a season MVP poll
 */
export async function createSeasonMVPPoll(params: SeasonPollParams): Promise<string> {
  const sql = getTournamentDb();
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const options = (params.players || []).map((player) => ({
    id: player.id,
    text_en: player.name,
    text_ml: player.name,
    votes: 0,
  }));

  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type, status,
      question_en, question_ml,
      options, total_votes,
      closes_at, metadata
    ) VALUES (
      ${pollId},
      ${params.seasonId},
      'season_mvp',
      'active',
      ${`Most Valuable Player of ${params.seasonName}`},
      ${`${params.seasonName} ന്റെ മികച്ച കളിക്കാരൻ (MVP)`},
      ${JSON.stringify(options)},
      0,
      NULL,
      ${JSON.stringify({ season_name: params.seasonName })}
    )
  `;

  return pollId;
}
