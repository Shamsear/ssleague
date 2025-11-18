import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import * as readline from 'readline';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function standardizeTeamNames() {
  console.log('📋 Team Name Standardization Tool\n');
  console.log('⚠️  Note: SSPSLT0006 will be skipped (as requested)\n');
  
  // Get all unique team_ids and their name variations
  const teams = await sql`
    SELECT 
      team_id,
      array_agg(DISTINCT team_name ORDER BY team_name) as name_variations,
      array_agg(DISTINCT season_id ORDER BY season_id) as seasons
    FROM teamstats
    WHERE team_id != 'SSPSLT0006'
    GROUP BY team_id
    ORDER BY team_id
  `;
  
  console.log(`Found ${teams.length} teams (excluding SSPSLT0006)\n`);
  
  const updates: Array<{teamId: string; newName: string}> = [];
  
  for (const team of teams) {
    const nameVariations = team.name_variations as string[];
    
    // Skip if team already has consistent naming
    if (nameVariations.length === 1) {
      console.log(`✅ ${team.team_id}: Already consistent ("${nameVariations[0]}")`);
      continue;
    }
    
    console.log(`\n🔍 ${team.team_id}:`);
    console.log(`   Current name variations: ${nameVariations.join(', ')}`);
    console.log(`   Seasons: ${(team.seasons as string[]).join(', ')}`);
    
    // Show options
    console.log('\nOptions:');
    nameVariations.forEach((name, index) => {
      console.log(`  ${index + 1}) ${name}`);
    });
    console.log(`  ${nameVariations.length + 1}) Enter a custom name`);
    console.log(`  0) Skip this team`);
    
    const choice = await question('\nYour choice: ');
    const choiceNum = parseInt(choice);
    
    if (choiceNum === 0) {
      console.log('⏭️  Skipped');
      continue;
    }
    
    let selectedName: string;
    
    if (choiceNum > 0 && choiceNum <= nameVariations.length) {
      selectedName = nameVariations[choiceNum - 1];
    } else if (choiceNum === nameVariations.length + 1) {
      selectedName = await question('Enter custom name: ');
      if (!selectedName.trim()) {
        console.log('❌ Invalid name, skipping');
        continue;
      }
    } else {
      console.log('❌ Invalid choice, skipping');
      continue;
    }
    
    updates.push({ teamId: team.team_id as string, newName: selectedName });
    console.log(`✅ Will update to: "${selectedName}"`);
  }
  
  if (updates.length === 0) {
    console.log('\n✅ No updates needed!');
    rl.close();
    return;
  }
  
  // Confirm before updating
  console.log('\n\n📝 Summary of changes:');
  updates.forEach(({ teamId, newName }) => {
    console.log(`  ${teamId} → "${newName}"`);
  });
  
  const confirm = await question('\nProceed with these updates? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Cancelled');
    rl.close();
    return;
  }
  
  console.log('\n🔄 Updating team names...\n');
  
  for (const { teamId, newName } of updates) {
    const result = await sql`
      UPDATE teamstats 
      SET team_name = ${newName}, updated_at = NOW()
      WHERE team_id = ${teamId}
    `;
    console.log(`✅ Updated ${teamId} to "${newName}" (${result.length} seasons)`);
  }
  
  console.log('\n✅ All updates complete!');
  rl.close();
}

standardizeTeamNames()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    rl.close();
    process.exit(1);
  });
