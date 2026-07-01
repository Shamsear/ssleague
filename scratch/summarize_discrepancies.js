const fs = require('fs');
const path = require('path');

const discrepancies = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'discrepancies.json'), 'utf8'));

console.log(`Total players with discrepancies: ${discrepancies.length}\n`);

const categories = {
  matches: [],
  goals: [],
  wl: [],
  motm: [],
  pointsOnly: []
};

discrepancies.forEach(d => {
  const hasMatchesDiff = d.diff.matches !== 0;
  const hasGoalsDiff = d.diff.goals_scored !== 0 || d.diff.goals_conceded !== 0;
  const hasWlDiff = d.diff.wins !== 0 || d.diff.draws !== 0 || d.diff.losses !== 0;
  const hasMotmDiff = d.diff.motm !== 0;
  const hasPointsDiff = d.diff.points !== 0;

  if (hasMatchesDiff) {
    categories.matches.push(d);
  } else if (hasGoalsDiff) {
    categories.goals.push(d);
  } else if (hasWlDiff) {
    categories.wl.push(d);
  } else if (hasMotmDiff) {
    categories.motm.push(d);
  } else if (hasPointsDiff) {
    categories.pointsOnly.push(d);
  }
});

console.log(`Discrepancy Breakdown:`);
console.log(`- Matches played difference: ${categories.matches.length}`);
console.log(`- Goals scored/conceded difference (matches ok): ${categories.goals.length}`);
console.log(`- Wins/draws/losses difference (matches/goals ok): ${categories.wl.length}`);
console.log(`- MOTM difference (matches/goals/wl ok): ${categories.motm.length}`);
console.log(`- Points ONLY difference (all stats ok, points mismatch): ${categories.pointsOnly.length}\n`);

console.log('=== PLAYERS WITH MATCHES/STATS DISCREPANCIES ===');
console.log('Player'.padEnd(20) + ' | DB Matches | Calc Matches | DB Goals | Calc Goals | DB Wins | Calc Wins');
console.log('-'.repeat(90));
const statsDiffPlayers = [...categories.matches, ...categories.goals, ...categories.wl].slice(0, 15);
statsDiffPlayers.forEach(d => {
  console.log(
    `${d.player_name.substring(0, 19).padEnd(20)} | ${String(d.db.matches).padEnd(10)} | ${String(d.calc.matches).padEnd(12)} | ${String(d.db.goals_scored).padEnd(8)} | ${String(d.calc.goals_scored).padEnd(10)} | ${String(d.db.wins).padEnd(7)} | ${String(d.calc.wins)}`
  );
});

console.log('\n=== PLAYERS WITH POINTS ONLY DISCREPANCIES (First 15) ===');
console.log('Player'.padEnd(20) + ' | DB Points | Calc Points | Difference');
console.log('-'.repeat(60));
categories.pointsOnly.slice(0, 15).forEach(d => {
  console.log(
    `${d.player_name.substring(0, 19).padEnd(20)} | ${String(d.db.points).padEnd(9)} | ${String(d.calc.points).padEnd(11)} | ${d.diff.points}`
  );
});
