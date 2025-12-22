/**
 * Player Stats API - Tournament Database
 * GET: Fetch player statistics
 * POST: Update player statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    let tournamentId = searchParams.get('tournamentId');
    const playerId = searchParams.get('playerId');
    const teamId = searchParams.get('teamId');
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') || 'points';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const startRound = searchParams.get('startRound') ? parseInt(searchParams.get('startRound')!) : null;
    const endRound = searchParams.get('endRound') ? parseInt(searchParams.get('endRound')!) : null;
    
    // Backward compatibility: If only seasonId provided, get primary tournament
    if (seasonId && !tournamentId) {
      const primaryTournament = await sql`
        SELECT id FROM tournaments 
        WHERE season_id = ${seasonId} AND is_primary = true
        LIMIT 1
      `;
      if (primaryTournament.length > 0) {
        tournamentId = primaryTournament[0].id;
      } else {
        // Fallback to LEAGUE tournament
        tournamentId = `${seasonId}-LEAGUE`;
      }
    }
    
    let stats;
    
    // Determine if this is a modern season (16+) or historical (1-15)
    const isModernSeason = (season: string) => {
      const seasonNum = parseInt(season.replace(/\D/g, '')) || 0;
      return seasonNum >= 16;
    };

    // If round range is specified OR if we want matchups-based stats, aggregate from matchups and fixtures tables
    if (tournamentId && (startRound !== null || endRound !== null || searchParams.get('useMatchups') === 'true')) {
      // Extract season number from tournament ID
      // Supports formats: "SEASON16", "SEASON16-LEAGUE", "SSPSLS16", "SSPSLS16L", "SSPSLS16-LEAGUE"
      const seasonMatch = tournamentId.match(/(\d+)/);
      const seasonNum = seasonMatch ? parseInt(seasonMatch[1]) : 0;
      
      console.log('[Player Stats API] Entering matchups-based query block:', {
        tournamentId,
        seasonNum,
        startRound,
        endRound,
        useMatchups: searchParams.get('useMatchups')
      });
      
      if (seasonNum >= 16) {
        // Extract just the season ID (e.g., "SSPSLS16" from "SSPSLS16L" or "SSPSLS16-LEAGUE")
        const seasonIdFromTournament = tournamentId.includes('-') 
          ? tournamentId.split('-')[0]  // "SEASON16-LEAGUE" -> "SEASON16"
          : tournamentId.replace(/[A-Z]+$/, ''); // "SSPSLS16L" -> "SSPSLS16"
        
        console.log('[Player Stats API] Matchups-based query:', {
          tournamentId,
          seasonId: seasonIdFromTournament,
          startRound,
          endRound,
          useMatchups: searchParams.get('useMatchups')
        });
        
        // Aggregate player stats from matchups and fixtures for the specified round range
        // We need to UNION home and away player stats
        if (startRound !== null && endRound !== null) {
          stats = await sql`
            WITH player_match_stats AS (
              -- Home players
              SELECT 
                m.home_player_id as player_id,
                m.home_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.home_goals as goals,
                m.away_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.home_goals > m.away_goals THEN 'win'
                  WHEN m.home_goals < m.away_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.away_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.home_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND f.round_number >= ${startRound}
                AND f.round_number <= ${endRound}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
              
              UNION ALL
              
              -- Away players
              SELECT 
                m.away_player_id as player_id,
                m.away_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.away_goals as goals,
                m.home_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.away_goals > m.home_goals THEN 'win'
                  WHEN m.away_goals < m.home_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.home_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.away_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND f.round_number >= ${startRound}
                AND f.round_number <= ${endRound}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
            )
            SELECT 
              pms.player_id,
              MAX(pms.player_name) as player_name,
              ${seasonIdFromTournament} as season_id,
              MAX(ps.team) as team,
              MAX(ps.team_id) as team_id,
              MAX(ps.category) as category,
              COUNT(DISTINCT pms.fixture_id) as matches_played,
              SUM(CASE WHEN pms.result = 'win' THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN pms.result = 'draw' THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN pms.result = 'loss' THEN 1 ELSE 0 END) as losses,
              SUM(pms.goals) as goals_scored,
              SUM(pms.goals_conceded) as goals_conceded,
              SUM(pms.assists) as assists,
              SUM(pms.clean_sheet) as clean_sheets,
              SUM(pms.motm) as motm_awards,
              0 as points,
              MAX(ps.star_rating) as star_rating,
              MAX(ps.base_points) as base_points
            FROM player_match_stats pms
            LEFT JOIN player_seasons ps ON pms.player_id = ps.player_id AND ps.season_id = ${seasonIdFromTournament}
            GROUP BY pms.player_id
            ORDER BY goals_scored DESC, motm_awards DESC
            LIMIT ${limit}
          `;
        } else if (startRound !== null) {
          stats = await sql`
            WITH player_match_stats AS (
              -- Home players
              SELECT 
                m.home_player_id as player_id,
                m.home_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.home_goals as goals,
                m.away_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.home_goals > m.away_goals THEN 'win'
                  WHEN m.home_goals < m.away_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.away_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.home_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND f.round_number >= ${startRound}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
              
              UNION ALL
              
              -- Away players
              SELECT 
                m.away_player_id as player_id,
                m.away_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.away_goals as goals,
                m.home_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.away_goals > m.home_goals THEN 'win'
                  WHEN m.away_goals < m.home_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.home_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.away_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND f.round_number >= ${startRound}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
            )
            SELECT 
              pms.player_id,
              MAX(pms.player_name) as player_name,
              ${seasonIdFromTournament} as season_id,
              MAX(ps.team) as team,
              MAX(ps.team_id) as team_id,
              MAX(ps.category) as category,
              COUNT(DISTINCT pms.fixture_id) as matches_played,
              SUM(CASE WHEN pms.result = 'win' THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN pms.result = 'draw' THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN pms.result = 'loss' THEN 1 ELSE 0 END) as losses,
              SUM(pms.goals) as goals_scored,
              SUM(pms.goals_conceded) as goals_conceded,
              SUM(pms.assists) as assists,
              SUM(pms.clean_sheet) as clean_sheets,
              SUM(pms.motm) as motm_awards,
              0 as points,
              MAX(ps.star_rating) as star_rating,
              MAX(ps.base_points) as base_points
            FROM player_match_stats pms
            LEFT JOIN player_seasons ps ON pms.player_id = ps.player_id AND ps.season_id = ${seasonIdFromTournament}
            GROUP BY pms.player_id
            ORDER BY goals_scored DESC, motm_awards DESC
            LIMIT ${limit}
          `;
        } else if (endRound !== null) {
          stats = await sql`
            WITH player_match_stats AS (
              -- Home players
              SELECT 
                m.home_player_id as player_id,
                m.home_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.home_goals as goals,
                m.away_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.home_goals > m.away_goals THEN 'win'
                  WHEN m.home_goals < m.away_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.away_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.home_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND f.round_number <= ${endRound}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
              
              UNION ALL
              
              -- Away players
              SELECT 
                m.away_player_id as player_id,
                m.away_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.away_goals as goals,
                m.home_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.away_goals > m.home_goals THEN 'win'
                  WHEN m.away_goals < m.home_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.home_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.away_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND f.round_number <= ${endRound}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
            )
            SELECT 
              pms.player_id,
              MAX(pms.player_name) as player_name,
              ${seasonIdFromTournament} as season_id,
              MAX(ps.team) as team,
              MAX(ps.team_id) as team_id,
              MAX(ps.category) as category,
              COUNT(DISTINCT pms.fixture_id) as matches_played,
              SUM(CASE WHEN pms.result = 'win' THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN pms.result = 'draw' THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN pms.result = 'loss' THEN 1 ELSE 0 END) as losses,
              SUM(pms.goals) as goals_scored,
              SUM(pms.goals_conceded) as goals_conceded,
              SUM(pms.assists) as assists,
              SUM(pms.clean_sheet) as clean_sheets,
              SUM(pms.motm) as motm_awards,
              0 as points,
              MAX(ps.star_rating) as star_rating,
              MAX(ps.base_points) as base_points
            FROM player_match_stats pms
            LEFT JOIN player_seasons ps ON pms.player_id = ps.player_id AND ps.season_id = ${seasonIdFromTournament}
            GROUP BY pms.player_id
            ORDER BY goals_scored DESC, motm_awards DESC
            LIMIT ${limit}
          `;
        } else {
          // No round range specified - get all rounds
          console.log('[Player Stats API] Querying all rounds for season:', seasonIdFromTournament);
          
          stats = await sql`
            WITH player_match_stats AS (
              -- Home players
              SELECT 
                m.home_player_id as player_id,
                m.home_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.home_goals as goals,
                m.away_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.home_goals > m.away_goals THEN 'win'
                  WHEN m.home_goals < m.away_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.away_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.home_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
              
              UNION ALL
              
              -- Away players
              SELECT 
                m.away_player_id as player_id,
                m.away_player_name as player_name,
                f.id as fixture_id,
                f.round_number,
                m.away_goals as goals,
                m.home_goals as goals_conceded,
                0 as assists,
                CASE 
                  WHEN m.away_goals > m.home_goals THEN 'win'
                  WHEN m.away_goals < m.home_goals THEN 'loss'
                  ELSE 'draw'
                END as result,
                CASE WHEN m.home_goals = 0 THEN 1 ELSE 0 END as clean_sheet,
                CASE WHEN f.motm_player_id = m.away_player_id THEN 1 ELSE 0 END as motm
              FROM matchups m
              INNER JOIN fixtures f ON m.fixture_id = f.id
              WHERE f.season_id = ${seasonIdFromTournament}
                AND m.home_goals IS NOT NULL
                AND m.away_goals IS NOT NULL
            )
            SELECT 
              pms.player_id,
              MAX(pms.player_name) as player_name,
              ${seasonIdFromTournament} as season_id,
              MAX(ps.team) as team,
              MAX(ps.team_id) as team_id,
              MAX(ps.category) as category,
              COUNT(DISTINCT pms.fixture_id) as matches_played,
              SUM(CASE WHEN pms.result = 'win' THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN pms.result = 'draw' THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN pms.result = 'loss' THEN 1 ELSE 0 END) as losses,
              SUM(pms.goals) as goals_scored,
              SUM(pms.goals_conceded) as goals_conceded,
              SUM(pms.assists) as assists,
              SUM(pms.clean_sheet) as clean_sheets,
              SUM(pms.motm) as motm_awards,
              0 as points,
              MAX(ps.star_rating) as star_rating,
              MAX(ps.base_points) as base_points
            FROM player_match_stats pms
            LEFT JOIN player_seasons ps ON pms.player_id = ps.player_id AND ps.season_id = ${seasonIdFromTournament}
            GROUP BY pms.player_id
            ORDER BY goals_scored DESC, motm_awards DESC
            LIMIT ${limit}
          `;
          
          console.log('[Player Stats API] All rounds query returned:', stats?.length || 0, 'players');
        }
        
        console.log('[Player Stats API] Matchups-based results:', stats?.length || 0, 'players');
      } else {
        console.log('[Player Stats API] Historical season, returning empty');
        // Historical seasons don't have matchups data, return empty
        stats = [];
      }
      
      return NextResponse.json({
        success: true,
        data: stats,
        count: stats.length
      });
    }

    // Get all season stats for a specific player (player details page) - OPTIMIZED
    if (playerId && !seasonId) {
      // Query BOTH tables and combine results
      const [modernSeasons, historicalSeasons] = await Promise.all([
        // Modern seasons (16+) from player_seasons
        sql`
          SELECT 
            id, player_id, player_name, season_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            base_points,
            contract_id, contract_start_season, contract_end_season,
            is_auto_registered, registration_date,
            'modern' as data_source
          FROM player_seasons 
          WHERE player_id = ${playerId}
          ORDER BY season_id DESC
        `,
        // Historical seasons (1-15) from realplayerstats
        sql`
          SELECT 
            id, player_id, player_name, season_id, tournament_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            NULL as base_points,
            NULL as contract_id, NULL as contract_start_season, NULL as contract_end_season,
            NULL as is_auto_registered, NULL as registration_date,
            'historical' as data_source
          FROM realplayerstats 
          WHERE player_id = ${playerId}
          ORDER BY season_id DESC, tournament_id DESC
        `
      ]);

      // Combine and sort by season
      const allSeasons = [...modernSeasons, ...historicalSeasons].sort((a, b) => {
        const aNum = parseInt(a.season_id.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.season_id.replace(/\D/g, '')) || 0;
        return bNum - aNum; // Descending order
      });
      
      stats = allSeasons;
    }
    // Get specific player stats for a season - OPTIMIZED
    else if (playerId && seasonId) {
      let result;
      
      if (isModernSeason(seasonId)) {
        // Season 16+: Query player_seasons table
        result = await sql`
          SELECT 
            id, player_id, player_name, season_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            base_points,
            contract_id, contract_start_season, contract_end_season,
            is_auto_registered, registration_date
          FROM player_seasons 
          WHERE player_id = ${playerId} AND season_id = ${seasonId}
        `;
      } else {
        // Season 1-15: Query realplayerstats table
        result = await sql`
          SELECT 
            id, player_id, player_name, season_id, tournament_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            NULL as base_points
          FROM realplayerstats 
          WHERE player_id = ${playerId} AND tournament_id = ${tournamentId}
        `;
      }
      
      stats = result[0] || null;
    }
    // Get team player stats
    else if (teamId && seasonId) {
      if (isModernSeason(seasonId)) {
        stats = await sql`
          SELECT 
            id, player_id, player_name, season_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            base_points,
            contract_id, contract_start_season, contract_end_season,
            is_auto_registered, registration_date, registration_type,
            auction_value, salary_per_match,
            prevent_auto_promotion,
            created_at, updated_at
          FROM player_seasons 
          WHERE team_id = ${teamId} AND season_id = ${seasonId}
          ORDER BY points DESC
        `;
      } else {
        stats = await sql`
          SELECT 
            id, player_id, player_name, season_id, tournament_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            NULL as base_points
          FROM realplayerstats 
          WHERE team_id = ${teamId} AND tournament_id = ${tournamentId}
          ORDER BY points DESC
        `;
      }
    }
    // Get all players for a season (for contracts page, registration page, etc.)
    else if (seasonId && !playerId) {
      if (isModernSeason(seasonId)) {
        stats = await sql`
          SELECT 
            id, player_id, player_name, season_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            base_points,
            contract_id, contract_start_season, contract_end_season,
            is_auto_registered, registration_date, registration_type,
            auction_value, salary_per_match,
            prevent_auto_promotion,
            created_at, updated_at
          FROM player_seasons 
          WHERE season_id = ${seasonId}
          ORDER BY registration_date ASC
          LIMIT ${limit}
        `;
        
        // Debug: Log first player to check prevent_auto_promotion field
        if (stats.length > 0) {
          console.log('[Players API] First player prevent_auto_promotion:', stats[0].prevent_auto_promotion);
          console.log('[Players API] First player data:', {
            player_id: stats[0].player_id,
            player_name: stats[0].player_name,
            prevent_auto_promotion: stats[0].prevent_auto_promotion,
            registration_type: stats[0].registration_type
          });
        }
      } else {
        stats = await sql`
          SELECT 
            id, player_id, player_name, season_id, tournament_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            NULL as base_points
          FROM realplayerstats 
          WHERE season_id = ${seasonId}
          ORDER BY points DESC
          LIMIT ${limit}
        `;
      }
    }
    // Get season/tournament stats with filters
    else if (tournamentId) {
      // Extract season from tournamentId (format: SEASON16-LEAGUE)
      const seasonMatch = tournamentId.match(/SEASON(\d+)/);
      const seasonNum = seasonMatch ? parseInt(seasonMatch[1]) : 0;
      
      if (seasonNum >= 16) {
        // Modern season: Query player_seasons table
        const seasonIdFromTournament = tournamentId.split('-')[0]; // e.g., "SEASON16"
        
        const validSortFields = ['points', 'goals_scored', 'assists', 'motm_awards', 'matches_played'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'points';
        
        // Build query dynamically based on category filter
        if (category) {
          stats = await sql`
            SELECT 
              id, player_id, player_name, season_id,
              team, team_id, category,
              matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
              clean_sheets, motm_awards, points, star_rating,
              base_points,
              contract_id, contract_start_season, contract_end_season,
              is_auto_registered, registration_date
            FROM player_seasons 
            WHERE season_id = ${seasonIdFromTournament} AND category = ${category}
            ORDER BY ${sql(sortField)} DESC, player_name ASC
            LIMIT ${limit}
          `;
        } else {
          stats = await sql`
            SELECT 
              id, player_id, player_name, season_id,
              team, team_id, category,
              matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
              clean_sheets, motm_awards, points, star_rating,
              base_points,
              contract_id, contract_start_season, contract_end_season,
              is_auto_registered, registration_date
            FROM player_seasons 
            WHERE season_id = ${seasonIdFromTournament}
            ORDER BY ${sql(sortField)} DESC, player_name ASC
            LIMIT ${limit}
          `;
        }
      } else {
        // Historical season: Query realplayerstats table
        let query = `
          SELECT 
            id, player_id, player_name, season_id, tournament_id,
            team, team_id, category,
            matches_played, goals_scored, goals_conceded, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating,
            NULL as base_points
          FROM realplayerstats 
          WHERE tournament_id = $1
        `;
        const params = [tournamentId];
        
        if (category) {
          query += ` AND category = $${params.length + 1}`;
          params.push(category);
        }
        
        // Add sorting
        const validSortFields = ['points', 'goals_scored', 'assists', 'motm_awards', 'matches_played'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'points';
        query += ` ORDER BY ${sortField} DESC, player_name ASC LIMIT $${params.length + 1}`;
        params.push(limit.toString());
        
        const { Pool } = await import('@neondatabase/serverless');
        const pool = new Pool({ connectionString: process.env.NEON_TOURNAMENT_DB_URL });
        
        try {
          const result = await pool.query(query, params);
          stats = result.rows;
        } finally {
          await pool.end();
        }
      }
    }
    else {
      return NextResponse.json(
        { success: false, error: 'Either playerId or tournamentId is required' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: stats,
      count: stats.length
    });
    
  } catch (error: any) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    
    const {
      player_id,
      season_id,
      tournament_id,
      player_name,
      team,
      team_id,
      category,
      matches_played = 0,
      goals_scored = 0,
      assists = 0,
      wins = 0,
      draws = 0,
      losses = 0,
      clean_sheets = 0,
      motm_awards = 0,
      points = 0,
      star_rating = 0
    } = body;
    
    if (!player_id || !tournament_id || !player_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: player_id, tournament_id, player_name' },
        { status: 400 }
      );
    }
    
    const statsId = `${player_id}_${tournament_id}`;
    
    const result = await sql`
      INSERT INTO realplayerstats (
        id, player_id, season_id, tournament_id, player_name, team, team_id, category,
        matches_played, goals_scored, assists, wins, draws, losses,
        clean_sheets, motm_awards, points, star_rating
      )
      VALUES (
        ${statsId}, ${player_id}, ${season_id}, ${tournament_id}, ${player_name}, ${team}, ${team_id}, ${category},
        ${matches_played}, ${goals_scored}, ${assists}, ${wins}, ${draws}, ${losses},
        ${clean_sheets}, ${motm_awards}, ${points}, ${star_rating}
      )
      ON CONFLICT (player_id, tournament_id) DO UPDATE
      SET matches_played = EXCLUDED.matches_played,
          goals_scored = EXCLUDED.goals_scored,
          assists = EXCLUDED.assists,
          wins = EXCLUDED.wins,
          draws = EXCLUDED.draws,
          losses = EXCLUDED.losses,
          clean_sheets = EXCLUDED.clean_sheets,
          motm_awards = EXCLUDED.motm_awards,
          points = EXCLUDED.points,
          star_rating = EXCLUDED.star_rating,
          team = EXCLUDED.team,
          team_id = EXCLUDED.team_id,
          category = EXCLUDED.category,
          updated_at = NOW()
      RETURNING *
    `;
    
    return NextResponse.json({
      success: true,
      data: result[0]
    });
    
  } catch (error: any) {
    console.error('Error updating player stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
