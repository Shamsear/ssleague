/**
 * Verify 3-Database Setup
 * Tests all connections and table structures
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const auctionSql = neon(process.env.NEON_AUCTION_DB_URL!);
const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function verify() {
  console.log('🔍 Verifying 3-Database Architecture Setup\n');
  console.log('='.repeat(80) + '\n');
  
  let allPassed = true;
  
  try {
    // 1. Check Environment Variables
    console.log('1️⃣ Checking Environment Variables...\n');
    
    const checks = [
      { name: 'NEON_AUCTION_DB_URL', value: process.env.NEON_AUCTION_DB_URL },
      { name: 'NEON_TOURNAMENT_DB_URL', value: process.env.NEON_TOURNAMENT_DB_URL },
      { name: 'FIREBASE_ADMIN_PROJECT_ID', value: process.env.FIREBASE_ADMIN_PROJECT_ID },
    ];
    
    checks.forEach(check => {
      if (check.value) {
        console.log(`   ✅ ${check.name}: SET`);
      } else {
        console.log(`   ❌ ${check.name}: NOT SET`);
        allPassed = false;
      }
    });
    
    console.log('');
    
    // 2. Test Auction DB Connection
    console.log('2️⃣ Testing Auction Database Connection...\n');
    
    const auctionTables = await auctionSql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log(`   ✅ Connected! Found ${auctionTables.length} tables\n`);
    
    const expectedAuctionTables = [
      'auction_settings',
      'bids',
      'bulk_tiebreaker_bids',
      'bulk_tiebreaker_teams',
      'bulk_tiebreakers',
      'footballplayers',
      'round_bids',
      'round_players',
      'rounds',
      'starred_players',
      'team_tiebreakers',
      'tiebreakers'
    ];
    
    console.log('   Auction Tables:');
    expectedAuctionTables.forEach(tableName => {
      const exists = auctionTables.find(t => t.table_name === tableName);
      if (exists) {
        console.log(`      ✅ ${tableName}`);
      } else {
        console.log(`      ❌ ${tableName} (MISSING)`);
        allPassed = false;
      }
    });
    
    console.log('');
    
    // 3. Test Tournament DB Connection
    console.log('3️⃣ Testing Tournament Database Connection...\n');
    
    const tournamentTables = await tournamentSql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log(`   ✅ Connected! Found ${tournamentTables.length} tables\n`);
    
    const expectedTournamentTables = [
      'tournament_settings',
      'fixtures',
      'matches',
      'match_days',
      'matchups',
      'fixture_audit_log',
      'realplayerstats',
      'teamstats',
      'team_players',
      'leaderboards'
    ];
    
    console.log('   Tournament Tables:');
    expectedTournamentTables.forEach(tableName => {
      const exists = tournamentTables.find(t => t.table_name === tableName);
      if (exists) {
        console.log(`      ✅ ${tableName}`);
      } else {
        console.log(`      ❌ ${tableName} (MISSING)`);
        allPassed = false;
      }
    });
    
    console.log('');
    
    // 4. Verify No Cross-Contamination
    console.log('4️⃣ Verifying Database Separation...\n');
    
    const tournamentTablesInAuction = auctionTables.filter(t => 
      expectedTournamentTables.includes(t.table_name)
    );
    
    if (tournamentTablesInAuction.length === 0) {
      console.log('   ✅ Auction DB has no tournament tables');
    } else {
      console.log(`   ❌ Auction DB has ${tournamentTablesInAuction.length} tournament tables:`);
      tournamentTablesInAuction.forEach(t => console.log(`      - ${t.table_name}`));
      allPassed = false;
    }
    
    const auctionTablesInTournament = tournamentTables.filter(t => 
      expectedAuctionTables.includes(t.table_name)
    );
    
    if (auctionTablesInTournament.length === 0) {
      console.log('   ✅ Tournament DB has no auction tables');
    } else {
      console.log(`   ❌ Tournament DB has ${auctionTablesInTournament.length} auction tables:`);
      auctionTablesInTournament.forEach(t => console.log(`      - ${t.table_name}`));
      allPassed = false;
    }
    
    console.log('');
    
    // 5. Test Basic Queries
    console.log('5️⃣ Testing Basic Query Operations...\n');
    
    try {
      await auctionSql`SELECT COUNT(*) FROM footballplayers`;
      console.log('   ✅ Auction DB: Can query footballplayers');
    } catch (error) {
      console.log(`   ❌ Auction DB: Query failed - ${error.message}`);
      allPassed = false;
    }
    
    try {
      await tournamentSql`SELECT COUNT(*) FROM fixtures`;
      console.log('   ✅ Tournament DB: Can query fixtures');
    } catch (error) {
      console.log(`   ❌ Tournament DB: Query failed - ${error.message}`);
      allPassed = false;
    }
    
    try {
      await tournamentSql`SELECT COUNT(*) FROM realplayerstats`;
      console.log('   ✅ Tournament DB: Can query realplayerstats');
    } catch (error) {
      console.log(`   ❌ Tournament DB: Query failed - ${error.message}`);
      allPassed = false;
    }
    
    console.log('');
    
    // Summary
    console.log('='.repeat(80));
    console.log('');
    
    if (allPassed) {
      console.log('✅ ALL CHECKS PASSED!');
      console.log('');
      console.log('🎉 Your 3-database architecture is ready to use!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Create API routes for auction operations');
      console.log('2. Create API routes for tournament operations');
      console.log('3. Update frontend to use new APIs');
      console.log('4. Add React Query caching');
    } else {
      console.log('❌ SOME CHECKS FAILED');
      console.log('');
      console.log('Please review the errors above and fix them.');
    }
    
    console.log('');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verify();
