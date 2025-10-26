/**
 * Sync Stats Data from Firebase to Neon
 * 
 * This script migrates existing realplayerstats and teamstats data
 * from Firebase Firestore to Neon PostgreSQL Database.
 * 
 * Run: npx tsx scripts/sync-firebase-to-neon.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getTournamentDb } from '../lib/neon/tournament-config';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(process.cwd(), 'firebase-service-account.json'));

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);
const sql = getTournamentDb();

interface PlayerStats {
  id: string;
  player_id: string;
  season_id: string;
  player_name: string;
  team?: string;
  team_id?: string;
  category?: string;
  matches_played: number;
  goals_scored: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets?: number;
  motm_awards: number;
  points: number;
  star_rating?: number;
}

interface TeamStats {
  id: string;
  team_id: string;
  season_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  position?: number;
}

async function syncPlayerStats(seasonId?: string) {
  console.log('\n📊 Syncing Player Stats to Neon...\n');
  
  try {
    // Query Firebase
    let query = db.collection('realplayerstats');
    if (seasonId) {
      query = query.where('season_id', '==', seasonId) as any;
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('⚠️  No player stats found in Firebase');
      return { synced: 0, errors: 0 };
    }
    
    console.log(`Found ${snapshot.size} player stats records\n`);
    
    let synced = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        const stats: PlayerStats = {
          id: doc.id,
          player_id: data.player_id,
          season_id: data.season_id,
          player_name: data.player_name,
          team: data.team || null,
          team_id: data.team_id || null,
          category: data.category || null,
          matches_played: data.matches_played || 0,
          goals_scored: data.goals_scored || 0,
          assists: data.assists || 0,
          wins: data.wins || 0,
          draws: data.draws || 0,
          losses: data.losses || 0,
          clean_sheets: data.clean_sheets || 0,
          motm_awards: data.motm_awards || 0,
          points: data.points || 0,
          star_rating: data.star_rating || 3
        };
        
        // Upsert to Neon
        await sql`
          INSERT INTO realplayerstats (
            id, player_id, season_id, player_name, team, team_id, category,
            matches_played, goals_scored, assists, wins, draws, losses,
            clean_sheets, motm_awards, points, star_rating, created_at, updated_at
          )
          VALUES (
            ${stats.id}, ${stats.player_id}, ${stats.season_id}, ${stats.player_name},
            ${stats.team}, ${stats.team_id}, ${stats.category},
            ${stats.matches_played}, ${stats.goals_scored}, ${stats.assists},
            ${stats.wins}, ${stats.draws}, ${stats.losses},
            ${stats.clean_sheets}, ${stats.motm_awards}, ${stats.points},
            ${stats.star_rating}, NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE
          SET
            player_name = EXCLUDED.player_name,
            team = EXCLUDED.team,
            team_id = EXCLUDED.team_id,
            category = EXCLUDED.category,
            matches_played = EXCLUDED.matches_played,
            goals_scored = EXCLUDED.goals_scored,
            assists = EXCLUDED.assists,
            wins = EXCLUDED.wins,
            draws = EXCLUDED.draws,
            losses = EXCLUDED.losses,
            clean_sheets = EXCLUDED.clean_sheets,
            motm_awards = EXCLUDED.motm_awards,
            points = EXCLUDED.points,
            star_rating = EXCLUDED.star_rating,
            updated_at = NOW()
        `;
        
        synced++;
        
        if (synced % 10 === 0) {
          process.stdout.write(`\rSynced ${synced}/${snapshot.size} player stats...`);
        }
        
      } catch (error) {
        console.error(`\n❌ Error syncing player ${doc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`\n✅ Player Stats: ${synced} synced, ${errors} errors\n`);
    return { synced, errors };
    
  } catch (error) {
    console.error('Error syncing player stats:', error);
    throw error;
  }
}

async function syncTeamStats(seasonId?: string) {
  console.log('🏆 Syncing Team Stats to Neon...\n');
  
  try {
    // Query Firebase
    let query = db.collection('teamstats');
    if (seasonId) {
      query = query.where('season_id', '==', seasonId) as any;
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('⚠️  No team stats found in Firebase');
      return { synced: 0, errors: 0 };
    }
    
    console.log(`Found ${snapshot.size} team stats records\n`);
    
    let synced = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      try {
        const stats: TeamStats = {
          id: doc.id,
          team_id: data.team_id,
          season_id: data.season_id,
          team_name: data.team_name,
          matches_played: data.matches_played || 0,
          wins: data.wins || 0,
          draws: data.draws || 0,
          losses: data.losses || 0,
          goals_for: data.goals_for || 0,
          goals_against: data.goals_against || 0,
          goal_difference: data.goal_difference || 0,
          points: data.points || 0,
          position: data.position || null
        };
        
        // Upsert to Neon
        await sql`
          INSERT INTO teamstats (
            id, team_id, season_id, team_name,
            matches_played, wins, draws, losses,
            goals_for, goals_against, goal_difference, points, position,
            created_at, updated_at
          )
          VALUES (
            ${stats.id}, ${stats.team_id}, ${stats.season_id}, ${stats.team_name},
            ${stats.matches_played}, ${stats.wins}, ${stats.draws}, ${stats.losses},
            ${stats.goals_for}, ${stats.goals_against}, ${stats.goal_difference},
            ${stats.points}, ${stats.position}, NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE
          SET
            team_name = EXCLUDED.team_name,
            matches_played = EXCLUDED.matches_played,
            wins = EXCLUDED.wins,
            draws = EXCLUDED.draws,
            losses = EXCLUDED.losses,
            goals_for = EXCLUDED.goals_for,
            goals_against = EXCLUDED.goals_against,
            goal_difference = EXCLUDED.goal_difference,
            points = EXCLUDED.points,
            position = EXCLUDED.position,
            updated_at = NOW()
        `;
        
        synced++;
        process.stdout.write(`\rSynced ${synced}/${snapshot.size} team stats...`);
        
      } catch (error) {
        console.error(`\n❌ Error syncing team ${doc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`\n✅ Team Stats: ${synced} synced, ${errors} errors\n`);
    return { synced, errors };
    
  } catch (error) {
    console.error('Error syncing team stats:', error);
    throw error;
  }
}

async function main() {
  console.log('🔄 Firebase to Neon Stats Sync');
  console.log('='.repeat(80));
  
  // Get season ID from command line args (optional)
  const seasonId = process.argv[2];
  
  if (seasonId) {
    console.log(`\n📅 Syncing data for season: ${seasonId}\n`);
  } else {
    console.log('\n📅 Syncing ALL seasons\n');
    console.log('⚠️  To sync specific season: npx tsx scripts/sync-firebase-to-neon.ts SEASON_ID\n');
  }
  
  try {
    // Sync player stats
    const playerResult = await syncPlayerStats(seasonId);
    
    // Sync team stats
    const teamResult = await syncTeamStats(seasonId);
    
    // Summary
    console.log('='.repeat(80));
    console.log('\n📊 Sync Complete!\n');
    console.log(`Player Stats: ${playerResult.synced} synced, ${playerResult.errors} errors`);
    console.log(`Team Stats: ${teamResult.synced} synced, ${teamResult.errors} errors`);
    console.log(`Total: ${playerResult.synced + teamResult.synced} records synced\n`);
    
    if (playerResult.errors + teamResult.errors > 0) {
      console.log('⚠️  Some errors occurred. Check the logs above.\n');
      process.exit(1);
    } else {
      console.log('✅ All data synced successfully!\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
