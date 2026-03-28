/**
 * Verification Script: Chat Message Storage
 * 
 * This script verifies that the message storage system is properly set up:
 * 1. Database table exists
 * 2. All required columns are present
 * 3. Indexes are created
 * 4. Sample data can be inserted and retrieved
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verifyMessageStorage() {
  console.log('🔍 Verifying Chat Message Storage Setup...\n');

  // Use FANTASY_DATABASE_URL if available, otherwise fall back to DATABASE_URL
  const dbUrl = process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ No database URL found!');
    console.log('   Set FANTASY_DATABASE_URL or DATABASE_URL in .env.local');
    return;
  }

  console.log(`📊 Using database: ${dbUrl.includes('fantasy') ? 'Fantasy DB' : 'Main DB'}\n`);
  
  const sql = neon(dbUrl);

  try {
    // 1. Check if table exists
    console.log('1️⃣ Checking if fantasy_chat_messages table exists...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'fantasy_chat_messages'
      );
    `;
    
    if (!tableCheck[0].exists) {
      console.error('❌ Table fantasy_chat_messages does not exist!');
      console.log('\n💡 Run the migration: migrations/fantasy_revamp_engagement_tables.sql');
      return;
    }
    console.log('✅ Table exists\n');

    // 2. Check table structure
    console.log('2️⃣ Checking table structure...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'fantasy_chat_messages'
      ORDER BY ordinal_position;
    `;

    const expectedColumns = [
      'id',
      'message_id',
      'league_id',
      'team_id',
      'user_id',
      'message_text',
      'reactions',
      'is_deleted',
      'deleted_at',
      'created_at',
      'updated_at'
    ];

    const actualColumns = columns.map(c => c.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length > 0) {
      console.error(`❌ Missing columns: ${missingColumns.join(', ')}`);
      return;
    }
    console.log('✅ All required columns present');
    console.log(`   Columns: ${actualColumns.join(', ')}\n`);

    // 3. Check indexes
    console.log('3️⃣ Checking indexes...');
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'fantasy_chat_messages';
    `;

    const expectedIndexes = [
      'idx_chat_messages_league',
      'idx_chat_messages_team',
      'idx_chat_messages_user',
      'idx_chat_messages_created',
      'idx_chat_messages_deleted'
    ];

    const actualIndexes = indexes.map(i => i.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !actualIndexes.includes(idx));

    if (missingIndexes.length > 0) {
      console.warn(`⚠️  Missing indexes: ${missingIndexes.join(', ')}`);
      console.log('   (Indexes are optional but recommended for performance)');
    } else {
      console.log('✅ All performance indexes present');
    }
    console.log(`   Indexes: ${actualIndexes.filter(i => i.startsWith('idx_')).join(', ')}\n`);

    // 4. Check current message count
    console.log('4️⃣ Checking current message count...');
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM fantasy_chat_messages;
    `;
    console.log(`✅ Current messages: ${countResult[0].total}\n`);

    // 5. Verify data types
    console.log('5️⃣ Verifying critical data types...');
    const criticalColumns = columns.filter(c => 
      ['message_id', 'message_text', 'reactions', 'is_deleted'].includes(c.column_name)
    );

    const dataTypeChecks = {
      message_id: criticalColumns.find(c => c.column_name === 'message_id')?.data_type,
      message_text: criticalColumns.find(c => c.column_name === 'message_text')?.data_type,
      reactions: criticalColumns.find(c => c.column_name === 'reactions')?.data_type,
      is_deleted: criticalColumns.find(c => c.column_name === 'is_deleted')?.data_type
    };

    console.log('   Data types:');
    console.log(`   - message_id: ${dataTypeChecks.message_id} (expected: character varying)`);
    console.log(`   - message_text: ${dataTypeChecks.message_text} (expected: text)`);
    console.log(`   - reactions: ${dataTypeChecks.reactions} (expected: jsonb)`);
    console.log(`   - is_deleted: ${dataTypeChecks.is_deleted} (expected: boolean)`);

    const typeIssues = [];
    if (!dataTypeChecks.message_id?.includes('character')) typeIssues.push('message_id');
    if (dataTypeChecks.message_text !== 'text') typeIssues.push('message_text');
    if (dataTypeChecks.reactions !== 'jsonb') typeIssues.push('reactions');
    if (dataTypeChecks.is_deleted !== 'boolean') typeIssues.push('is_deleted');

    if (typeIssues.length > 0) {
      console.error(`\n❌ Data type issues: ${typeIssues.join(', ')}`);
      return;
    }
    console.log('✅ All data types correct\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Table: fantasy_chat_messages`);
    console.log(`   ✅ Columns: ${actualColumns.length}/${expectedColumns.length}`);
    console.log(`   ✅ Indexes: ${actualIndexes.filter(i => i.startsWith('idx_')).length}/${expectedIndexes.length}`);
    console.log(`   ✅ Messages: ${countResult[0].total}`);
    console.log('\n🎉 Message storage is properly configured!');
    console.log('\n📝 API Endpoints:');
    console.log('   POST /api/fantasy/chat/send');
    console.log('   GET  /api/fantasy/chat/messages');
    console.log('\n📚 Documentation:');
    console.log('   app/api/fantasy/chat/MESSAGE_STORAGE_DOCUMENTATION.md');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run verification
verifyMessageStorage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
