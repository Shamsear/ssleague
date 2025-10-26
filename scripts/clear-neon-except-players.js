/**
 * Clear Neon Database - Keep Football Players
 * Clears all tables EXCEPT footballplayers
 */

const { neon } = require('@neondatabase/serverless');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearNeonExceptPlayers() {
  console.log('\n🐘 NEON DATABASE CLEANUP (Keep Football Players)\n');
  console.log('⚠️  This will DELETE all data EXCEPT footballplayers table!\n');
  
  return new Promise((resolve) => {
    rl.question('Type "CLEAR NEON" to confirm: ', async (answer) => {
      rl.close();
      
      if (answer !== 'CLEAR NEON') {
        console.log('\n❌ Cancelled.');
        resolve(false);
        return;
      }

      console.log('\n🚀 Starting Neon cleanup...\n');

      try {
        // Get all tables
        const tables = await sql`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `;
        
        console.log(`Found ${tables.length} tables\n`);

        let clearedCount = 0;
        let totalRecordsDeleted = 0;

        for (const table of tables) {
          const tableName = table.table_name;
          
          // Skip footballplayers table
          if (tableName === 'footballplayers') {
            console.log(`🔒 SKIPPING: ${tableName} (preserving data)`);
            continue;
          }
          
          try {
            // Get count before deletion
            const countBefore = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
            const recordCount = parseInt(countBefore[0]?.count || 0);
            
            if (recordCount > 0) {
              // Use TRUNCATE for better performance
              await sql.unsafe(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
              console.log(`✅ ${tableName}: Cleared ${recordCount} records`);
              totalRecordsDeleted += recordCount;
              clearedCount++;
            } else {
              console.log(`ℹ️  ${tableName}: Already empty`);
            }
          } catch (error) {
            console.log(`⚠️  ${tableName}: Error - ${error.message}`);
          }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ NEON CLEANUP COMPLETED!\n');
        console.log('📊 Summary:');
        console.log(`   - Tables cleared: ${clearedCount}`);
        console.log(`   - Total records deleted: ${totalRecordsDeleted}`);
        console.log(`   - footballplayers: PRESERVED ✅`);
        console.log('='.repeat(60) + '\n');

        resolve(true);
      } catch (error) {
        console.error('❌ Error:', error);
        resolve(false);
      }
    });
  });
}

clearNeonExceptPlayers().then((success) => {
  process.exit(success ? 0 : 1);
});
