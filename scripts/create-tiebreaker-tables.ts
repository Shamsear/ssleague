import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function createTiebreakerTables() {
  try {
    console.log('Creating tiebreaker tables...\n');

    // Create tiebreakers table
    await sql`
      CREATE TABLE IF NOT EXISTS tiebreakers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
        original_amount INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'excluded')),
        winning_team_id VARCHAR(255),
        winning_amount INTEGER,
        duration_minutes INTEGER DEFAULT 2,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        CONSTRAINT unique_tiebreaker_per_round_player UNIQUE(round_id, player_id)
      );
    `;
    console.log('✅ Created tiebreakers table');

    // Create team_tiebreakers table (junction table for teams involved in tiebreaker)
    await sql`
      CREATE TABLE IF NOT EXISTS team_tiebreakers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tiebreaker_id UUID NOT NULL REFERENCES tiebreakers(id) ON DELETE CASCADE,
        team_id VARCHAR(255) NOT NULL,
        original_bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
        new_bid_amount INTEGER,
        submitted BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_team_per_tiebreaker UNIQUE(tiebreaker_id, team_id)
      );
    `;
    console.log('✅ Created team_tiebreakers table');

    // Create indexes for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tiebreakers_round_id ON tiebreakers(round_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tiebreakers_status ON tiebreakers(status);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_tiebreaker_id ON team_tiebreakers(tiebreaker_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_team_tiebreakers_team_id ON team_tiebreakers(team_id);
    `;
    console.log('✅ Created indexes');

    console.log('\n📋 Tiebreaker System Schema:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 tiebreakers table:');
    console.log('  - id: Unique tiebreaker ID');
    console.log('  - round_id: Reference to the round');
    console.log('  - player_id: Player being bid on');
    console.log('  - original_amount: The tied bid amount');
    console.log('  - status: active/resolved/excluded');
    console.log('  - winning_team_id: Team that won after tiebreaker (if resolved)');
    console.log('  - winning_amount: Winning bid amount (if resolved)');
    console.log('  - duration_minutes: How long teams have to submit (default 2 mins)');
    console.log('  - created_at: When tiebreaker was created');
    console.log('  - resolved_at: When tiebreaker was resolved');
    
    console.log('\n📊 team_tiebreakers table:');
    console.log('  - id: Unique record ID');
    console.log('  - tiebreaker_id: Reference to tiebreaker');
    console.log('  - team_id: Team participating in tiebreaker (Firebase ID)');
    console.log('  - original_bid_id: Reference to the original tied bid');
    console.log('  - new_bid_amount: New higher bid amount (NULL if not submitted)');
    console.log('  - submitted: Boolean flag if team submitted new bid');
    console.log('  - submitted_at: Timestamp of submission');
    console.log('  - created_at: When team was added to tiebreaker');

    console.log('\n✨ Tiebreaker System Ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error creating tiebreaker tables:', error);
    process.exit(1);
  }
}

createTiebreakerTables();
