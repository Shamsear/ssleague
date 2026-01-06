require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTeamChanges() {
    const sql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Checking for supported team changes...\n');

    try {
        const changes = await sql`
      SELECT * FROM supported_team_changes 
      ORDER BY changed_at DESC
    `;

        if (changes.length === 0) {
            console.log('❌ No team changes found in supported_team_changes table');
        } else {
            console.log(`✅ Found ${changes.length} team change(s):\n`);
            changes.forEach((change, index) => {
                console.log(`${index + 1}. ${change.team_id}`);
                console.log(`   Old Team: ${change.old_supported_team_name || 'None'}`);
                console.log(`   New Team: ${change.new_supported_team_name}`);
                console.log(`   Window: ${change.window_id}`);
                console.log(`   Changed At: ${change.changed_at}`);
                console.log(`   Reason: ${change.reason || 'N/A'}`);
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkTeamChanges();
