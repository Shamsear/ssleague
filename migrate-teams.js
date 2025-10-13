const admin = require('firebase-admin');

// Use the working credentials directly
const serviceAccount = {
  "type": "service_account",
  "project_id": "eaguedemo",
  "private_key_id": "f513fc9c909831791f94b8c53c0238b76d1478b6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDwj6jyeFOHPIZq\n6BoCGkomR9/9hIwnfwCpxFzHQJBcqBuzzuXoOOsDD6Jmx8cGuhBxCQUUlxFPFInd\nBJq+l2uncJzVyLzieDTkKUethBN3SK6vd+9dS0MjkMedfcmC8tWtoNlaWg9AjQ0D\niv8F3GXJlTMib8RSrUthcaGXEONfRbaa9riAmQGSrGjftsyEkqhiY3QL/GjyCl8B\nuCUc3PaqyU7Rti0/ehuKtH96aZjhqw0GpFg1Z+FE5uRXnNSKthlfLqz4ZRcCRgUx\nJqyATONMjJC5iqCE0JLjBTUfHEKgP551Nhp6l3MvzF8rUhHOeQEQZXZIz4Uz/h2L\nRp6vhwbfAgMBAAECggEADT/ETNJuu0iMmK++2vXKtrAHuKVHuNcoWLFNcNXv/YJu\nwCj5haA45VrDlYiUQB0YUblu87LcS7A0ZZ1eznd1gOvVX3rmWEzJkPVrErXvAodY\nw6ZF4ywFfxx2ughXBGTOevkcb3r9Uw9Rs6vAnviEDKWwgsmIFQuhVrUU8saF11Xa\nwmAf7tBluwUfGHi0GftV8/bfpnj0VAF83h+HkOgi9kP2hmSvTH9UzjoI/xaO8M+0\nAdv8kRUcMVid73KMqqpDFXETi+wxDTDi7HmcZ8mRzFtUr0w5V0ez2Lngc4TYIZwv\naLgp1WDHp/AHSc6Q+KqW+LBufR3O3VIPvguwlkkGHQKBgQD4MQbDEBSRq0vdV98j\nWOcRuyRa7lZSy5XT6mdbnwCeD1Q7GUT87WHr9+Eg02UhYl1H0wfyChmjZPohV9S1\nO7BfOTn9yY2XG8mTzey9570NNvOqpdnfa/s/30qdMlkjIS36XgrIE0JaYH67u1rn\ngIVR5lmaMhbA6dxfSedO+a1mdQKBgQD4IS12ocAm5LpcrcP5aGvMCapu8diHEGAg\nTqS/Y7X8ToKaWCXjrKe25G9Z5Eq3BNfoVwmyugcMzGYXtpbbho+V7VjdfxNKU1vY\nYQZzH+Lz++nkFPk6jdG7z0zcjRms0MlMFKVy/YF+Lh2SSRLynNm3XyPIsAnMeOA9\njmaJRFQVgwKBgQCZy6+YAofseIxrXb9NJRMS/reZjWV6quNuTSu9L7tvNqqIcLE6\nVlM+qP0dnUFmvZB2KIQc7TtT8Ae7z7RklddGOqz/4fzWbYatC4cvasHQxYOa9Gkd\nNMmdm92dqYxo42+dXNcrghu062S9Km07VX3H8YkGrxFAe+puNdqbKsbT3QKBgQCk\nKF8Jo02a7awV8Kg880aOAL8PE1WrVbwi46S/MlqOB+sD7dlzXSDAMTUyBYUgvEWT\nYzH5WnWblAbfHV+E8OtBx3sJXy8F90xGRTqdI7VksX819GJGyNi/JhC1wWwBF0h1\n2xryjqEDN8M8qresZvTrCjiEZ2K0Miw4zWMs4VW3vQKBgE3Bc4wl58HTpwM67cKn\nif3qBTCLjNUQcGc01hTx03d44RgFUoBX0pQJsH8rFsj5dt+f5QCePfnN/6Z7c6RD\nU4wtcILgyQIdDtsC7mfybbs6EF4fAxGYxrLPpSHHbb8lCB/uPWSjvn9rqmf3N5LS\nP5P5qFjtWSWEJ5bwVTo474Sw\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@eaguedemo.iam.gserviceaccount.com",
  "client_id": "100997191963755681958",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40eaguedemo.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

console.log('🚀 Starting team_seasons to teams migration...');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service account');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function migrateTeamSeasonsToTeams() {
  console.log('\n🚀 === MIGRATING TEAM_SEASONS TO TEAMS COLLECTION ===\n');
  
  try {
    // Get all team_seasons documents
    console.log('📋 Fetching team_seasons documents...');
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents`);
    
    if (teamSeasonsSnapshot.empty) {
      console.log('✅ No team_seasons found to migrate.');
      return;
    }
    
    // Get all existing teams to avoid duplicates
    console.log('🔍 Checking for existing teams...');
    const existingTeamsSnapshot = await db.collection('teams').get();
    const existingTeams = new Map();
    
    existingTeamsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      existingTeams.set(data.team_name, {
        docId: doc.id,
        seasons: data.seasons || [],
        performance_history: data.performance_history || {}
      });
    });
    
    console.log(`🏆 Found ${existingTeams.size} existing teams`);
    
    // Group team_seasons by team_name to consolidate multiple seasons per team
    const teamsByName = new Map();
    
    teamSeasonsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const teamName = data.team_name;
      
      if (!teamsByName.has(teamName)) {
        teamsByName.set(teamName, []);
      }
      
      teamsByName.get(teamName).push({
        docId: doc.id,
        teamId: data.team_id,
        seasonId: data.season_id,
        data: data
      });
    });
    
    console.log(`📈 Found ${teamsByName.size} unique teams across all seasons`);
    
    // Get season names for performance history
    console.log('📅 Fetching seasons data...');
    const seasonsSnapshot = await db.collection('seasons').get();
    const seasonNames = new Map();
    
    seasonsSnapshot.docs.forEach(doc => {
      seasonNames.set(doc.id, doc.data().name || 'Unknown Season');
    });
    
    let teamsCreated = 0;
    let teamsUpdated = 0;
    let processedCount = 0;
    
    console.log('\n⚙️ Processing teams...\n');
    
    // Process teams one by one to avoid batch limit issues
    for (const [teamName, seasonEntries] of teamsByName) {
      try {
        processedCount++;
        const firstEntry = seasonEntries[0];
        const firstData = firstEntry.data;
        
        // Collect all seasons this team participated in
        const allSeasons = seasonEntries.map(entry => entry.seasonId);
        const performanceHistory = {};
        
        // Build performance history from all seasons
        seasonEntries.forEach(entry => {
          const seasonId = entry.seasonId;
          const seasonName = seasonNames.get(seasonId) || 'Unknown Season';
          
          performanceHistory[seasonId] = {
            season_name: seasonName,
            players_count: entry.data.players_count || 0,
            season_stats: {
              total_goals: 0,
              total_points: 0,
              matches_played: 0
            }
          };
        });
        
        if (existingTeams.has(teamName)) {
          // Team exists, update it with any missing seasons
          const existing = existingTeams.get(teamName);
          const existingSeasons = existing.seasons;
          const newSeasons = [...new Set([...existingSeasons, ...allSeasons])];
          const updatedPerformanceHistory = {
            ...existing.performance_history,
            ...performanceHistory
          };
          
          if (newSeasons.length > existingSeasons.length) {
            const teamRef = db.collection('teams').doc(existing.docId);
            await teamRef.update({
              seasons: newSeasons,
              current_season_id: allSeasons[allSeasons.length - 1],
              total_seasons_participated: newSeasons.length,
              performance_history: updatedPerformanceHistory,
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            teamsUpdated++;
            console.log(`[${processedCount}/${teamsByName.size}] 🔄 Updated: ${teamName} (added ${newSeasons.length - existingSeasons.length} seasons)`);
          } else {
            console.log(`[${processedCount}/${teamsByName.size}] ⏭️  Skipped: ${teamName} (already up to date)`);
          }
          
        } else {
          // Team doesn't exist, create new team
          const teamDocId = firstEntry.teamId;
          
          const teamDoc = {
            id: teamDocId,
            team_name: teamName,
            owner_name: firstData.owner_name || firstData.username || '',
            
            // Login credentials
            username: firstData.username || '',
            user_id: firstData.team_id,
            role: 'team',
            
            // Season relationship
            seasons: allSeasons,
            current_season_id: allSeasons[allSeasons.length - 1],
            
            // Team metadata
            is_active: true,
            is_historical: false,
            created_at: firstData.created_at || admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            
            // Performance tracking
            total_seasons_participated: allSeasons.length,
            performance_history: performanceHistory
          };
          
          const teamRef = db.collection('teams').doc(teamDocId);
          await teamRef.set(teamDoc);
          
          teamsCreated++;
          console.log(`[${processedCount}/${teamsByName.size}] ✨ Created: ${teamName} (${allSeasons.length} seasons)`);
        }
        
      } catch (teamError) {
        console.error(`[${processedCount}/${teamsByName.size}] ❌ Error processing ${teamName}:`, teamError.message);
      }
    }
    
    console.log('\n🎉 === MIGRATION COMPLETED ===');
    console.log(`✨ Teams created: ${teamsCreated}`);
    console.log(`🔄 Teams updated: ${teamsUpdated}`);
    console.log(`📊 Total teams processed: ${teamsCreated + teamsUpdated}`);
    console.log(`⏭️  Teams skipped (already up to date): ${processedCount - teamsCreated - teamsUpdated}`);
    
    // Verify the migration
    const finalTeamsSnapshot = await db.collection('teams').get();
    console.log(`🏆 Final teams collection size: ${finalTeamsSnapshot.size}`);
    
    console.log('\n✅ Migration successful! Your teams are now unified in the teams collection.');
    console.log('🔗 Future season registrations will now also create teams in the teams collection.');
    console.log('📈 Historical imports will update existing teams instead of creating duplicates.');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
migrateTeamSeasonsToTeams();