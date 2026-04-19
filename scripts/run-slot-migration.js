const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('\n🚀 Running Football Slot Management Migration...\n');
  
  const connectionString = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: Database URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_football_slot_management.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove comments
    migrationSQL = migrationSQL.replace(/--[^\n]*/g, '');
    
    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        // Show first 80 chars of statement for debugging
        const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}: ${preview}...`);
        try {
          await pool.query(statement);
          console.log(`✅ Statement ${i + 1} completed\n`);
        } catch (err) {
          // Ignore "already exists" errors
          if (err.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)\n`);
          } else {
            console.error(`❌ Failed statement: ${preview}`);
            throw err;
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the changes
    console.log('🔍 Verifying migration...\n');
    
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'teams'
      AND column_name LIKE 'football_%slot%'
      ORDER BY column_name;
    `);
    
    console.log('📊 New columns in teams table:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) = ${col.column_default || 'NULL'}`);
    });
    
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'football_slot_purchases'
      );
    `);
    
    console.log(`\n📋 football_slot_purchases table: ${tableExists.rows[0].exists ? '✅ Created' : '❌ Not found'}`);
    
    console.log('\n🎉 All done! The dynamic slot system is now ready to use.\n');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
