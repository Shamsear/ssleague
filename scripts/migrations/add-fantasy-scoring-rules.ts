import { getFantasyDb } from '../../lib/neon/fantasy-config';

async function addFantasyScoringRulesTable() {
  try {
    const sql = getFantasyDb();

    console.log('Creating fantasy_scoring_rules table...');

    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS fantasy_scoring_rules (
        id SERIAL PRIMARY KEY,
        rule_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL REFERENCES fantasy_leagues(league_id),
        rule_type VARCHAR(100) NOT NULL,
        rule_name VARCHAR(255) NOT NULL,
        points_value INTEGER NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(league_id, rule_type)
      )
    `;

    console.log('✅ Table created successfully');

    // Create indexes
    console.log('Creating indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_scoring_rules_league 
      ON fantasy_scoring_rules(league_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_scoring_rules_active 
      ON fantasy_scoring_rules(league_id, is_active)
    `;

    console.log('✅ Indexes created successfully');

    // Get all existing leagues
    const leagues = await sql`
      SELECT league_id, season_name FROM fantasy_leagues
    `;

    console.log(`Found ${leagues.length} leagues. Creating default scoring rules...`);

    // Default scoring rules
    const defaultRules = [
      { rule_type: 'goals_scored', rule_name: 'Goal Scored', points_value: 5, description: 'Points for scoring a goal' },
      { rule_type: 'goals_conceded', rule_name: 'Goal Conceded', points_value: -1, description: 'Points deducted for conceding a goal' },
      { rule_type: 'win', rule_name: 'Match Win', points_value: 3, description: 'Points for winning a match' },
      { rule_type: 'draw', rule_name: 'Match Draw', points_value: 1, description: 'Points for drawing a match' },
      { rule_type: 'loss', rule_name: 'Match Loss', points_value: 0, description: 'Points for losing a match' },
      { rule_type: 'clean_sheet', rule_name: 'Clean Sheet', points_value: 4, description: 'Bonus for not conceding any goals' },
      { rule_type: 'motm', rule_name: 'Man of the Match', points_value: 5, description: 'Bonus for being Man of the Match' },
      { rule_type: 'fine_goals', rule_name: 'Fine Goal', points_value: -2, description: 'Penalty for fine goals' },
      { rule_type: 'substitution_penalty', rule_name: 'Substitution', points_value: -1, description: 'Penalty for substitutions' },
    ];

    // Insert rules for each league
    for (const league of leagues) {
      console.log(`Adding rules for league: ${league.season_name}`);
      
      for (const rule of defaultRules) {
        const ruleId = `${league.league_id}-${rule.rule_type}`;
        
        await sql`
          INSERT INTO fantasy_scoring_rules (
            rule_id,
            league_id,
            rule_type,
            rule_name,
            points_value,
            description,
            is_active
          ) VALUES (
            ${ruleId},
            ${league.league_id},
            ${rule.rule_type},
            ${rule.rule_name},
            ${rule.points_value},
            ${rule.description},
            true
          )
          ON CONFLICT (league_id, rule_type) DO UPDATE SET
            points_value = EXCLUDED.points_value,
            rule_name = EXCLUDED.rule_name,
            description = EXCLUDED.description,
            updated_at = NOW()
        `;
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log(`Created scoring rules for ${leagues.length} leagues`);
    
  } catch (error) {
    console.error('Error running migration:', error);
    throw error;
  }
}

// Run the migration
addFantasyScoringRulesTable()
  .then(() => {
    console.log('Migration finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
