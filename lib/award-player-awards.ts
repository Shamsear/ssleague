import { getTournamentDb } from './neon/tournament-config';

interface PlayerAwardResult {
  success: boolean;
  awardsGiven: number;
  awards: {
    player_id: string;
    player_name: string;
    award_category: string;
    award_type: string;
    award_position: string | null;
    player_category: string | null;
  }[];
  error?: string;
}

/**
 * Auto-award player awards based on season statistics
 * 
 * Individual Awards (season-wide):
 * - Golden Boot (Top 3 goal scorers)
 * - Most Assists (Top 3)
 * - Most Clean Sheets (Top 3 goalkeepers)
 * - Most MOTM Awards (Top 3)
 * 
 * Category Awards (per position):
 * - Best Attacker (Top 3 attackers by goals + assists)
 * - Best Midfielder (Top 3 midfielders by goals + assists)
 * - Best Defender (Top 3 defenders by clean sheets)
 * - Best Goalkeeper (Top 3 goalkeepers by clean sheets + saves)
 */
export async function autoAwardPlayerAwards(
  seasonId: string,
  awardTopN: number = 3
): Promise<PlayerAwardResult> {
  try {
    const sql = getTournamentDb();
    
    console.log(`🏆 Starting player awards auto-award for season ${seasonId}...`);
    
    const awards: PlayerAwardResult['awards'] = [];
    let awardsGiven = 0;

    // ============================================
    // INDIVIDUAL AWARDS (Season-wide)
    // ============================================
    
    // 1. Golden Boot - Top goal scorers
    console.log('  📊 Awarding Golden Boot...');
    const topScorers = await sql`
      SELECT player_id, player_name, goals_scored, category
      FROM realplayerstats
      WHERE season_id = ${seasonId}
      ORDER BY goals_scored DESC, assists DESC
      LIMIT ${awardTopN}
    `;
    
    for (let i = 0; i < topScorers.length; i++) {
      const player = topScorers[i];
      const position = i === 0 ? 'Winner' : i === 1 ? 'Runner Up' : 'Third Place';
      
      const result = await sql`
        INSERT INTO player_awards (
          player_id, player_name, season_id,
          award_category, award_type, award_position,
          player_category, awarded_by, notes,
          performance_stats
        )
        VALUES (
          ${player.player_id}, ${player.player_name}, ${seasonId},
          'individual', 'Golden Boot', ${position},
          NULL, 'system', 'Auto-awarded based on goals scored',
          ${JSON.stringify({ goals: player.goals_scored })}
        )
        ON CONFLICT (player_id, season_id, award_category, award_type, award_position) DO NOTHING
        RETURNING *
      `;
      
      if (result.length > 0) {
        awardsGiven++;
        awards.push({
          player_id: player.player_id,
          player_name: player.player_name,
          award_category: 'individual',
          award_type: 'Golden Boot',
          award_position: position,
          player_category: null
        });
        console.log(`    ✅ ${position}: ${player.player_name} (${player.goals_scored} goals)`);
        
        // Update awards_count
        await sql`
          UPDATE player_season
          SET awards_count = COALESCE(awards_count, 0) + 1
          WHERE player_id = ${player.player_id} AND season_id = ${seasonId}
        `;
      }
    }

    // 2. Most Assists - Top assist providers
    console.log('  📊 Awarding Most Assists...');
    const topAssisters = await sql`
      SELECT player_id, player_name, assists
      FROM realplayerstats
      WHERE season_id = ${seasonId}
      ORDER BY assists DESC, goals_scored DESC
      LIMIT ${awardTopN}
    `;
    
    for (let i = 0; i < topAssisters.length; i++) {
      const player = topAssisters[i];
      const position = i === 0 ? 'Winner' : i === 1 ? 'Runner Up' : 'Third Place';
      
      const result = await sql`
        INSERT INTO player_awards (
          player_id, player_name, season_id,
          award_category, award_type, award_position,
          player_category, awarded_by, notes,
          performance_stats
        )
        VALUES (
          ${player.player_id}, ${player.player_name}, ${seasonId},
          'individual', 'Most Assists', ${position},
          NULL, 'system', 'Auto-awarded based on assists',
          ${JSON.stringify({ assists: player.assists })}
        )
        ON CONFLICT (player_id, season_id, award_category, award_type, award_position) DO NOTHING
        RETURNING *
      `;
      
      if (result.length > 0) {
        awardsGiven++;
        awards.push({
          player_id: player.player_id,
          player_name: player.player_name,
          award_category: 'individual',
          award_type: 'Most Assists',
          award_position: position,
          player_category: null
        });
        console.log(`    ✅ ${position}: ${player.player_name} (${player.assists} assists)`);
        
        await sql`
          UPDATE player_season
          SET awards_count = COALESCE(awards_count, 0) + 1
          WHERE player_id = ${player.player_id} AND season_id = ${seasonId}
        `;
      }
    }

    // 3. Most Clean Sheets (Goalkeepers)
    console.log('  📊 Awarding Most Clean Sheets...');
    const topKeepers = await sql`
      SELECT player_id, player_name, clean_sheets
      FROM realplayerstats
      WHERE season_id = ${seasonId} AND category = 'Goalkeeper'
      ORDER BY clean_sheets DESC, saves DESC
      LIMIT ${awardTopN}
    `;
    
    for (let i = 0; i < topKeepers.length; i++) {
      const player = topKeepers[i];
      const position = i === 0 ? 'Winner' : i === 1 ? 'Runner Up' : 'Third Place';
      
      const result = await sql`
        INSERT INTO player_awards (
          player_id, player_name, season_id,
          award_category, award_type, award_position,
          player_category, awarded_by, notes,
          performance_stats
        )
        VALUES (
          ${player.player_id}, ${player.player_name}, ${seasonId},
          'individual', 'Most Clean Sheets', ${position},
          NULL, 'system', 'Auto-awarded based on clean sheets',
          ${JSON.stringify({ clean_sheets: player.clean_sheets })}
        )
        ON CONFLICT (player_id, season_id, award_category, award_type, award_position) DO NOTHING
        RETURNING *
      `;
      
      if (result.length > 0) {
        awardsGiven++;
        awards.push({
          player_id: player.player_id,
          player_name: player.player_name,
          award_category: 'individual',
          award_type: 'Most Clean Sheets',
          award_position: position,
          player_category: null
        });
        console.log(`    ✅ ${position}: ${player.player_name} (${player.clean_sheets} clean sheets)`);
        
        await sql`
          UPDATE player_season
          SET awards_count = COALESCE(awards_count, 0) + 1
          WHERE player_id = ${player.player_id} AND season_id = ${seasonId}
        `;
      }
    }

    // ============================================
    // CATEGORY AWARDS (Per Position)
    // ============================================
    
    const categories = ['Attacker', 'Midfielder', 'Defender', 'Goalkeeper'];
    
    for (const category of categories) {
      console.log(`  📊 Awarding Best ${category}...`);
      
      let orderBy = 'goals_scored DESC, assists DESC';
      if (category === 'Defender' || category === 'Goalkeeper') {
        orderBy = 'clean_sheets DESC, goals_scored DESC';
      }
      
      const topPlayers = await sql.unsafe(`
        SELECT player_id, player_name, category, 
               goals_scored, assists, clean_sheets
        FROM realplayerstats
        WHERE season_id = '${seasonId}' AND category = '${category}'
        ORDER BY ${orderBy}
        LIMIT ${awardTopN}
      `);
      
      for (let i = 0; i < topPlayers.length; i++) {
        const player = topPlayers[i];
        const position = i === 0 ? 'Winner' : i === 1 ? 'Runner Up' : 'Third Place';
        
        const result = await sql`
          INSERT INTO player_awards (
            player_id, player_name, season_id,
            award_category, award_type, award_position,
            player_category, awarded_by, notes,
            performance_stats
          )
          VALUES (
            ${player.player_id}, ${player.player_name}, ${seasonId},
            'category', ${`Best ${category}`}, ${position},
            ${category}, 'system', 'Auto-awarded based on category performance',
            ${JSON.stringify({
              goals: player.goals_scored,
              assists: player.assists,
              clean_sheets: player.clean_sheets
            })}
          )
          ON CONFLICT (player_id, season_id, award_category, award_type, award_position) DO NOTHING
          RETURNING *
        `;
        
        if (result.length > 0) {
          awardsGiven++;
          awards.push({
            player_id: player.player_id,
            player_name: player.player_name,
            award_category: 'category',
            award_type: `Best ${category}`,
            award_position: position,
            player_category: category
          });
          console.log(`    ✅ ${position}: ${player.player_name}`);
          
          await sql`
            UPDATE player_season
            SET awards_count = COALESCE(awards_count, 0) + 1
            WHERE player_id = ${player.player_id} AND season_id = ${seasonId}
          `;
        }
      }
    }

    console.log(`\n🏆 Player awards auto-award complete: ${awardsGiven} awards given`);
    
    return {
      success: true,
      awardsGiven,
      awards
    };
    
  } catch (error: any) {
    console.error('❌ Error awarding player awards:', error);
    return {
      success: false,
      awardsGiven: 0,
      awards: [],
      error: error.message || 'Failed to award player awards'
    };
  }
}
