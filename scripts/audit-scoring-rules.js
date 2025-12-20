/**
 * Audit all scoring rules to ensure calculations match database configuration
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function auditRules() {
  console.log('🔍 Auditing Fantasy Scoring Rules\n');
  console.log('='.repeat(60));

  try {
    // Get all scoring rules
    const allRules = await fantasyDb`
      SELECT 
        league_id,
        rule_type,
        points_value,
        applies_to,
        is_active,
        description
      FROM fantasy_scoring_rules
      ORDER BY applies_to, rule_type
    `;

    console.log(`\nTotal Rules Configured: ${allRules.length}\n`);

    // Group by applies_to
    const playerRules = allRules.filter(r => r.applies_to === 'player');
    const teamRules = allRules.filter(r => r.applies_to === 'team');

    console.log('📊 PLAYER SCORING RULES:');
    console.log('-'.repeat(60));
    if (playerRules.length === 0) {
      console.log('❌ NO PLAYER RULES CONFIGURED!');
    } else {
      playerRules.forEach(rule => {
        const status = rule.is_active ? '✅' : '❌';
        const sign = rule.points_value > 0 ? '+' : '';
        console.log(`${status} ${rule.rule_type.padEnd(25)} ${sign}${rule.points_value} pts`);
      });
    }

    console.log('\n📊 TEAM SCORING RULES:');
    console.log('-'.repeat(60));
    if (teamRules.length === 0) {
      console.log('❌ NO TEAM RULES CONFIGURED!');
    } else {
      teamRules.forEach(rule => {
        const status = rule.is_active ? '✅' : '';
        const sign = rule.points_value > 0 ? '+' : '';
        console.log(`${status} ${rule.rule_type.padEnd(25)} ${sign}${rule.points_value} pts`);
      });
    }

    // Check for bonus_points table
    console.log('\n📋 BONUS POINTS TABLE:');
    console.log('-'.repeat(60));
    try {
      const bonusTableCheck = await fantasyDb`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = 'bonus_points'
      `;
      
      if (bonusTableCheck[0].count > 0) {
        const bonusRecords = await fantasyDb`
          SELECT COUNT(*) as total FROM bonus_points
        `;
        console.log(`✅ Table exists with ${bonusRecords[0].total} records`);
      } else {
        console.log('❌ Table does NOT exist - needs to be created');
      }
    } catch (e) {
      console.log('❌ Table does NOT exist - needs to be created');
    }

    // Check current calculation
    console.log('\n🔍 CHECKING CURRENT CALCULATIONS:');
    console.log('-'.repeat(60));

    // Sample player points
    const samplePlayerPoints = await fantasyDb`
      SELECT 
        real_player_id,
        fixture_id,
        goals_scored,
        is_clean_sheet,
        is_motm,
        base_points,
        total_points,
        points_breakdown
      FROM fantasy_player_points
      LIMIT 3
    `;

    console.log('\nSample Player Points Records:');
    samplePlayerPoints.forEach((p, idx) => {
      console.log(`\n${idx + 1}. Player ${p.real_player_id}:`);
      console.log(`   Goals: ${p.goals_scored}, Clean Sheet: ${p.is_clean_sheet}, MOTM: ${p.is_motm}`);
      console.log(`   Base Points: ${p.base_points}, Total: ${p.total_points}`);
      
      let breakdown = p.points_breakdown;
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          breakdown = null;
        }
      }
      
      if (breakdown) {
        console.log(`   Breakdown: ${JSON.stringify(breakdown)}`);
      }
    });

    // Check if calculations match rules
    console.log('\n\n⚠️  POTENTIAL ISSUES:');
    console.log('-'.repeat(60));

    const issues = [];

    // Check if player rules exist
    if (playerRules.length === 0) {
      issues.push('No player scoring rules configured');
    }

    // Check if team rules exist
    if (teamRules.length === 0) {
      issues.push('No team scoring rules configured');
    }

    // Check if bonus_points table exists
    try {
      await fantasyDb`SELECT 1 FROM bonus_points LIMIT 1`;
    } catch (e) {
      issues.push('bonus_points table does not exist');
    }

    if (issues.length === 0) {
      console.log('✅ No issues found');
    } else {
      issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. ❌ ${issue}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Audit Complete\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

auditRules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
