/**
 * Check if polls tables exist and run migration if needed
 * Run with: npx tsx scripts/check-and-migrate-polls.ts
 */

import { getTournamentDb } from '../lib/neon/tournament-config';
import fs from 'fs';
import path from 'path';

async function checkAndMigrate() {
  console.log('🔍 Checking polls database tables...\n');
  
  try {
    const sql = getTournamentDb();
    
    // Check if polls table exists
    const tablesCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('polls', 'poll_votes', 'poll_results')
      ORDER BY table_name;
    `;
    
    console.log('📊 Found tables:');
    if (tablesCheck.length === 0) {
      console.log('   ❌ No polls tables found\n');
    } else {
      tablesCheck.forEach((row: any) => {
        console.log(`   ✅ ${row.table_name}`);
      });
      console.log('');
    }
    
    // Check if news table has bilingual columns
    const newsColumnsCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'news' 
        AND column_name IN ('language', 'tone', 'reporter_name', 'has_poll', 'poll_id', 'title_en', 'title_ml')
      ORDER BY column_name;
    `;
    
    console.log('📰 News table bilingual columns:');
    if (newsColumnsCheck.length === 0) {
      console.log('   ❌ No bilingual columns found in news table\n');
    } else {
      newsColumnsCheck.forEach((row: any) => {
        console.log(`   ✅ ${row.column_name}`);
      });
      console.log('');
    }
    
    // Determine if migration is needed
    const needsMigration = tablesCheck.length < 3 || newsColumnsCheck.length < 5;
    
    if (!needsMigration) {
      console.log('✅ All tables and columns exist! Database is ready.\n');
      return;
    }
    
    console.log('⚠️  Migration needed!\n');
    console.log('Missing:');
    if (tablesCheck.length < 3) {
      const existing = tablesCheck.map((r: any) => r.table_name);
      const required = ['polls', 'poll_votes', 'poll_results'];
      const missing = required.filter(t => !existing.includes(t));
      console.log(`   • Tables: ${missing.join(', ')}`);
    }
    if (newsColumnsCheck.length < 5) {
      const existing = newsColumnsCheck.map((r: any) => r.column_name);
      const required = ['language', 'tone', 'reporter_name', 'has_poll', 'poll_id'];
      const missing = required.filter(c => !existing.includes(c));
      console.log(`   • News columns: ${missing.join(', ')}`);
    }
    console.log('');
    
    // Ask if user wants to run migration
    console.log('📝 To run the migration, execute:');
    console.log('   npx tsx scripts/run-polls-migration.ts\n');
    console.log('Or manually run:');
    console.log('   database/migrations/create-polls-system.sql\n');
    
  } catch (error: any) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  }
}

checkAndMigrate();
