import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

async function createHistoricalTournament() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);
  
  console.log('Creating historical tournament placeholder...\n');
  
  try {
    // Check if tournaments table exists
    const tablesCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tournaments'
    `;
    
    if (tablesCheck.length === 0) {
      console.log('⚠️ tournaments table does not exist');
      return;
    }
    
    console.log('✅ tournaments table exists');
    
    // Check table structure
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tournaments'
      ORDER BY ordinal_position
    `;
    
    console.log('Table columns:', columns.map((c: any) => c.column_name).join(', '));
    
    // Check if historical tournament already exists
    const existingCheck = await sql`
      SELECT id FROM tournaments WHERE id = 'historical'
    `;
    
    if (existingCheck.length > 0) {
      console.log('✅ Historical tournament placeholder already exists');
      return;
    }
    
    // Create historical tournament placeholder with all required fields
    console.log('Creating historical tournament...');
    await sql`
      INSERT INTO tournaments (
        id, season_id, tournament_type, tournament_name, tournament_code,
        status, is_primary, display_order, include_in_fantasy,
        has_group_stage, number_of_groups, teams_per_group, teams_advancing_per_group,
        has_knockout_stage, playoff_teams, direct_semifinal_teams, qualification_threshold, is_pure_knockout,
        created_at, updated_at
      )
      VALUES (
        'historical', 'historical', 'league', 'Historical Data', 'HIST',
        'completed', false, 0, true,
        false, 0, 0, 0,
        false, 0, 0, 0, false,
        NOW(), NOW()
      )
    `;
    
    console.log('✅ Historical tournament placeholder created successfully');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createHistoricalTournament().catch(console.error);
