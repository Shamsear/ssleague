require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const results = await db`
    SELECT real_player_id, player_name, states 
    FROM (
      SELECT pid as id, string_agg(coalesce(s, 'null'), ',') as states 
      FROM (
        SELECT 'sspslpsl0078' as pid, 0 as p, 'SSPSLT0020' as s UNION ALL
        SELECT 'sspslpsl0078', 1, 'SSPSLT0020' UNION ALL
        SELECT 'sspslpsl0078', 2, 'SSPSLT0020' UNION ALL
        SELECT 'sspslpsl0078', 3, 'SSPSLT0020' UNION ALL
        SELECT 'sspslpsl0078', 4, 'SSPSLT0020'
      ) t GROUP BY pid
    ) x JOIN fantasy_squad s ON x.id = s.real_player_id
  `;
    // This was just a test of a complex query idea, ignore.

    // Real check: Let's list EXACTLY all FPP records for Skill 555 and see the gaps.
    const fpp = await db`
    SELECT player_name, round_number, fixture_id, total_points 
    FROM fantasy_player_points 
    WHERE team_id = 'SSPSLT0020' 
    ORDER BY player_name, round_number
  `;
    console.log('--- ALL FPP RECORDS FOR SKILL 555 ---');
    fpp.forEach(r => console.log(`${r.player_name.padEnd(20)} | R${String(r.round_number).padEnd(2)} | ${r.fixture_id.padEnd(30)} | Pts: ${r.total_points}`));
}
debugSkill555().catch(console.error);
