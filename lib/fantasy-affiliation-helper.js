/**
 * Helper function to record a fantasy team's supported team change
 * This should be called whenever a team changes their affiliation during a transfer window
 * 
 * @param {Object} params - The change parameters
 * @param {string} params.league_id - The fantasy league ID
 * @param {string} params.team_id - The fantasy team ID
 * @param {string} params.new_supported_team_id - The new supported team ID
 * @param {string} params.new_supported_team_name - The new supported team name
 * @param {number} params.effective_from_round - The round number when this change takes effect
 * @param {string} params.notes - Optional notes about the change
 * @param {Function} sql - The neon SQL function
 */
async function recordSupportedTeamChange(params, sql) {
    const {
        league_id,
        team_id,
        new_supported_team_id,
        new_supported_team_name,
        effective_from_round,
        notes = 'Supported team changed during transfer window'
    } = params;

    try {
        // Step 1: Close the current affiliation record (set effective_to_round)
        const currentAffiliation = await sql`
      SELECT id, supported_team_id, supported_team_name, effective_from_round
      FROM fantasy_team_affiliation_history
      WHERE team_id = ${team_id}
        AND league_id = ${league_id}
        AND effective_to_round IS NULL
      ORDER BY effective_from_round DESC
      LIMIT 1
    `;

        if (currentAffiliation.length > 0) {
            const current = currentAffiliation[0];

            // Only close if the team is actually changing
            if (current.supported_team_id !== new_supported_team_id) {
                // Close the current record at the round before the new one takes effect
                await sql`
          UPDATE fantasy_team_affiliation_history
          SET effective_to_round = ${effective_from_round - 1}
          WHERE id = ${current.id}
        `;

                console.log(`✅ Closed previous affiliation: ${current.supported_team_name} (rounds ${current.effective_from_round}-${effective_from_round - 1})`);
            } else {
                console.log(`ℹ️  Team is already supporting ${new_supported_team_name}, no change needed`);
                return;
            }
        }

        // Step 2: Create new affiliation record
        await sql`
      INSERT INTO fantasy_team_affiliation_history (
        league_id,
        team_id,
        supported_team_id,
        supported_team_name,
        effective_from_round,
        effective_to_round,
        notes
      ) VALUES (
        ${league_id},
        ${team_id},
        ${new_supported_team_id},
        ${new_supported_team_name},
        ${effective_from_round},
        NULL,
        ${notes}
      )
    `;

        console.log(`✅ New affiliation recorded: ${new_supported_team_name} (from round ${effective_from_round})`);

        // Step 3: Update the current supported team in fantasy_teams table
        await sql`
      UPDATE fantasy_teams
      SET 
        supported_team_id = ${new_supported_team_id},
        supported_team_name = ${new_supported_team_name},
        updated_at = NOW()
      WHERE team_id = ${team_id}
        AND league_id = ${league_id}
    `;

        console.log(`✅ Updated fantasy_teams table with new affiliation`);

        return {
            success: true,
            message: `Successfully changed supported team to ${new_supported_team_name}`
        };

    } catch (error) {
        console.error('❌ Error recording supported team change:', error);
        throw error;
    }
}

/**
 * Get the supported team for a fantasy team at a specific round
 * This is used during point recalculation to get the correct affiliation
 * 
 * @param {string} team_id - The fantasy team ID
 * @param {string} league_id - The fantasy league ID
 * @param {number} round_number - The round number to check
 * @param {Function} sql - The neon SQL function
 * @returns {Object|null} The affiliation data or null if no affiliation
 */
async function getSupportedTeamAtRound(team_id, league_id, round_number, sql) {
    const result = await sql`
    SELECT 
      supported_team_id,
      supported_team_name,
      effective_from_round,
      effective_to_round
    FROM fantasy_team_affiliation_history
    WHERE team_id = ${team_id}
      AND league_id = ${league_id}
      AND effective_from_round <= ${round_number}
      AND (effective_to_round IS NULL OR effective_to_round >= ${round_number})
    ORDER BY effective_from_round DESC
    LIMIT 1
  `;

    return result.length > 0 ? result[0] : null;
}

/**
 * Get the complete affiliation history for a fantasy team
 * 
 * @param {string} team_id - The fantasy team ID
 * @param {string} league_id - The fantasy league ID
 * @param {Function} sql - The neon SQL function
 * @returns {Array} Array of affiliation records
 */
async function getAffiliationHistory(team_id, league_id, sql) {
    return await sql`
    SELECT 
      id,
      supported_team_id,
      supported_team_name,
      effective_from_round,
      effective_to_round,
      changed_at,
      notes
    FROM fantasy_team_affiliation_history
    WHERE team_id = ${team_id}
      AND league_id = ${league_id}
    ORDER BY effective_from_round ASC
  `;
}

module.exports = {
    recordSupportedTeamChange,
    getSupportedTeamAtRound,
    getAffiliationHistory
};
