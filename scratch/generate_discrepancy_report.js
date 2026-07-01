const fs = require('fs');
const path = require('path');

function run() {
  const discrepanciesPath = path.resolve(__dirname, 'discrepancies.json');
  if (!fs.existsSync(discrepanciesPath)) {
    console.error('discrepancies.json not found');
    return;
  }

  const discrepancies = JSON.parse(fs.readFileSync(discrepanciesPath, 'utf8'));

  let report = `# Player Seasons Discrepancy Report - Season SSPSLS17\n\n`;
  report += `I have analyzed the matchups from all completed fixtures in season \`SSPSLS17\` and compared the calculated stats (matches played, goals scored, goals conceded, wins, draws, losses, clean sheets, MOTMs, and points) against the actual records in the \`player_seasons\` database table.\n\n`;
  report += `### Summary\n`;
  report += `- **Total players analyzed**: 120\n`;
  report += `- **Players with discrepancies**: ${discrepancies.length}\n\n`;

  const categories = {
    stats: [],
    pointsOnly: []
  };

  discrepancies.forEach(d => {
    const hasStatsDiff = d.diff.matches !== 0 || 
                         d.diff.goals_scored !== 0 || 
                         d.diff.goals_conceded !== 0 || 
                         d.diff.wins !== 0 || 
                         d.diff.draws !== 0 || 
                         d.diff.losses !== 0 || 
                         d.diff.clean_sheets !== 0 || 
                         d.diff.motm !== 0;

    if (hasStatsDiff) {
      categories.stats.push(d);
    } else {
      categories.pointsOnly.push(d);
    }
  });

  report += `### Breakdown\n`;
  report += `- **Players with core stats mismatch (matches/goals/wins/losses/MOTM/clean sheets)**: ${categories.stats.length}\n`;
  report += `- **Players with points-only mismatch (all stats are correct, but points have drifted)**: ${categories.pointsOnly.length}\n\n`;

  report += `## 1. Players with Core Stats Mismatch\n`;
  report += `These players have mismatches in their fundamental match statistics. This means their matches played, goals, wins, draws, or losses recorded in \`player_seasons\` do not match their actual lineups and match results.\n\n`;

  report += `| Player | Team | Matches (DB/Calc) | Goals Scored (DB/Calc) | Goals Conceded (DB/Calc) | Wins (DB/Calc) | Draws (DB/Calc) | Losses (DB/Calc) |\n`;
  report += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  categories.stats.forEach(d => {
    report += `| **${d.player_name}** | ${d.team || 'None'} | ${d.db.matches}/${d.calc.matches} | ${d.db.goals_scored}/${d.calc.goals_scored} | ${d.db.goals_conceded}/${d.calc.goals_conceded} | ${d.db.wins}/${d.calc.wins} | ${d.db.draws}/${d.calc.draws} | ${d.db.losses}/${d.calc.losses} |\n`;
  });

  report += `\n## 2. Players with Points-Only Mismatch\n`;
  report += `These players have **100% correct match stats** (matches played, goals, wins, draws, losses, clean sheets, and MOTMs all match perfectly), but their current \`points\` value in the database differs from their starting rating base points adjusted by their matchup goal differences.\n\n`;

  report += `| Player | Team | DB Points | Calculated Points | Mismatch (Calc - DB) |\n`;
  report += `| :--- | :--- | :---: | :---: | :---: |\n`;

  categories.pointsOnly.forEach(d => {
    const diffSign = d.diff.points > 0 ? '+' : '';
    report += `| **${d.player_name}** | ${d.team || 'None'} | ${d.db.points} | ${d.calc.points} | ${diffSign}${d.diff.points} |\n`;
  });

  const artifactDir = 'C:\\Users\\shams\\AppData\\Local\\Temp\\antigravity_temp_artifacts'; // Wait, let's find the correct artifact directory path!
  // Let's write it to the actual appDataDir artifact path:
  const targetDir = 'C:\\Users\\shams\\.gemini\\antigravity\\brain\\3840fb31-95d1-49ac-af3a-d0c225db0ba2';
  fs.writeFileSync(path.join(targetDir, 'player_discrepancy_report.md'), report, 'utf8');
  console.log('Generated player_discrepancy_report.md successfully');
}

run();
