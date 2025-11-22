# Requirements Document

## Introduction

This feature ensures that when a bulk round is created in the auction system, all unsold football players are automatically added to the `round_players` table. Currently, the system has logic to add auction-eligible players when creating bulk rounds, but this requirement formalizes and potentially enhances that behavior to ensure consistency and reliability.

The feature focuses on the bulk round creation flow at `/dashboard/committee/bulk-rounds`, ensuring that every bulk round is properly populated with all available players who haven't been sold yet.

## Requirements

### Requirement 1

**User Story:** As a committee member, I want all unsold players to be automatically added to a bulk round when I create it, so that I don't have to manually select players and can ensure no eligible players are missed.

#### Acceptance Criteria

1. WHEN a committee member creates a new bulk round THEN the system SHALL automatically query all football players from the `footballplayers` table WHERE `is_auction_eligible = true` AND `is_sold = false`

2. WHEN the bulk round is created THEN the system SHALL insert all eligible unsold players into the `round_players` table with the following fields:
   - `round_id` (the newly created round's ID)
   - `player_id` (from footballplayers.id)
   - `player_name` (from footballplayers.name)
   - `position` (from footballplayers.position)
   - `position_group` (from footballplayers.position_group)
   - `base_price` (from the round's base_price setting)
   - `status` (set to 'pending')
   - `season_id` (from the round's season_id)

3. WHEN all players are successfully added THEN the system SHALL return a success response indicating the number of players added to the round

4. IF the player insertion fails for any player THEN the system SHALL log the error AND continue processing remaining players

### Requirement 2

**User Story:** As a committee member, I want to see confirmation of how many players were added to the bulk round, so that I can verify the round was set up correctly.

#### Acceptance Criteria

1. WHEN a bulk round is created successfully THEN the system SHALL display a message showing the total count of players added to the round

2. WHEN viewing the bulk round details THEN the system SHALL show the accurate player count from the `round_players` table

3. IF no eligible players are found THEN the system SHALL display a warning message indicating that no players were available to add

### Requirement 3

**User Story:** As a system administrator, I want the player population logic to be idempotent and handle edge cases, so that the system remains stable even with unexpected data states.

#### Acceptance Criteria

1. WHEN a bulk round already has players in `round_players` THEN the system SHALL NOT duplicate player entries

2. IF a player's `is_sold` status changes after round creation THEN the system SHALL NOT automatically remove them from the round

3. WHEN the `footballplayers` table is empty or has no eligible players THEN the system SHALL create the round successfully with zero players AND log an appropriate warning

4. IF the database transaction fails during player insertion THEN the system SHALL rollback the round creation to maintain data consistency
