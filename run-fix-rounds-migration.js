require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

(async () => {
  try {
    console.log('🔄 Running migration to fix rounds.id type...\n');
    
    const migration = fs.readFileSync('fix-rounds-id-type.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.toUpperCase().includes('SELECT')) {
        const result = await sql.unsafe(statement);
        console.log('Verification result:', JSON.stringify(result, null, 2));
      } else {
        await sql.unsafe(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  }
})();
