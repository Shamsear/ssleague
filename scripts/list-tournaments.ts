import { getTournamentDb } from '../lib/neon/tournament-config';

async function listTournaments() {
    const sql = getTournamentDb();

    try {
        const tournaments = await sql`
      SELECT id, tournament_name, status, season_id
      FROM tournaments
      ORDER BY tournament_name
    `;

        console.log('\n📋 All Tournaments:\n');
        tournaments.forEach(t => {
            console.log(`  ID: ${t.id}`);
            console.log(`  Name: ${t.tournament_name}`);
            console.log(`  Status: ${t.status}`);
            console.log(`  Season: ${t.season_id}`);
            console.log('');
        });

        console.log(`Total: ${tournaments.length} tournaments\n`);
    } catch (error) {
        console.error('Error:', error);
    }
}

listTournaments();
