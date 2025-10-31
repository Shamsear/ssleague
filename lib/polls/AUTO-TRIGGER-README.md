# Poll Auto-Trigger System

This document describes the automatic poll creation system that generates polls based on match and season events.

## Overview

The auto-trigger system automatically creates polls at various tournament milestones:

1. **Match Prediction Polls** - Created when fixtures are scheduled
2. **Player of the Match Polls** - Created after matches are completed
3. **Daily Polls** - Best player and best team from matches played each day
4. **Weekly Polls** - Top player and top team from each week
5. **Season Polls** - Season champion and MVP polls at season milestones

## Architecture

### Core Files

```
lib/polls/
├── auto-trigger.ts           # Main trigger functions
├── poll-helpers.ts           # Poll creation helper functions
└── AUTO-TRIGGER-README.md    # This file

app/api/
├── fixtures/
│   ├── bulk/route.ts         # Hooks: Match prediction polls
│   └── [fixtureId]/
│       └── edit-result/      # Hooks: Player of match polls
│           route.ts
└── polls/
    └── scheduler/
        ├── daily/route.ts    # API: Daily poll scheduler
        ├── weekly/route.ts   # API: Weekly poll scheduler
        └── season/route.ts   # API: Season poll scheduler
```

## Auto-Trigger Functions

### 1. Match Prediction Poll

**Trigger**: When fixtures are created/scheduled
**File**: `lib/polls/auto-trigger.ts` → `triggerMatchPredictionPoll()`
**Hook**: `app/api/fixtures/bulk/route.ts`

**What it does**:
- Creates a poll asking "Who will win the match?"
- Options: Home Team, Away Team, Draw
- Closes when the match starts
- Automatically triggered when fixtures are inserted

**Example**:
```typescript
// Called automatically in fixtures bulk insert
await triggerMatchPredictionPoll(fixtureId);
```

---

### 2. Player of the Match Poll

**Trigger**: When match results are recorded
**File**: `lib/polls/auto-trigger.ts` → `triggerPlayerOfMatchPoll()`
**Hook**: `app/api/fixtures/[fixtureId]/edit-result/route.ts`

**What it does**:
- Creates a poll asking "Who was the best player?"
- Options: All players who participated in the match
- Closes 24 hours after match completion
- Automatically triggered when results are recorded

**Example**:
```typescript
// Called automatically after match result is recorded
await triggerPlayerOfMatchPoll(fixtureId);
```

---

### 3. Daily Polls

**Trigger**: End of each day (via scheduler or manual API call)
**File**: `lib/polls/auto-trigger.ts` → `runDailyPollTriggers()`
**API**: `POST /api/polls/scheduler/daily`

**What it does**:
- Creates two polls:
  1. **Best Player of the Day**: All players who played today
  2. **Best Team of the Day**: All teams that played today
- Only creates polls if matches were completed that day
- Closes 24 hours after creation

**API Usage**:
```bash
# Via cron job or manual call
POST /api/polls/scheduler/daily
Content-Type: application/json

{
  "season_id": "season_xxx",
  "date": "2025-01-15"  // Optional, defaults to today
}
```

**Check if polls exist**:
```bash
GET /api/polls/scheduler/daily?season_id=season_xxx&date=2025-01-15
```

---

### 4. Weekly Polls

**Trigger**: End of each week (via scheduler or manual API call)
**File**: `lib/polls/auto-trigger.ts` → `runWeeklyPollTriggers()`
**API**: `POST /api/polls/scheduler/weekly`

**What it does**:
- Creates two polls:
  1. **Top Player of the Week**: Top performing players
  2. **Top Team of the Week**: All teams in the season
- Closes at end of week

**API Usage**:
```bash
# Via cron job or manual call
POST /api/polls/scheduler/weekly
Content-Type: application/json

{
  "season_id": "season_xxx",
  "week_number": 3
}
```

**Check if polls exist**:
```bash
GET /api/polls/scheduler/weekly?season_id=season_xxx&week_number=3
```

---

### 5. Season Polls

**Trigger**: Manual (when playoffs begin or season ends)
**File**: `lib/polls/auto-trigger.ts` → `triggerSeasonChampionPoll()`, `triggerSeasonMVPPoll()`
**API**: `POST /api/polls/scheduler/season`

**What it does**:
- Creates season-level polls:
  1. **Season Champion**: Predict the tournament winner
  2. **Season MVP**: Vote for most valuable player

**API Usage**:
```bash
# Create champion poll
POST /api/polls/scheduler/season
Content-Type: application/json

{
  "season_id": "season_xxx",
  "poll_type": "champion"  // or "mvp" or "both"
}
```

**Check if polls exist**:
```bash
GET /api/polls/scheduler/season?season_id=season_xxx
```

---

## Scheduling Setup

### Option 1: Cron Jobs (Recommended for Production)

Add cron jobs to call the scheduler APIs:

```bash
# Daily polls - run at 11:59 PM every day
59 23 * * * curl -X POST https://your-domain.com/api/polls/scheduler/daily \
  -H "Content-Type: application/json" \
  -d '{"season_id":"current_season_id"}'

# Weekly polls - run at 11:59 PM every Sunday
59 23 * * 0 curl -X POST https://your-domain.com/api/polls/scheduler/weekly \
  -H "Content-Type: application/json" \
  -d '{"season_id":"current_season_id","week_number":CURRENT_WEEK}'
```

### Option 2: Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/polls/scheduler/daily",
      "schedule": "59 23 * * *"
    },
    {
      "path": "/api/polls/scheduler/weekly",
      "schedule": "59 23 * * 0"
    }
  ]
}
```

### Option 3: Manual Triggers

Call the scheduler APIs manually from an admin dashboard:

```typescript
// Daily polls
const triggerDailyPolls = async () => {
  const response = await fetch('/api/polls/scheduler/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      season_id: currentSeasonId,
      date: '2025-01-15', // optional
    }),
  });
  return response.json();
};

// Weekly polls
const triggerWeeklyPolls = async () => {
  const response = await fetch('/api/polls/scheduler/weekly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      season_id: currentSeasonId,
      week_number: 3,
    }),
  });
  return response.json();
};

// Season polls
const triggerSeasonPolls = async () => {
  const response = await fetch('/api/polls/scheduler/season', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      season_id: currentSeasonId,
      poll_type: 'both', // 'champion', 'mvp', or 'both'
    }),
  });
  return response.json();
};
```

---

## Poll Lifecycle

### 1. Creation
- Poll is created with `is_closed = false`
- Poll options are generated based on context
- Closing time is set based on poll type

### 2. Voting Period
- Users can vote through `/api/polls/{pollId}/vote`
- Real-time vote counts are tracked
- Users can change their vote if allowed

### 3. Closing
- Polls automatically close at `closes_at` time
- Or can be manually closed via API
- Once closed, no more votes are accepted

### 4. Results
- Results are immediately available
- Can be displayed in poll widgets
- Can be referenced in news articles

---

## Database Schema

Polls are stored with the following metadata:

```typescript
{
  poll_type: 'match_prediction' | 'player_of_match' | 'daily_best_player' | ...,
  metadata: {
    fixture_id?: string,      // For match-specific polls
    date?: string,            // For daily polls (YYYY-MM-DD)
    week_number?: number,     // For weekly polls
    home_team_id?: string,    // For match polls
    away_team_id?: string,    // For match polls
    // ... other contextual data
  },
  closes_at: timestamp,
  is_closed: boolean
}
```

---

## Error Handling

All trigger functions:
- Return `null` if poll creation fails
- Log errors to console
- Don't throw exceptions (non-blocking)
- Check for duplicate polls before creating

Example:
```typescript
const pollId = await triggerMatchPredictionPoll(fixtureId);
if (!pollId) {
  console.error('Failed to create poll, but continuing...');
}
```

---

## Testing

### Test Match Prediction Poll
```bash
# 1. Create fixtures
POST /api/fixtures/bulk
{
  "fixtures": [{
    "id": "fix_test",
    "season_id": "season_xxx",
    "status": "scheduled",
    "scheduled_date": "2025-01-20T18:00:00Z",
    ...
  }]
}

# 2. Check if poll was created
GET /api/polls?season_id=season_xxx&poll_type=match_prediction
```

### Test Player of Match Poll
```bash
# 1. Record match result
PATCH /api/fixtures/fix_test/edit-result
{
  "matchups": [...],
  ...
}

# 2. Check if poll was created
GET /api/polls?season_id=season_xxx&poll_type=player_of_match
```

### Test Daily Polls
```bash
# Trigger manually
POST /api/polls/scheduler/daily
{
  "season_id": "season_xxx",
  "date": "2025-01-15"
}

# Check results
GET /api/polls/scheduler/daily?season_id=season_xxx&date=2025-01-15
```

---

## Monitoring

Monitor poll creation with these queries:

```sql
-- Check recent polls
SELECT 
  id, poll_type, question_en, 
  total_votes, is_closed, created_at
FROM polls
WHERE season_id = 'season_xxx'
ORDER BY created_at DESC
LIMIT 50;

-- Check poll creation rate
SELECT 
  DATE(created_at) as date,
  poll_type,
  COUNT(*) as count
FROM polls
WHERE season_id = 'season_xxx'
GROUP BY DATE(created_at), poll_type
ORDER BY date DESC;

-- Check for failed auto-triggers (missing polls)
-- Match polls should exist for all scheduled matches
SELECT f.id as fixture_id
FROM fixtures f
LEFT JOIN polls p ON p.metadata->>'fixture_id' = f.id 
  AND p.poll_type = 'match_prediction'
WHERE f.status = 'scheduled'
  AND f.scheduled_date IS NOT NULL
  AND p.id IS NULL;
```

---

## Future Enhancements

Potential improvements:
1. **Smart poll closing** - Close match prediction polls when match starts
2. **Poll notifications** - Notify users of new polls
3. **Poll analytics** - Track participation rates
4. **AI-powered options** - Generate poll options based on player performance
5. **Multi-round polls** - Best of the month, best of the season, etc.
6. **Poll templates** - Admin-defined custom poll templates
7. **Conditional polls** - Only create polls if certain conditions are met
