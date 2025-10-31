// Load environment variables BEFORE any other imports
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '..', '.env.local') });

// Now import after env is loaded
import { getTournamentDb } from '../lib/neon/tournament-config';

/**
 * Migrate existing trophies to separate trophy_name and trophy_position
 * Parses combined names like "League Winner", "UCL Runner Up", etc.
 */
async function migrateExistingTrophies() {
  console.log('🚀 Starting migration of existing trophies...\n');
  
  try {
    const sql = getTournamentDb();
    
    // Helper function to parse trophy strings
    const parseTrophyName = (fullName: string): { name: string; position: string | null } => {
      const normalized = fullName.trim();
      
      // Check for position indicators at the end
      if (normalized.endsWith('Winner') || normalized.endsWith('winner')) {
        const trophyName = normalized.replace(/\s+Winners?$/i, '').trim();
        return { name: trophyName, position: 'Winner' };
      }
      
      if (normalized.endsWith('Runner Up') || normalized.endsWith('Runners Up')) {
        const trophyName = normalized.replace(/\s+Runners?\s+Up$/i, '').trim();
        return { name: trophyName, position: 'Runner Up' };
      }
      
      if (normalized.endsWith('Champions') || normalized.endsWith('Champion')) {
        const trophyName = normalized.replace(/\s+Champions?$/i, '').trim();
        return { name: trophyName, position: 'Champions' };
      }
      
      if (normalized.endsWith('Third Place')) {
        const trophyName = normalized.replace(/\s+Third\s+Place$/i, '').trim();
        return { name: trophyName, position: 'Third Place' };
      }
      
      // Check for ordinal positions (4th Place, 5th Place, etc.)
      const ordinalMatch = normalized.match(/^(.*?)\s+(\d+(?:st|nd|rd|th)\s+Place)$/i);
      if (ordinalMatch) {
        return { name: ordinalMatch[1].trim(), position: ordinalMatch[2] };
      }
      
      // If no position indicator found, return full name as trophy name
      return { name: normalized, position: null };
    };
    
    // 1. Fetch all existing trophies
    console.log('📊 Fetching existing trophies...');
    const existingTrophies = await sql`
      SELECT id, trophy_name, trophy_position
      FROM team_trophies
      WHERE trophy_position IS NULL
      ORDER BY id
    `;
    
    console.log(`Found ${existingTrophies.length} trophies to migrate\n`);
    
    if (existingTrophies.length === 0) {
      console.log('✅ No trophies need migration!');
      process.exit(0);
    }
    
    // 2. Migrate each trophy
    let migrated = 0;
    let skipped = 0;
    
    for (const trophy of existingTrophies) {
      const parsed = parseTrophyName(trophy.trophy_name);
      
      console.log(`\nProcessing: "${trophy.trophy_name}"`);
      console.log(`  → Name: "${parsed.name}"`);
      console.log(`  → Position: "${parsed.position || 'NULL'}"`);
      
      if (parsed.position) {
        // Update the trophy with separated name and position
        await sql`
          UPDATE team_trophies
          SET 
            trophy_name = ${parsed.name},
            trophy_position = ${parsed.position},
            updated_at = NOW()
          WHERE id = ${trophy.id}
        `;
        
        console.log(`  ✅ Migrated`);
        migrated++;
      } else {
        console.log(`  ⚠️  No position detected - keeping as-is`);
        skipped++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`\n🏆 Migration complete!`);
    console.log(`  ✅ Migrated: ${migrated}`);
    console.log(`  ⚠️  Skipped: ${skipped}`);
    console.log(`  📊 Total: ${existingTrophies.length}\n`);
    
    // 3. Show sample of migrated data
    console.log('📋 Sample of migrated trophies:');
    const sample = await sql`
      SELECT trophy_name, trophy_position
      FROM team_trophies
      WHERE trophy_position IS NOT NULL
      LIMIT 10
    `;
    
    sample.forEach(t => {
      console.log(`  - ${t.trophy_name} ${t.trophy_position}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateExistingTrophies();
