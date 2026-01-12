import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function checkSchema() {
    console.log('🔍 Checking player_seasons table schema...\n');

    try {
        // Get all columns
        const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons'
      ORDER BY ordinal_position
    `;

        console.log('📊 player_seasons table columns:\n');
        columns.forEach(col => {
            const nullable = col.is_nullable === 'NO' ? '(NOT NULL)' : '';
            const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
            console.log(`   ✓ ${col.column_name}: ${col.data_type} ${nullable} ${defaultVal}`.trim());
        });

        console.log(`\n✅ Total columns: ${columns.length}`);

        // Check for specific columns
        const columnNames = columns.map(c => c.column_name);
        console.log('\n🔎 Checking for specific columns:');
        console.log(`   - goals_conceded: ${columnNames.includes('goals_conceded') ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   - goal_difference: ${columnNames.includes('goal_difference') ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   - base_points: ${columnNames.includes('base_points') ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   - auction_value: ${columnNames.includes('auction_value') ? '✅ EXISTS' : '❌ MISSING'}`);

        // Get sample data
        console.log('\n📝 Sample data (first 3 rows):');
        const sample = await sql`
      SELECT * FROM player_seasons
      LIMIT 3
    `;

        if (sample.length > 0) {
            console.log('\nAvailable fields in actual data:');
            console.log(Object.keys(sample[0]).join(', '));

            console.log('\nSample records:');
            sample.forEach((row, i) => {
                console.log(`\n${i + 1}. ${row.player_name} (${row.team || 'No team'})`);
                console.log(`   - Points: ${row.points}`);
                console.log(`   - Matches: ${row.matches_played}`);
                console.log(`   - Goals: ${row.goals_scored}`);
                console.log(`   - Star Rating: ${row.star_rating}`);
            });
        } else {
            console.log('   No data found in table');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

checkSchema()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
