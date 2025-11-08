import { fantasySql } from '../lib/neon/fantasy-config';

/**
 * Seed default fantasy scoring rules for all leagues
 * Run with: npx tsx scripts/seed-fantasy-scoring-rules.ts
 */

const defaultScoringRules = [
  {
    rule_type: 'goals_scored',
    rule_name: 'Goal Scored',
    points_value: 5,
    description: 'Points awarded for scoring a goal'
  },
  {
    rule_type: 'goals_conceded',
    rule_name: 'Goal Conceded',
    points_value: -1,
    description: 'Points deducted for conceding a goal'
  },
  {
    rule_type: 'win',
    rule_name: 'Match Win',
    points_value: 3,
    description: 'Points awarded for winning a match'
  },
  {
    rule_type: 'draw',
    rule_name: 'Match Draw',
    points_value: 1,
    description: 'Points awarded for drawing a match'
  },
  {
    rule_type: 'loss',
    rule_name: 'Match Loss',
    points_value: 0,
    description: 'No points for losing a match'
  },
  {
    rule_type: 'clean_sheet',
    rule_name: 'Clean Sheet Bonus',
    points_value: 4,
    description: 'Bonus points for not conceding any goals in a match'
  },
  {
    rule_type: 'motm',
    rule_name: 'Man of the Match',
    points_value: 5,
    description: 'Bonus points for being awarded Man of the Match'
  },
  {
    rule_type: 'potm',
    rule_name: 'Player of the Month',
    points_value: 10,
    description: 'Bonus points for being awarded Player of the Month'
  },
  {
    rule_type: 'fine_goals',
    rule_name: 'Fine Goals Penalty',
    points_value: -2,
    description: 'Penalty points for fine goals (disciplinary infractions)'
  },
  {
    rule_type: 'substitution_out',
    rule_name: 'Substituted Out',
    points_value: -1,
    description: 'Penalty points for being substituted out during a match'
  },
  {
    rule_type: 'yellow_card',
    rule_name: 'Yellow Card',
    points_value: -1,
    description: 'Penalty points for receiving a yellow card'
  },
  {
    rule_type: 'red_card',
    rule_name: 'Red Card',
    points_value: -3,
    description: 'Penalty points for receiving a red card'
  },
  {
    rule_type: 'assist',
    rule_name: 'Assist',
    points_value: 3,
    description: 'Points awarded for providing an assist'
  },
  {
    rule_type: 'own_goal',
    rule_name: 'Own Goal',
    points_value: -5,
    description: 'Penalty points for scoring an own goal'
  },
  {
    rule_type: 'penalty_saved',
    rule_name: 'Penalty Saved',
    points_value: 5,
    description: 'Bonus points for saving a penalty (goalkeepers)'
  },
  {
    rule_type: 'penalty_missed',
    rule_name: 'Penalty Missed',
    points_value: -2,
    description: 'Penalty points for missing a penalty'
  },
  {
    rule_type: 'hat_trick',
    rule_name: 'Hat Trick Bonus',
    points_value: 5,
    description: 'Bonus points for scoring 3+ goals in a match'
  },
  {
    rule_type: 'captain_multiplier',
    rule_name: 'Captain Multiplier',
    points_value: 2,
    description: 'Multiplier for captain points (2x)'
  },
  {
    rule_type: 'vice_captain_multiplier',
    rule_name: 'Vice Captain Multiplier',
    points_value: 1,
    description: 'Bonus points multiplier for vice captain (1.5x total when applied)'
  },
  {
    rule_type: 'appearance',
    rule_name: 'Match Appearance',
    points_value: 2,
    description: 'Points for appearing in a match'
  },
  // Team-level scoring rules (passive points from supported team)
  {
    rule_type: 'team_win',
    rule_name: 'Supported Team Win',
    points_value: 5,
    description: 'Bonus points when your supported team wins a match'
  },
  {
    rule_type: 'team_draw',
    rule_name: 'Supported Team Draw',
    points_value: 2,
    description: 'Bonus points when your supported team draws a match'
  },
  {
    rule_type: 'team_loss',
    rule_name: 'Supported Team Loss',
    points_value: 0,
    description: 'No points when your supported team loses'
  },
  {
    rule_type: 'team_clean_sheet',
    rule_name: 'Supported Team Clean Sheet',
    points_value: 3,
    description: 'Bonus when your supported team keeps a clean sheet'
  },
  {
    rule_type: 'team_goals_scored',
    rule_name: 'Supported Team Goals',
    points_value: 1,
    description: 'Points per goal scored by your supported team'
  },
  {
    rule_type: 'team_big_win',
    rule_name: 'Supported Team Big Win',
    points_value: 3,
    description: 'Bonus for winning by 3+ goals margin'
  },
  {
    rule_type: 'team_comeback_win',
    rule_name: 'Supported Team Comeback',
    points_value: 5,
    description: 'Bonus for winning after being behind'
  },
  {
    rule_type: 'team_tournament_winner',
    rule_name: 'Supported Team Tournament Winner',
    points_value: 20,
    description: 'Bonus if your supported team wins the tournament'
  },
  {
    rule_type: 'team_top_scorer',
    rule_name: 'Supported Team Top Scorer',
    points_value: 10,
    description: 'Bonus if a player from your supported team is top scorer'
  }
];

async function seedScoringRules() {
  try {
    console.log('🌱 Starting to seed fantasy scoring rules...');

    // Get all leagues
    const leagues = await fantasySql`
      SELECT league_id, league_name FROM fantasy_leagues
    `;

    if (leagues.length === 0) {
      console.log('⚠️  No fantasy leagues found. Please create a league first.');
      return;
    }

    console.log(`📋 Found ${leagues.length} league(s)`);

    for (const league of leagues) {
      console.log(`\n🏆 Processing league: ${league.league_name} (${league.league_id})`);

      // Get existing rule types
      const existingRules = await fantasySql`
        SELECT rule_type FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
      `;

      const existingRuleTypes = new Set(existingRules.map((r: any) => r.rule_type));
      const ruleCount = existingRules.length;

      console.log(`   ℹ️  ${ruleCount} rules already exist`);
      
      if (ruleCount === defaultScoringRules.length) {
        console.log(`   ✅ All rules already present, skipping...`);
        continue;
      }

      // Insert missing rules for this league
      let insertedCount = 0;
      for (const rule of defaultScoringRules) {
        // Skip if rule already exists
        if (existingRuleTypes.has(rule.rule_type)) {
          continue;
        }
        
        const rule_id = `${league.league_id}_${rule.rule_type}`;
        
        try {
          await fantasySql`
            INSERT INTO fantasy_scoring_rules (
              rule_id,
              league_id,
              rule_type,
              rule_name,
              points_value,
              description,
              is_active
            ) VALUES (
              ${rule_id},
              ${league.league_id},
              ${rule.rule_type},
              ${rule.rule_name},
              ${rule.points_value},
              ${rule.description},
              true
            )
          `;
          insertedCount++;
        } catch (error: any) {
          if (error.code === '23505') { // Unique constraint violation
            console.log(`   ⚠️  Rule "${rule.rule_type}" already exists, skipping...`);
          } else {
            console.error(`   ❌ Error inserting rule "${rule.rule_type}":`, error.message);
          }
        }
      }

      console.log(`   ✅ Inserted ${insertedCount} scoring rules`);
    }

    // Display summary
    console.log('\n📊 Summary:');
    const totalRules = await fantasySql`
      SELECT 
        COUNT(*) as total_rules,
        COUNT(DISTINCT league_id) as leagues_with_rules
      FROM fantasy_scoring_rules
    `;

    console.log(`   Total scoring rules: ${totalRules[0].total_rules}`);
    console.log(`   Leagues with rules: ${totalRules[0].leagues_with_rules}`);

    // Show rules for first league as example
    if (leagues.length > 0) {
      console.log(`\n📖 Example rules for ${leagues[0].league_name}:`);
      const exampleRules = await fantasySql`
        SELECT rule_type, rule_name, points_value, description
        FROM fantasy_scoring_rules
        WHERE league_id = ${leagues[0].league_id}
        ORDER BY 
          CASE 
            WHEN points_value > 0 THEN 1
            WHEN points_value = 0 THEN 2
            ELSE 3
          END,
          points_value DESC
        LIMIT 10
      `;

      exampleRules.forEach((rule: any) => {
        const points = rule.points_value > 0 ? `+${rule.points_value}` : rule.points_value;
        console.log(`   ${rule.rule_name}: ${points} pts - ${rule.description}`);
      });
    }

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding scoring rules:', error);
    throw error;
  }
}

// Run the seeding function
seedScoringRules()
  .then(() => {
    console.log('\n👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
