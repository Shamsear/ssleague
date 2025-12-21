const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasySql = neon(process.env.FANTASY_DATABASE_URL);
const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

(async () => {
  try {
    console.log('🔄 Updating Fantasy Player Prices Based on Star Ratings\n');
    console.log('='.repeat(80));

    const leagueId = 'SSPSLFLS16';
    const seasonId = 'SSPSLS16';

    // Get league star pricing
    const leagues = await fantasySql`
      SELECT star_rating_prices
      FROM fantasy_leagues
      WHERE league_id = ${leagueId}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      console.error('❌ League not found');
      return;
    }

    const starPricing = {};
    if (leagues[0].star_rating_prices) {
      leagues[0].star_rating_prices.forEach(p => {
        starPricing[p.stars] = p.price;
      });
    } else {
      // Default pricing
      starPricing[10] = 50;
      starPricing[9] = 40;
      starPricing[8] = 30;
      starPricing[7] = 20;
      starPricing[6] = 15;
      starPricing[5] = 10;
      starPricing[4] = 8;
      starPricing[3] = 6;
      starPricing[2] = 4;
      starPricing[1] = 2;
    }

    console.log('\n📊 Star Rating Pricing:');
    Object.entries(starPricing).sort((a, b) => b[0] - a[0]).forEach(([stars, price]) => {
      console.log(`  ${stars}⭐ = €${price}M`);
    });

    // Get all players in fantasy squads
    const squadPlayers = await fantasySql`
      SELECT 
        fs.squad_id,
        fs.team_id,
        fs.real_player_id,
        fs.player_name,
        fs.purchase_price,
        fs.current_value,
        ft.team_name,
        ft.budget_remaining
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      WHERE fs.league_id = ${leagueId}
      ORDER BY ft.team_name, fs.player_name
    `;

    console.log(`\n📋 Found ${squadPlayers.length} players in squads\n`);

    // Get current star ratings from player_seasons table
    const playerIds = squadPlayers.map(p => p.real_player_id);
    
    const currentRatings = await tournamentSql`
      SELECT player_id, player_name, star_rating
      FROM player_seasons
      WHERE season_id = ${seasonId}
        AND player_id = ANY(${playerIds})
    `;

    const ratingsMap = {};
    currentRatings.forEach(p => {
      ratingsMap[p.player_id] = {
        name: p.player_name,
        stars: p.star_rating || 5
      };
    });

    // Calculate changes
    const changes = [];
    const teamBudgetChanges = {};

    squadPlayers.forEach(player => {
      const currentRating = ratingsMap[player.real_player_id];
      if (!currentRating) {
        console.log(`⚠️  Player not found in season: ${player.player_name} (${player.real_player_id})`);
        return;
      }

      const oldPrice = Number(player.purchase_price || 0);
      const newPrice = starPricing[currentRating.stars] || 10;
      const priceDiff = newPrice - oldPrice;

      if (priceDiff !== 0) {
        changes.push({
          squad_id: player.squad_id,
          team_id: player.team_id,
          team_name: player.team_name,
          player_id: player.real_player_id,
          player_name: player.player_name,
          stars: currentRating.stars,
          old_price: oldPrice,
          new_price: newPrice,
          difference: priceDiff,
          budget_impact: -priceDiff, // Negative diff means budget increases
        });

        // Track budget changes per team
        if (!teamBudgetChanges[player.team_id]) {
          teamBudgetChanges[player.team_id] = {
            team_name: player.team_name,
            current_budget: Number(player.budget_remaining || 0),
            total_adjustment: 0,
            players_changed: 0,
          };
        }
        teamBudgetChanges[player.team_id].total_adjustment += -priceDiff;
        teamBudgetChanges[player.team_id].players_changed++;
      }
    });

    if (changes.length === 0) {
      console.log('✅ All player prices are up to date! No changes needed.\n');
      return;
    }

    console.log('='.repeat(80));
    console.log(`\n📊 PREVIEW: ${changes.length} players need price updates\n`);
    console.log('='.repeat(80));

    // Group by team
    const changesByTeam = {};
    changes.forEach(change => {
      if (!changesByTeam[change.team_name]) {
        changesByTeam[change.team_name] = [];
      }
      changesByTeam[change.team_name].push(change);
    });

    Object.entries(changesByTeam).forEach(([teamName, teamChanges]) => {
      console.log(`\n🏆 ${teamName}`);
      console.log('-'.repeat(80));
      
      teamChanges.forEach(change => {
        const arrow = change.difference > 0 ? '📈 UPGRADED' : '📉 DOWNGRADED';
        const color = change.difference > 0 ? '+' : '';
        console.log(`  ${arrow} ${change.player_name} (${change.stars}⭐)`);
        console.log(`    Old Price: €${change.old_price}M → New Price: €${change.new_price}M (${color}€${change.difference}M)`);
        console.log(`    Budget Impact: ${change.budget_impact > 0 ? '+' : ''}€${change.budget_impact}M`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n💰 TEAM BUDGET CHANGES\n');
    console.log('='.repeat(80));

    Object.entries(teamBudgetChanges).forEach(([teamId, data]) => {
      const newBudget = data.current_budget + data.total_adjustment;
      console.log(`\n🏆 ${data.team_name}`);
      console.log(`  Players Changed: ${data.players_changed}`);
      console.log(`  Current Budget: €${data.current_budget}M`);
      console.log(`  Adjustment: ${data.total_adjustment > 0 ? '+' : ''}€${data.total_adjustment}M`);
      console.log(`  New Budget: €${newBudget}M`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n🔄 APPLYING CHANGES TO DATABASE');
    console.log('='.repeat(80));
    console.log('\n');

    let updatedPlayers = 0;
    let updatedTeams = 0;

    // Update player prices
    for (const change of changes) {
      await fantasySql`
        UPDATE fantasy_squad
        SET 
          purchase_price = ${change.new_price},
          current_value = ${change.new_price}
        WHERE squad_id = ${change.squad_id}
      `;
      updatedPlayers++;
      console.log(`  ✅ Updated ${change.player_name} (€${change.old_price}M → €${change.new_price}M)`);
    }

    console.log('\n');

    // Update team budgets
    for (const [teamId, data] of Object.entries(teamBudgetChanges)) {
      const newBudget = data.current_budget + data.total_adjustment;
      
      await fantasySql`
        UPDATE fantasy_teams
        SET budget_remaining = ${newBudget}
        WHERE team_id = ${teamId}
      `;
      updatedTeams++;
      console.log(`  💰 Updated ${data.team_name} budget: €${data.current_budget}M → €${newBudget}M`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ UPDATE COMPLETE!\n');
    console.log('='.repeat(80));
    console.log(`  • ${updatedPlayers} player prices updated`);
    console.log(`  • ${updatedTeams} team budgets adjusted`);
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
})();
