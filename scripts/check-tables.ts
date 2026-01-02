import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function checkTables() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
    AND table_name IN ('seasons', 'teams', 'footballplayers', 'team_players')
    ORDER BY table_name
  `;

  console.log('Available tables:', tables.map((t: any) => t.table_name).join(', '));

  // Check season
  const seasons = await sql`SELECT id, name, status FROM seasons WHERE status = 'active' LIMIT 1`;
  console.log('\nActive season:', seasons[0]);

  // Check teams count
  if (seasons.length > 0) {
    const teams = await sql`SELECT COUNT(*) as count FROM teams WHERE season_id = ${seasons[0].id}`;
    console.log('Teams count:', teams[0].count);

    // Check footballplayers count
    const players = await sql`SELECT COUNT(*) as count FROM footballplayers WHERE season_id = ${seasons[0].id} AND is_sold = true`;
    console.log('Sold players count:', players[0].count);
  }
}

checkTables().catch(console.error);
