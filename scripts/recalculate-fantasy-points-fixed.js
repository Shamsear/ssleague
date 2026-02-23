require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const db = neon(process.env.FANTASY_DATABASE_URL);

async function recalculateFantasyPoints() {
  console.log('Starting fantasy points recalculation...\n');

  try {
    // Get all fantasy teams
    const teams = await db`
      SELECT team_id, team_name, league_id 
      FROM fantasy_teams 
      ORDER BY team_name
    `;
    
    console.log(`Found ${teams.length} fantasy teams\n`);

    // Get all transfers with their actual dates
    const allTransfers = await db`
      SELECT 
        t.transfer_id,
        t.team_id,
        t.player_out_id,
        t.player_in_id,
        t.transferred_at,
        t.window_id,
        tw.opens_at,
        tw.closes_at
      FROM fantasy_transfers t
      LEFT JOIN transfer_windows tw ON t.window_id = tw.window_id
      ORDER BY t.transferred_at ASC
    `;
    
    console.log(`Found ${allTransfers.length} total transfers\n`);

    // Get all fixtures with their dates and tournament info
    const allFixtures = await db`
      SELECT 
        f.fixture_id,
        f.tournament_id,
        f.round_number,
        f.fixture_date,
        f.home_team_id,
        f.away_team_id
      FROM fixtures f
      WHERE f.fixture_date IS NOT NULL
      ORDER BY f.fixture_date ASC, f.tournament_id, f.round_number
    `;
    
    console.log(`Found ${allFixtures.length} fixtures\n`);

    // Get all player stats
    const allPlayerStats = await db`
      SELECT 
        rp.round_player_id,
        rp.player_id,
        rp.round_id,
        rp.fantasy_points,
        r.fixture_id,
        f.fixture_date,
        f.tournament_id,
        f.round_number
      FROM round_players rp
      JOIN rounds r ON rp.round_id = r.round_id
      JOIN fixtures f ON r.fixture_id = f.fixture_id
      WHERE rp.fantasy_points IS NOT NULL 
        AND rp.fantasy_points > 0
      ORDER BY f.fixture_date ASC
    `;
    
    console.log(`Found ${allPlayerStats.length} player stat records\n`);

    // Process each team
    for (const team of teams) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Processing: ${team.team_name} (${team.team_id})`);
      console.log('='.repeat(80));

      // Get initial squad
      const initialSquad = await db`
        SELECT player_id, real_player_name
        FROM fantasy_team_players
        WHERE team_id = ${team.team_id}
        ORDER BY real_player_name
      `;

      console.log(`\nInitial squad (${initialSquad.length} players):`);
      initialSquad.forEach(p => console.log(`  - ${p.real_player_name} (${p.player_id})`));

      // Get transfers for this team
      const teamTransfers = allTransfers.filter(t => t.team_id === team.team_id);
      console.log(`\nTransfers: ${teamTransfers.length}`);
      teamTransfers.forEach(t => {
        console.log(`  ${new Date(t.transferred_at).toISOString()} - Out: ${t.player_out_id}, In: ${t.player_in_id}`);
      });

      // Build ownership timeline
      let currentSquad = new Set(initialSquad.map(p => p.player_id));
      
      // Calculate points for each fixture
      let totalPoints = 0;
      let roundPoints = {};
      let fixtureDetails = [];

      for (const fixture of allFixtures) {
        const fixtureDate = new Date(fixture.fixture_date);
        
        // Apply transfers that happened before this fixture
        for (const transfer of teamTransfers) {
          const transferDate = new Date(transfer.transferred_at);
          if (transferDate < fixtureDate && !transfer.applied) {
            currentSquad.delete(transfer.player_out_id);
            currentSquad.add(transfer.player_in_id);
            transfer.applied = true;
          }
        }

        // Get player stats for this fixture
        const fixtureStats = allPlayerStats.filter(
          ps => ps.fixture_id === fixture.fixture_id
        );

        // Calculate points from owned players only
        let fixturePoints = 0;
        let scoringPlayers = [];

        for (const stat of fixtureStats) {
          if (currentSquad.has(stat.player_id)) {
            fixturePoints += stat.fantasy_points;
            scoringPlayers.push({
              player_id: stat.player_id,
              points: stat.fantasy_points
            });
          }
        }

        if (fixturePoints > 0) {
          totalPoints += fixturePoints;
          
          const roundKey = `${fixture.tournament_id}_R${fixture.round_number}`;
          roundPoints[roundKey] = (roundPoints[roundKey] || 0) + fixturePoints;

          fixtureDetails.push({
            fixture_id: fixture.fixture_id,
            tournament: fixture.tournament_id,
            round: fixture.round_number,
            date: fixtureDate.toISOString().split('T')[0],
            points: fixturePoints,
            players: scoringPlayers.length
          });
        }
      }

      // Display results
      console.log(`\n--- POINTS SUMMARY ---`);
      console.log(`Total Points: ${totalPoints}`);
      
      console.log(`\nPoints by Round:`);
      Object.entries(roundPoints)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([round, points]) => {
          console.log(`  ${round}: ${points}`);
        });

      if (fixtureDetails.length > 0) {
        console.log(`\nTop 5 Scoring Fixtures:`);
        fixtureDetails
          .sort((a, b) => b.points - a.points)
          .slice(0, 5)
          .forEach(f => {
            console.log(`  ${f.date} | ${f.tournament} R${f.round} | ${f.points} pts (${f.players} players)`);
          });
      }

      // Update database
      console.log(`\nUpdating database...`);
      await db`
        UPDATE fantasy_teams 
        SET total_points = ${totalPoints}
        WHERE team_id = ${team.team_id}
      `;
      console.log(`✓ Updated total_points to ${totalPoints}`);

      // Reset applied flag for next team
      teamTransfers.forEach(t => delete t.applied);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✓ Recalculation complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error during recalculation:', error);
    throw error;
  }
}

// Run the script
recalculateFantasyPoints()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
