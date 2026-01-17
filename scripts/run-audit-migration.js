const { neon } = require('@neondatabase/serverless');
require('dotenv/config');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

        if (!connectionString) {
            throw new Error('NEON_TOURNAMENT_DB_URL not found in environment');
        }

        console.log('🔌 Connecting to database...');
        const sql = neon(connectionString);

        console.log('📄 Reading migration file...');
        const migrationPath = path.join(__dirname, '../database/migrations/add-fixture-audit-trail.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Running migration...');
        await sql(migration);

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
