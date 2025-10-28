import * as dotenv from 'dotenv';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyTables() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('🔍 Checking lineup system tables...\n');
  
  // Check all public tables
  const allTables = await sql`
    SELECT table_name, 
           (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  
  console.log(`Found ${allTables.length} tables in Tournament DB:\n`);
  allTables.forEach(t => {
    const isNew = ['lineups', 'lineup_substitutions'].includes(t.table_name);
    console.log(`${isNew ? '🆕' : '  '} ${t.table_name} (${t.column_count} columns)`);
  });
  
  // Check if lineups table exists
  const lineups = allTables.find(t => t.table_name === 'lineups');
  const subs = allTables.find(t => t.table_name === 'lineup_substitutions');
  
  console.log('\n' + '='.repeat(60));
  if (lineups && subs) {
    console.log('✅ Lineup system tables created successfully!');
  } else {
    console.log('❌ Lineup tables not found!');
    if (!lineups) console.log('  Missing: lineups');
    if (!subs) console.log('  Missing: lineup_substitutions');
  }
}

verifyTables().catch(console.error);
