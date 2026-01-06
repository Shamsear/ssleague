const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function listTeams() {
    const SEASON_ID = 'SSPSLS16';

    console.log(`📋 Listing all teams in season ${SEASON_ID}...\n`);

    try {
        const teamSeasonsSnapshot = await db
            .collection('team_seasons')
            .where('season_id', '==', SEASON_ID)
            .get();

        console.log(`Found ${teamSeasonsSnapshot.size} teams:\n`);

        const teams = [];
        teamSeasonsSnapshot.forEach(doc => {
            const data = doc.data();
            teams.push({
                name: data.team_name,
                id: data.team_id,
                docId: doc.id,
                budget: data.real_player_budget || 0,
                spent: data.real_player_spent || 0
            });
        });

        // Sort by name
        teams.sort((a, b) => a.name.localeCompare(b.name));

        teams.forEach((team, index) => {
            console.log(`${index + 1}. ${team.name}`);
            console.log(`   Team ID: ${team.id}`);
            console.log(`   Doc ID: ${team.docId}`);
            console.log(`   Real Player Budget: €${team.budget.toFixed(2)}`);
            console.log(`   Real Player Spent: €${team.spent.toFixed(2)}`);
            console.log('');
        });

        // Look for teams with "Masia" in the name
        console.log('='.repeat(60));
        const masiaTeams = teams.filter(t => t.name.toLowerCase().includes('masia'));
        if (masiaTeams.length > 0) {
            console.log('Teams with "Masia" in name:');
            masiaTeams.forEach(team => {
                console.log(`  - "${team.name}" (exact name for scripts)`);
            });
        } else {
            console.log('⚠️  No teams found with "Masia" in the name');
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Full error:', error.message);
        process.exit(1);
    }
}

listTeams();
