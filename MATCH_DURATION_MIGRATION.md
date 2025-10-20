# Match Duration Migration

## What This Adds

This migration adds a `match_duration` column to the `matchups` table to store the eFootball match duration (6-12 minutes) that teams agree to play before a match.

## How to Run

### Option 1: Neon Console (Recommended)
1. Go to your Neon Console: https://console.neon.tech
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of `migrations/add_match_duration_to_matchups.sql`
5. Click **Run**

### Option 2: Command Line (psql)
```bash
psql "YOUR_NEON_DATABASE_URL" -f migrations/add_match_duration_to_matchups.sql
```

## What It Does

- Adds `match_duration` column (INTEGER, default: 7)
- Adds validation constraint (values must be between 6-12)
- Safe to run multiple times (checks if column exists first)

## After Migration

The frontend is already updated to:
- Show match duration dropdown (6-12 minutes) when creating matchups
- Save the selected duration to the database
- Display the duration when viewing existing matchups

## Default Value

If no duration is selected, it defaults to **7 minutes** (3.5 min per half).
