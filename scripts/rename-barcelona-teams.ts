import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function renameTeams() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('🔄 Renaming Barcelona teams...\n');
  
  // Step 1: Rename existing Barcelona team (SSPSLT0007) to "FC Barcelona(A)" for all seasons
  console.log('Step 1: Renaming SSPSLT0007 (Barcelona) to "FC Barcelona(A)"...');
  
  const oldBarcelonaSeasons = await sql`
    SELECT season_id, team_name 
    FROM teamstats 
    WHERE team_id = 'SSPSLT0007'
    ORDER BY season_id
  `;
  
  console.log('  Current names:');
  oldBarcelonaSeasons.forEach((row: any) => {
    console.log(`    ${row.season_id}: "${row.team_name}"`);
  });
  
  const updateOldBarca = await sql`
    UPDATE teamstats 
    SET team_name = 'FC Barcelona(A)', updated_at = NOW()
    WHERE team_id = 'SSPSLT0007'
  `;
  
  console.log(`  ✅ Updated ${updateOldBarca.length} season(s) to "FC Barcelona(A)"\n`);
  
  // Step 2: Rename Azzuri (SSPSLT0006) to "FC Barcelona" for S16 and S17 only
  console.log('Step 2: Renaming SSPSLT0006 (Azzuri) to "FC Barcelona" for S16 & S17...');
  
  const azzuriSeasons = await sql`
    SELECT season_id, team_name 
    FROM teamstats 
    WHERE team_id = 'SSPSLT0006'
    ORDER BY season_id
  `;
  
  console.log('  Current names:');
  azzuriSeasons.forEach((row: any) => {
    console.log(`    ${row.season_id}: "${row.team_name}"`);
  });
  
  const updateAzzuri = await sql`
    UPDATE teamstats 
    SET team_name = 'FC Barcelona', updated_at = NOW()
    WHERE team_id = 'SSPSLT0006' 
    AND season_id IN ('SSPSLS16', 'SSPSLS17')
  `;
  
  console.log(`  ✅ Updated ${updateAzzuri.length} season(s) to "FC Barcelona"\n`);
  
  // Verify changes
  console.log('📋 Verification - Final names:\n');
  
  console.log('SSPSLT0007 (formerly Barcelona):');
  const verifyOldBarca = await sql`
    SELECT season_id, team_name 
    FROM teamstats 
    WHERE team_id = 'SSPSLT0007'
    ORDER BY season_id
  `;
  verifyOldBarca.forEach((row: any) => {
    console.log(`  ${row.season_id}: "${row.team_name}"`);
  });
  
  console.log('\nSSPSLT0006 (formerly Azzuri):');
  const verifyAzzuri = await sql`
    SELECT season_id, team_name 
    FROM teamstats 
    WHERE team_id = 'SSPSLT0006'
    ORDER BY season_id
  `;
  verifyAzzuri.forEach((row: any) => {
    console.log(`  ${row.season_id}: "${row.team_name}"`);
  });
  
  console.log('\n✅ Rename complete!');
}

renameTeams()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
