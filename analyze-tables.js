// Analyze which tables are used
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function analyzeTables() {
  try {
    console.log('Analyzing tables in Neon database...\n');
    
    const analysis = {
      '✅ USED': [],
      '❌ UNUSED (OLD SCHEMA)': [],
      '❓ CHECK': []
    };
    
    // Check each table
    const tables = [
      'rounds',          // Current schema - used for auction rounds
      'bids',            // Current schema - used for bids
      'team_players',    // Current schema - used for player assignments
      'footballplayers', // Current schema - player data
      'starred_players', // Current schema - starred players
      
      'auction_rounds',  // OLD schema? Check if used
      'round_players',   // OLD schema? Replaced by bids
      'round_bids',      // OLD schema? Duplicate of bids?
      'auction_settings',// OLD schema? Check if used
      'teams',           // OLD schema? Teams in Firebase now
    ];
    
    for (const table of tables) {
      try {
        const result = await sql`
          SELECT COUNT(*) as count FROM ${sql(table)}
        `;
        const count = parseInt(result[0]?.count || '0');
        
        // Categorize
        if (table === 'rounds' || table === 'bids' || table === 'team_players' || 
            table === 'footballplayers' || table === 'starred_players') {
          analysis['✅ USED'].push(`${table} (${count} rows)`);
        } else if (table === 'auction_rounds' || table === 'round_players' || 
                   table === 'round_bids' || table === 'teams' || table === 'auction_settings') {
          analysis['❌ UNUSED (OLD SCHEMA)'].push(`${table} (${count} rows)`);
        } else {
          analysis['❓ CHECK'].push(`${table} (${count} rows)`);
        }
      } catch (err) {
        analysis['❓ CHECK'].push(`${table} (ERROR: ${err.message})`);
      }
    }
    
    // Display results
    console.log('='.repeat(60));
    console.log('TABLE ANALYSIS');
    console.log('='.repeat(60));
    console.log('');
    
    Object.entries(analysis).forEach(([category, tables]) => {
      if (tables.length > 0) {
        console.log(`\n${category}:\n`);
        tables.forEach(table => console.log(`  • ${table}`));
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\nRECOMMENDATION:');
    console.log('Safe to drop: auction_rounds, round_players, round_bids, auction_settings, teams');
    console.log('Keep: rounds, bids, team_players, footballplayers, starred_players');
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

analyzeTables();
