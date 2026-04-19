const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function addDistefanoToRoundPlayers() {
  console.log('Adding Filippo Distefano to round_players table...\n');
  console.log('='.repeat(80));
  
  // First, check Griezmann's entry as a reference
  console.log('Checking Griezmann\'s entry in round_players...\n');
  
  const griezmannEntries = await sql`
    SELECT *
    FROM round_players
    WHERE player_id = '2817'
    AND round_id = 'SSPSLFR00004'
    LIMIT 1
  `;
  
  if (griezmannEntries.length > 0) {
    console.log('✅ Found Griezmann entry:');
    console.log(JSON.stringify(griezmannEntries[0], null, 2));
  } else {
    console.log('⚠️  No Griezmann entry found, checking structure...');
    
    // Get any entry from this round
    const anyEntry = await sql`
      SELECT *
      FROM round_players
      WHERE round_id = 'SSPSLFR00004'
      LIMIT 1
    `;
    
    if (anyEntry.length > 0) {
      console.log('Sample entry from round:');
      console.log(JSON.stringify(anyEntry[0], null, 2));
    }
  }
  
  // Get Filippo Distefano's details
  const distefano = await sql`
    SELECT id, player_id, name, position, overall_rating
    FROM footballplayers
    WHERE id = '2873'
  `;
  
  if (distefano.length === 0) {
    console.log('\n❌ Filippo Distefano not found');
    process.exit(1);
  }
  
  console.log(`\n✅ Found player: ${distefano[0].name}`);
  
  // Check if entry already exists
  const existing = await sql`
    SELECT * FROM round_players
    WHERE player_id = '2873'
    AND round_id = 'SSPSLFR00004'
  `;
  
  if (existing.length > 0) {
    console.log('\n⚠️  Entry already exists in round_players!');
    console.log(JSON.stringify(existing[0], null, 2));
    process.exit(0);
  }
  
  // Create entry based on Griezmann's structure or sample
  const referenceEntry = griezmannEntries.length > 0 ? griezmannEntries[0] : null;
  
  if (!referenceEntry) {
    console.log('\n❌ No reference entry found to copy structure from');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\nCreating round_players entry for Filippo Distefano...');
  
  try {
    await sql`
      INSERT INTO round_players (
        round_id,
        player_id,
        season_id,
        created_at,
        updated_at
      ) VALUES (
        'SSPSLFR00004',
        '2873',
        ${referenceEntry.season_id || 'SSPSLS16'},
        NOW(),
        NOW()
      )
    `;
    
    console.log('\n✅ Successfully added Filippo Distefano to round_players!');
    
    // Verify
    const verify = await sql`
      SELECT * FROM round_players
      WHERE player_id = '2873'
      AND round_id = 'SSPSLFR00004'
    `;
    
    console.log('\nVerification:');
    console.log(JSON.stringify(verify[0], null, 2));
    
  } catch (error) {
    console.error('\n❌ Error creating entry:', error);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Complete! Filippo Distefano should now appear on the round page.');
  
  process.exit(0);
}

addDistefanoToRoundPlayers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
