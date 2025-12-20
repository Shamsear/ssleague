/**
 * Check what team scoring rules are configured and being applied
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function checkTeamRules() {
  console.log('🔍 Checking Team Scoring Rules Configuration...\n');

  try {
    // 1. Get all team scoring rules
    console.log('1️⃣ Configured Team Scoring Rules:');
    const teamRules = await fantasyDb`
      SELECT 
        rule_type,
        points_value,
        applies_to,
        is_active,
        league_id
      FROM fantasy_scoring_rules
      WHERE applies_to = 'team'
      ORDER BY league_id, rule_type
    `;

    if (teamRules.length === 0) {
      console.log('❌ NO TEAM SCORING RULES CONFIGURED!');
      console.log('   This is why only basic bonuses are being awarded\n');
      return;
    }

    console.log(`Found ${teamRules.length} team scoring rules:\n`);
    
    const rulesByLeague = {};
    teamRules.forEach(rule => {
      if (!rulesByLeague[rule.league_id]) {
        rulesByLeague[rule.league_id] = [];
      }
      rulesByLeague[rule.league_id].push(rule);
    });

    Object.entries(rulesByLeague).forEach(([leagueId, rules]) => {
      console.log(`League: ${leagueId}`);
      rules.forEach(rule => {
        const status = rule.is_active ? '✅' : '❌';
        const sign = rule.points_value > 0 ? '+' : '';
        console.log(`  ${status} ${rule.rule_type}: ${sign}${rule.points_value} pts`);
      });
      console.log('');
    });

    // 2. Check what rules are being checked in the code
    console.log('2️⃣ Rules Checked in Calculation Logic:');
    console.log('   According to app/api/fantasy/calculate-team-bonuses/route.ts:\n');
    console.log('   ✅ win - if goals_scored > goals_conceded');
    console.log('   ✅ draw - if goals_scored === goals_conceded');
    console.log('   ✅ loss - if goals_scored < goals_conceded');
    console.log('   ✅ clean_sheet - if goals_conceded === 0');
    console.log('   ✅ high_scoring - if goals_scored >= 4');
    console.log('');

    // 3. Check what rules are MISSING from the code
    console.log('3️⃣ Checking for Missing Rule Types:');
    const implementedRules = ['win', 'draw', 'loss', 'clean_sheet', 'high_scoring'];
    const configuredRuleTypes = [...new Set(teamRules.map(r => r.rule_type))];
    
    const missingInCode = configuredRuleTypes.filter(r => !implementedRules.includes(r));
    const notConfigured = implementedRules.filter(r => !configuredRuleTypes.includes(r));

    if (missingInCode.length > 0) {
      console.log('\n⚠️  Rules configured but NOT implemented in code:');
      missingInCode.forEach(rule => {
        console.log(`   ❌ ${rule} - needs to be added to calculation logic`);
      });
    }

    if (notConfigured.length > 0) {
      console.log('\n💡 Rules implemented in code but NOT configured:');
      notConfigured.forEach(rule => {
        console.log(`   ⚪ ${rule} - can be added to database`);
      });
    }

    if (missingInCode.length === 0 && notConfigured.length === 0) {
      console.log('   ✅ All configured rules are implemented!');
    }

    // 4. Suggest additional rules that could be added
    console.log('\n4️⃣ Potential Additional Rules:');
    const potentialRules = [
      { name: 'concede_4_plus', description: 'Penalty for conceding 4+ goals', example: '-2' },
      { name: 'score_6_plus', description: 'Bonus for scoring 6+ goals', example: '+3' },
      { name: 'score_8_plus', description: 'Bonus for scoring 8+ goals', example: '+5' },
      { name: 'big_win', description: 'Win by 3+ goals margin', example: '+2' },
      { name: 'comeback_win', description: 'Win after being behind', example: '+3' },
      { name: 'shutout_win', description: 'Win with clean sheet', example: '+2' },
    ];

    console.log('   Rules that could be added:\n');
    potentialRules.forEach(rule => {
      const isConfigured = configuredRuleTypes.includes(rule.name);
      console.log(`   ${isConfigured ? '✅' : '⚪'} ${rule.name}: ${rule.description} (e.g., ${rule.example} pts)`);
    });

    // 5. Check actual bonus records to see what's being awarded
    console.log('\n5️⃣ Analyzing Actual Bonus Awards:');
    const bonusRecords = await fantasyDb`
      SELECT 
        bonus_breakdown,
        total_bonus,
        round_number
      FROM fantasy_team_bonus_points
      ORDER BY round_number DESC
      LIMIT 10
    `;

    const bonusTypesUsed = new Set();
    bonusRecords.forEach(record => {
      let breakdown = record.bonus_breakdown;
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          breakdown = {};
        }
      }
      if (breakdown) {
        Object.keys(breakdown).forEach(key => bonusTypesUsed.add(key));
      }
    });

    console.log(`   Bonus types actually awarded in last 10 records:`);
    if (bonusTypesUsed.size === 0) {
      console.log('   ⚠️  No bonus types found in records');
    } else {
      bonusTypesUsed.forEach(type => {
        console.log(`   ✅ ${type}`);
      });
    }

    // 6. Summary and recommendations
    console.log('\n6️⃣ Summary & Recommendations:');
    console.log(`   Configured rules: ${teamRules.length}`);
    console.log(`   Active rules: ${teamRules.filter(r => r.is_active).length}`);
    console.log(`   Implemented in code: ${implementedRules.length}`);
    console.log(`   Actually being awarded: ${bonusTypesUsed.size}`);

    if (missingInCode.length > 0) {
      console.log('\n   ⚠️  ACTION REQUIRED:');
      console.log('   Some configured rules are not implemented in the calculation code.');
      console.log('   Update app/api/fantasy/calculate-team-bonuses/route.ts to include:');
      missingInCode.forEach(rule => {
        console.log(`   - ${rule}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTeamRules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
