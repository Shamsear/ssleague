const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    const databaseUrl = process.env.FANTASY_DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ FANTASY_DATABASE_URL environment variable is not set');
        process.exit(1);
    }

    console.log('🔗 Connecting to fantasy database...');
    const sql = neon(databaseUrl);

    try {
        console.log('🔄 Creating fantasy_team_affiliation_history table...\n');

        // Read and execute the migration file
        const migrationPath = path.join(__dirname, '../database/migrations/add-fantasy-affiliation-history.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement.toLowerCase().includes('select')) {
                // For SELECT statements, show the results
                const result = await sql.unsafe(statement);
                console.log('✅', result[0]);
            } else {
                await sql.unsafe(statement);
            }
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('✅ fantasy_team_affiliation_history table created');
        console.log('✅ Initial history populated from current fantasy_teams data');
        console.log('\n💡 Teams can now change their supported team during transfer windows');
        console.log('💡 Historical data will be preserved for accurate point recalculation');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
