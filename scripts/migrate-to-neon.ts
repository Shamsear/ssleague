/**
 * Migration Script: Firestore to Neon
 * 
 * This script migrates footballplayers from Firestore to Neon PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-to-neon.ts
 */

import { db } from '../lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { bulkImportPlayers, getTotalPlayerCount } from '../lib/neon/players';
import { sql } from '../lib/neon/config';

async function migrate() {
  console.log('🚀 Starting migration from Firestore to Neon...\n');

  try {
    // Step 1: Create table
    console.log('📝 Creating footballplayers table in Neon...');
    await sql`
      CREATE TABLE IF NOT EXISTS footballplayers (
        id VARCHAR(255) PRIMARY KEY,
        player_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(50),
        position_group VARCHAR(50),
        team_id VARCHAR(255),
        team_name VARCHAR(255),
        season_id VARCHAR(255),
        round_id VARCHAR(255),
        is_auction_eligible BOOLEAN DEFAULT true,
        is_sold BOOLEAN DEFAULT false,
        acquisition_value INTEGER,
        nationality VARCHAR(100),
        age INTEGER,
        club VARCHAR(255),
        playing_style VARCHAR(50),
        overall_rating INTEGER,
        offensive_awareness INTEGER,
        ball_control INTEGER,
        dribbling INTEGER,
        tight_possession INTEGER,
        low_pass INTEGER,
        lofted_pass INTEGER,
        finishing INTEGER,
        heading INTEGER,
        set_piece_taking INTEGER,
        curl INTEGER,
        speed INTEGER,
        acceleration INTEGER,
        kicking_power INTEGER,
        jumping INTEGER,
        physical_contact INTEGER,
        balance INTEGER,
        stamina INTEGER,
        defensive_awareness INTEGER,
        tackling INTEGER,
        aggression INTEGER,
        defensive_engagement INTEGER,
        gk_awareness INTEGER,
        gk_catching INTEGER,
        gk_parrying INTEGER,
        gk_reflexes INTEGER,
        gk_reach INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Table created\n');

    // Step 2: Create indexes
    console.log('📝 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_position ON footballplayers(position)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_team_id ON footballplayers(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_season_id ON footballplayers(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_auction_eligible ON footballplayers(is_auction_eligible)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_is_sold ON footballplayers(is_sold)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_round_id ON footballplayers(round_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_overall_rating ON footballplayers(overall_rating)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_name ON footballplayers(name)`;
    console.log('✅ Indexes created\n');

    // Step 3: Fetch all players from Firestore
    console.log('📥 Fetching players from Firestore...');
    const playersRef = collection(db, 'footballplayers');
    const snapshot = await getDocs(playersRef);
    console.log(`✅ Fetched ${snapshot.size} players from Firestore\n`);

    // Step 4: Transform data
    console.log('🔄 Transforming data...');
    const players = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        player_id: data.player_id || doc.id,
        name: data.name,
        position: data.position || null,
        position_group: data.position_group || null,
        team_id: data.team_id || null,
        team_name: data.team_name || null,
        season_id: data.season_id || null,
        round_id: data.round_id || null,
        is_auction_eligible: data.is_auction_eligible !== undefined ? data.is_auction_eligible : true,
        is_sold: data.is_sold || false,
        acquisition_value: data.acquisition_value || null,
        nationality: data.nationality || null,
        age: data.age || null,
        club: data.club || null,
        playing_style: data.playing_style || null,
        overall_rating: data.overall_rating || data.rating || null,
        offensive_awareness: data.offensive_awareness || null,
        ball_control: data.ball_control || null,
        dribbling: data.dribbling || null,
        tight_possession: data.tight_possession || null,
        low_pass: data.low_pass || null,
        lofted_pass: data.lofted_pass || null,
        finishing: data.finishing || null,
        heading: data.heading || null,
        set_piece_taking: data.set_piece_taking || null,
        curl: data.curl || null,
        speed: data.speed || null,
        acceleration: data.acceleration || null,
        kicking_power: data.kicking_power || null,
        jumping: data.jumping || null,
        physical_contact: data.physical_contact || null,
        balance: data.balance || null,
        stamina: data.stamina || null,
        defensive_awareness: data.defensive_awareness || null,
        tackling: data.tackling || null,
        aggression: data.aggression || null,
        defensive_engagement: data.defensive_engagement || null,
        gk_awareness: data.gk_awareness || null,
        gk_catching: data.gk_catching || null,
        gk_parrying: data.gk_parrying || null,
        gk_reflexes: data.gk_reflexes || null,
        gk_reach: data.gk_reach || null,
      };
    });
    console.log('✅ Data transformed\n');

    // Step 5: Import to Neon in batches
    console.log('📤 Importing to Neon...');
    const BATCH_SIZE = 100;
    let imported = 0;

    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      await bulkImportPlayers(batch);
      imported += batch.length;
      console.log(`  ⏳ Imported ${imported}/${players.length} players...`);
    }
    console.log('✅ All players imported\n');

    // Step 6: Verify
    console.log('🔍 Verifying migration...');
    const neonCount = await getTotalPlayerCount();
    console.log(`  Firestore: ${snapshot.size} players`);
    console.log(`  Neon: ${neonCount} players`);
    
    if (neonCount === snapshot.size) {
      console.log('✅ Migration successful! All players migrated.\n');
    } else {
      console.log('⚠️  Warning: Player counts don\'t match. Please investigate.\n');
    }

    console.log('🎉 Migration complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your application code to use Neon instead of Firestore for players');
    console.log('2. Test thoroughly');
    console.log('3. Once confirmed, you can delete footballplayers collection from Firestore');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
