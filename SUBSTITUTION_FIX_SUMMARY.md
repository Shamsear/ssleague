# Substitution Feature Fix Summary

## Problem
When substituting a player (e.g., Ansaf for Karthik) in the fixture lineup, the substitution was not being saved. The original player (Ansaf) was still showing after the substitution, and when saving results, the substitution data was lost.

## Root Cause
The substitution tracking fields were missing from the `matchups` table in the database. The frontend code expected these fields:
- `home_original_player_id`
- `home_original_player_name`
- `home_substituted`
- `home_sub_penalty`
- `away_original_player_id`
- `away_original_player_name`
- `away_substituted`
- `away_sub_penalty`

But they didn't exist in the database schema, so substitution data was being lost when saved.

## Solution

### 1. Database Migration
Created `migrations/add_substitution_fields_to_matchups.sql` to add 8 new columns to the `matchups` table:
- Home team substitution tracking (4 columns)
- Away team substitution tracking (4 columns)

### 2. API Update
Updated `app/api/fixtures/[fixtureId]/matchups/route.ts`:

**PUT Endpoint (Line ~350)**
- Now saves all substitution fields when updating matchups
- Previously only saved `away_player_id`, `away_player_name`, and `match_duration`
- Now also saves `home_player_id`, `home_player_name`, and all 8 substitution fields

**PATCH Endpoint (Line ~500)**
- Updated score calculation to include substitution penalties
- Home team score = player goals + away's substitution penalties + fine/violation goals
- Away team score = player goals + home's substitution penalties + fine/violation goals

### 3. Migration Execution
Ran the migration successfully using `run-substitution-fields-migration.js`:
```
✅ All 8 substitution columns added successfully!
```

## How Substitutions Work Now

1. **Making a Substitution:**
   - Team selects a player to substitute
   - Enters penalty amount (2 or 3 goals)
   - Original player info is saved in `*_original_player_*` fields
   - New player replaces them in `*_player_id` and `*_player_name` fields
   - `*_substituted` flag is set to `true`
   - `*_sub_penalty` stores the penalty goals

2. **Displaying Substitutions:**
   - Shows as: "Original Player (New Player)"
   - Example: "Ansaf (Karthik)" means Ansaf was replaced by Karthik
   - Penalty warning displayed: "+2 penalty goals awarded to opponent"

3. **Score Calculation:**
   - When results are saved, substitution penalties are automatically added
   - Home substitution penalty → added to away team's score
   - Away substitution penalty → added to home team's score
   - Combined with fine/violation goals for final score

## Testing
To test the fix:
1. Navigate to a fixture page: `http://localhost:3000/dashboard/team/fixture/[fixtureId]`
2. Click "Substitute" on any matchup
3. Select a new player and enter penalty amount
4. Click "Confirm Substitution"
5. The substitution should now save correctly
6. When entering results, the penalty goals will be included in the final score

## Files Changed
- `migrations/add_substitution_fields_to_matchups.sql` (new)
- `app/api/fixtures/[fixtureId]/matchups/route.ts` (updated PUT and PATCH endpoints)
- `run-substitution-fields-migration.js` (new, for running migration)
- `test-substitution-fix.js` (new, for testing)

## Verification
Run `node test-substitution-fix.js` to verify the database has the new fields.
