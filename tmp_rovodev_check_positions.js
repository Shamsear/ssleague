import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const connectionString = process.env.NEON_AUCTION_DB_URL;

async function checkActualPositions() {
  try {
    console.log('Checking actual positions in footballplayers table...');
    
    const sql = neon(connectionString);
    
    // Check what positions actually exist
    const positions = await sql`
      SELECT DISTINCT position 
      FROM footballplayers 
      WHERE position IS NOT NULL AND position != ''
      ORDER BY position
    `;
    
    console.log('Actual positions in database:');
    positions.forEach(p => console.log(`  - ${p.position}`));
    
    // Check what position_groups actually exist
    const positionGroups = await sql`
      SELECT DISTINCT position_group 
      FROM footballplayers 
      WHERE position_group IS NOT NULL AND position_group != ''
      ORDER BY position_group
    `;
    
    console.log('\nActual position_groups in database:');
    positionGroups.forEach(p => console.log(`  - ${p.position_group}`));
    
    // Sample some players to see their data
    const samplePlayers = await sql`
      SELECT name, position, position_group, team_name
      FROM footballplayers 
      LIMIT 10
    `;
    
    console.log('\nSample player data:');
    samplePlayers.forEach(p => console.log(`  ${p.name}: ${p.position} (${p.position_group}) - ${p.team_name}`));
    
  } catch (error) {
    console.error('Error checking positions:', error);
  }
}

checkActualPositions();