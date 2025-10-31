/**
 * Poll Creation Helpers
 * Functions to create different types of polls
 */

import { getTournamentDb } from '../neon/tournament-config';
import { PollOption, PollType } from '../news/types';

interface CreatePollInput {
  season_id: string;
  poll_type: PollType;
  title_en: string;
  title_ml: string;
  description_en?: string;
  description_ml?: string;
  options: PollOption[];
  closes_at: Date;
  related_fixture_id?: string;
  related_round_id?: string;
  related_matchday_date?: string;
  created_by?: string;
}

/**
 * Create a poll in the database
 */
export async function createPoll(input: CreatePollInput): Promise<string> {
  const sql = getTournamentDb();
  
  const poll_id = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type,
      title_en, title_ml, description_en, description_ml,
      related_fixture_id, related_round_id, related_matchday_date,
      options, closes_at, created_by
    ) VALUES (
      ${poll_id},
      ${input.season_id},
      ${input.poll_type},
      ${input.title_en},
      ${input.title_ml},
      ${input.description_en || null},
      ${input.description_ml || null},
      ${input.related_fixture_id || null},
      ${input.related_round_id || null},
      ${input.related_matchday_date || null},
      ${JSON.stringify(input.options)},
      ${input.closes_at.toISOString()},
      ${input.created_by || null}
    )
  `;
  
  console.log(`✅ Created ${input.poll_type} poll: ${poll_id}`);
  
  return poll_id;
}

/**
 * Create match prediction poll
 * Single question: Who will win?
 */
export async function createMatchPredictionPoll(
  fixture_id: string,
  home_team: string,
  away_team: string,
  season_id: string,
  round_id: string,
  result_entry_deadline: Date
): Promise<string> {
  const options: PollOption[] = [
    {
      id: 'home',
      text_en: `${home_team} Wins`,
      text_ml: `${home_team} ജയിക്കും`,
      team_id: fixture_id.split('_')[0], // Assuming fixture_id contains team info
      votes: 0
    },
    {
      id: 'draw',
      text_en: 'Draw',
      text_ml: 'സമനില',
      votes: 0
    },
    {
      id: 'away',
      text_en: `${away_team} Wins`,
      text_ml: `${away_team} ജയിക്കും`,
      team_id: fixture_id.split('_')[1],
      votes: 0
    }
  ];
  
  return createPoll({
    season_id,
    poll_type: 'match_prediction',
    title_en: `Who will win ${home_team} vs ${away_team}?`,
    title_ml: `${home_team} vs ${away_team} - ആരു ജയിക്കും?`,
    description_en: `Vote for your prediction before the match!`,
    description_ml: `മത്സരത്തിന് മുമ്പ് നിങ്ങളുടെ പ്രവചനം രേഖപ്പെടുത്തുക!`,
    options,
    closes_at: result_entry_deadline,
    related_fixture_id: fixture_id,
    related_round_id: round_id
  });
}

/**
 * Create Player of the Match poll
 * Options: All players who participated
 */
export async function createPlayerOfMatchPoll(
  fixture_id: string,
  home_team: string,
  away_team: string,
  players: Array<{ id: string; name: string; name_ml?: string; team: string; stats?: string }>,
  season_id: string
): Promise<string> {
  const closes_at = new Date();
  closes_at.setHours(closes_at.getHours() + 24); // Close in 24 hours
  
  const options: PollOption[] = players.map(player => ({
    id: player.id,
    text_en: `${player.name} (${player.team})${player.stats ? ` - ${player.stats}` : ''}`,
    text_ml: `${player.name_ml || player.name} (${player.team})${player.stats ? ` - ${player.stats}` : ''}`,
    player_id: player.id,
    votes: 0
  }));
  
  return createPoll({
    season_id,
    poll_type: 'player_of_match',
    title_en: `Player of the Match: ${home_team} vs ${away_team}`,
    title_ml: `മാച്ചിലെ മികച്ച കളിക്കാരൻ: ${home_team} vs ${away_team}`,
    description_en: 'Vote for the best player in this match!',
    description_ml: 'ഈ മത്സരത്തിലെ മികച്ച കളിക്കാരനെ തിരഞ്ഞെടുക്കുക!',
    options,
    closes_at,
    related_fixture_id: fixture_id
  });
}

/**
 * Create Daily Best Player Poll
 */
export async function createDailyBestPlayerPoll(
  matchday_date: string,
  players: Array<{ id: string; name: string; name_ml?: string; team: string; stats: string }>,
  season_id: string
): Promise<string> {
  const closes_at = new Date();
  closes_at.setHours(closes_at.getHours() + 24);
  
  const options: PollOption[] = players.map(player => ({
    id: player.id,
    text_en: `${player.name} (${player.team}) - ${player.stats}`,
    text_ml: `${player.name_ml || player.name} (${player.team}) - ${player.stats}`,
    player_id: player.id,
    votes: 0
  }));
  
  return createPoll({
    season_id,
    poll_type: 'daily_player',
    title_en: 'Best Player of the Day',
    title_ml: 'ദിവസത്തെ മികച്ച കളിക്കാരൻ',
    description_en: `Vote for the best performer on ${matchday_date}`,
    description_ml: `${matchday_date} ലെ മികച്ച പ്രകടനം കാഴ്ചവച്ചവരെ തിരഞ്ഞെടുക്കുക`,
    options,
    closes_at,
    related_matchday_date: matchday_date
  });
}

/**
 * Create Daily Best Team Poll
 */
export async function createDailyBestTeamPoll(
  matchday_date: string,
  teams: Array<{ id: string; name: string; name_ml?: string; performance: string }>,
  season_id: string
): Promise<string> {
  const closes_at = new Date();
  closes_at.setHours(closes_at.getHours() + 24);
  
  const options: PollOption[] = teams.map(team => ({
    id: team.id,
    text_en: `${team.name} - ${team.performance}`,
    text_ml: `${team.name_ml || team.name} - ${team.performance}`,
    team_id: team.id,
    votes: 0
  }));
  
  return createPoll({
    season_id,
    poll_type: 'daily_team',
    title_en: 'Best Team Performance of the Day',
    title_ml: 'ദിവസത്തെ മികച്ച ടീം പ്രകടനം',
    description_en: `Which team impressed you most on ${matchday_date}?`,
    description_ml: `${matchday_date} ൽ ഏത് ടീമാണ് നിങ്ങളെ ഏറ്റവും ആകർഷിച്ചത്?`,
    options,
    closes_at,
    related_matchday_date: matchday_date
  });
}

/**
 * Create Weekly Player Poll
 */
export async function createWeeklyPlayerPoll(
  round_id: string,
  top_players: Array<{ id: string; name: string; name_ml?: string; stats: string }>,
  season_id: string,
  closes_in_days: number = 3
): Promise<string> {
  const closes_at = new Date();
  closes_at.setDate(closes_at.getDate() + closes_in_days);
  
  const options: PollOption[] = top_players.map(player => ({
    id: player.id,
    text_en: `${player.name} - ${player.stats}`,
    text_ml: `${player.name_ml || player.name} - ${player.stats}`,
    player_id: player.id,
    votes: 0
  }));
  
  return createPoll({
    season_id,
    poll_type: 'weekly_player',
    title_en: 'Player of the Week',
    title_ml: 'ആഴ്ചയിലെ മികച്ച കളിക്കാരൻ',
    description_en: 'Vote for the best player this round!',
    description_ml: 'ഈ റൗണ്ടിലെ മികച്ച കളിക്കാരനെ തിരഞ്ഞെടുക്കുക!',
    options,
    closes_at,
    related_round_id: round_id
  });
}

/**
 * Create Weekly Team Poll
 */
export async function createWeeklyTeamPoll(
  round_id: string,
  teams: Array<{ id: string; name: string; name_ml?: string; performance: string }>,
  season_id: string,
  closes_in_days: number = 3
): Promise<string> {
  const closes_at = new Date();
  closes_at.setDate(closes_at.getDate() + closes_in_days);
  
  const options: PollOption[] = teams.map(team => ({
    id: team.id,
    text_en: `${team.name} - ${team.performance}`,
    text_ml: `${team.name_ml || team.name} - ${team.performance}`,
    team_id: team.id,
    votes: 0
  }));
  
  return createPoll({
    season_id,
    poll_type: 'weekly_team',
    title_en: 'Team of the Week',
    title_ml: 'ആഴ്ചയിലെ മികച്ച ടീം',
    description_en: 'Which team had the best performance this round?',
    description_ml: 'ഈ റൗണ്ടിൽ ഏത് ടീമിനായിരുന്നു മികച്ച പ്രകടനം?',
    options,
    closes_at,
    related_round_id: round_id
  });
}

/**
 * Create Weekly Manager Poll
 */
export async function createWeeklyManagerPoll(
  round_id: string,
  managers: Array<{ id: string; name: string; name_ml?: string; team: string }>,
  season_id: string,
  closes_in_days: number = 3
): Promise<string> {
  const closes_at = new Date();
  closes_at.setDate(closes_at.getDate() + closes_in_days);
  
  const options: PollOption[] = managers.map(manager => ({
    id: manager.id,
    text_en: `${manager.name} (${manager.team})`,
    text_ml: `${manager.name_ml || manager.name} (${manager.team})`,
    votes: 0
  }));
  
  return createPoll({
    season_id,
    poll_type: 'weekly_manager',
    title_en: 'Manager of the Week',
    title_ml: 'ആഴ്ചയിലെ മികച്ച മാനേജർ',
    description_en: 'Vote for the best tactical performance!',
    description_ml: 'മികച്ച തന്ത്രപരമായ പ്രകടനത്തിന് വോട്ട് ചെയ്യുക!',
    options,
    closes_at,
    related_round_id: round_id
  });
}

/**
 * Create Season Polls (all 6 types)
 */
export async function createSeasonPolls(
  season_id: string,
  data: {
    top_scorers: Array<{ id: string; name: string; name_ml?: string; goals: number }>;
    top_keepers: Array<{ id: string; name: string; name_ml?: string; clean_sheets: number }>;
    teams: Array<{ id: string; name: string; name_ml?: string }>;
    new_players: Array<{ id: string; name: string; name_ml?: string; team: string }>;
    managers: Array<{ id: string; name: string; name_ml?: string; team: string }>;
  },
  closes_in_days: number = 14
): Promise<string[]> {
  const closes_at = new Date();
  closes_at.setDate(closes_at.getDate() + closes_in_days);
  
  const poll_ids: string[] = [];
  
  // 1. Golden Boot
  poll_ids.push(await createPoll({
    season_id,
    poll_type: 'season_golden_boot',
    title_en: 'Predict: Golden Boot Winner',
    title_ml: 'പ്രവചിക്കുക: ഗോൾഡൻ ബൂട്ട് വിജയി',
    options: data.top_scorers.map(p => ({
      id: p.id,
      text_en: `${p.name} (${p.goals} goals)`,
      text_ml: `${p.name_ml || p.name} (${p.goals} ഗോളുകൾ)`,
      player_id: p.id,
      votes: 0
    })),
    closes_at
  }));
  
  // 2. Golden Glove
  poll_ids.push(await createPoll({
    season_id,
    poll_type: 'season_golden_glove',
    title_en: 'Predict: Golden Glove Winner',
    title_ml: 'പ്രവചിക്കുക: ഗോൾഡൻ ഗ്ലൗ വിജയി',
    options: data.top_keepers.map(p => ({
      id: p.id,
      text_en: `${p.name} (${p.clean_sheets} clean sheets)`,
      text_ml: `${p.name_ml || p.name} (${p.clean_sheets} ക്ലീൻ ഷീറ്റുകൾ)`,
      player_id: p.id,
      votes: 0
    })),
    closes_at
  }));
  
  // 3. Champion
  poll_ids.push(await createPoll({
    season_id,
    poll_type: 'season_champion',
    title_en: 'Predict: Season Champion',
    title_ml: 'പ്രവചിക്കുക: സീസൺ ചാമ്പ്യൻ',
    options: data.teams.map(t => ({
      id: t.id,
      text_en: t.name,
      text_ml: t.name_ml || t.name,
      team_id: t.id,
      votes: 0
    })),
    closes_at
  }));
  
  // 4. Best Signing
  poll_ids.push(await createPoll({
    season_id,
    poll_type: 'season_best_signing',
    title_en: 'Best Signing of the Season',
    title_ml: 'സീസണിലെ മികച്ച ഒപ്പിടൽ',
    options: data.new_players.map(p => ({
      id: p.id,
      text_en: `${p.name} (${p.team})`,
      text_ml: `${p.name_ml || p.name} (${p.team})`,
      player_id: p.id,
      votes: 0
    })),
    closes_at
  }));
  
  // 5. Breakout Player
  poll_ids.push(await createPoll({
    season_id,
    poll_type: 'season_breakout_player',
    title_en: 'Breakout Player of the Season',
    title_ml: 'സീസണിലെ പുതുമുഖ താരം',
    options: data.new_players.map(p => ({
      id: p.id,
      text_en: `${p.name}`,
      text_ml: `${p.name_ml || p.name}`,
      player_id: p.id,
      votes: 0
    })),
    closes_at
  }));
  
  // 6. Manager of Season
  poll_ids.push(await createPoll({
    season_id,
    poll_type: 'season_manager',
    title_en: 'Manager of the Season',
    title_ml: 'സീസണിലെ മികച്ച മാനേജർ',
    options: data.managers.map(m => ({
      id: m.id,
      text_en: `${m.name} (${m.team})`,
      text_ml: `${m.name_ml || m.name} (${m.team})`,
      votes: 0
    })),
    closes_at
  }));
  
  console.log(`✅ Created ${poll_ids.length} season polls`);
  
  return poll_ids;
}
