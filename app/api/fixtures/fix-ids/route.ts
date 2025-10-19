import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const sql = neon(process.env.NEON_DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting fixture ID migration...');
    
    // Get all team_seasons from Firebase to build a mapping
    const teamSeasonsSnapshot = await getDocs(collection(db, 'team_seasons'));
    const teamMapping = new Map<string, { teamId: string, teamName: string, seasonId: string }>();
    
    teamSeasonsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Create a key from team name and season
      const key = `${data.team_name}_${data.season_id}`;
      teamMapping.set(key, {
        teamId: data.team_id,
        teamName: data.team_name,
        seasonId: data.season_id
      });
    });
    
    console.log('📊 Found', teamMapping.size, 'team-season mappings');
    
    // Get all fixtures from Neon
    const fixtures = await sql`SELECT * FROM fixtures`;
    console.log('📊 Found', fixtures.length, 'fixtures in Neon');
    
    let updated = 0;
    let failed = 0;
    
    for (const fixture of fixtures) {
      try {
        // Try to find correct IDs based on team names
        const homeKey = `${fixture.home_team_name}_${fixture.season_id}`;
        const awayKey = `${fixture.away_team_name}_${fixture.season_id}`;
        
        const homeMapping = teamMapping.get(homeKey);
        const awayMapping = teamMapping.get(awayKey);
        
        if (!homeMapping || !awayMapping) {
          console.warn(`⚠️ Could not find mapping for fixture ${fixture.id}:`, {
            home: fixture.home_team_name,
            away: fixture.away_team_name,
            season: fixture.season_id
          });
          failed++;
          continue;
        }
        
        // Update the fixture with correct team IDs from Firebase
        await sql`
          UPDATE fixtures
          SET 
            home_team_id = ${homeMapping.teamId},
            away_team_id = ${awayMapping.teamId},
            season_id = ${homeMapping.seasonId},
            updated_at = NOW()
          WHERE id = ${fixture.id}
        `;
        
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`✅ Updated ${updated} fixtures...`);
        }
      } catch (error) {
        console.error(`❌ Error updating fixture ${fixture.id}:`, error);
        failed++;
      }
    }
    
    console.log('✅ Migration complete!');
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);
    
    return NextResponse.json({ 
      success: true,
      updated,
      failed,
      total: fixtures.length
    });
  } catch (error) {
    console.error('Error fixing fixture IDs:', error);
    return NextResponse.json(
      { error: 'Failed to fix fixture IDs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
