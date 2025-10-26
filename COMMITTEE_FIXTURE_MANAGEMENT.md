# Committee Admin - Fixture Management Guide

## Overview

Committee admin can:
- ✅ **View & Supervise** all fixtures and results
- ✅ **View Complete Timeline** for each fixture (who created, edited, submitted results, etc.)
- ✅ **Intervene & Override** fixtures and results when mistakes occur
- ✅ **Declare Walkover (WO)** when one team is absent
- ✅ **Declare NULL** when both teams are absent
- ✅ **Edit Results** after submission

---

## Setup: Enable Audit Trail

### Step 1: Run the Migration

Execute the SQL migration to add audit trail capability:

```bash
# Connect to your Neon database
psql $NEON_DATABASE_URL

# Run the migration
\i database/migrations/add-fixture-audit-trail.sql
```

**What this adds:**
- Audit fields to `fixtures` table (created_by, updated_by, result_submitted_by, etc.)
- `fixture_audit_log` table to store all changes
- Automatic triggers to log changes
- Support for WO/NULL match status

---

## Features

### 1. 📋 View Fixture Timeline

**UI Component:** `<FixtureTimeline />`

Shows complete history of a fixture:
- 📅 **Created** - When & who created the fixture
- ✏️ **Updated** - Any edits to fixture details (teams, date, etc.)
- 📊 **Result Submitted** - When & who submitted the result
- 🔄 **Result Edited** - Any changes to submitted results
- ⚠️ **WO Declared** - Walkover declarations
- ❌ **NULL Declared** - Match nullifications
- 🗑️ **Deleted** - Fixture deletions

**API Endpoint:**
```
GET /api/fixtures/{fixtureId}/audit-log
```

**Response:**
```json
{
  "success": true,
  "fixture": {
    "id": "fixture_123",
    "round_number": 1,
    "match_number": 1,
    "home_team": "Team A",
    "away_team": "Team B"
  },
  "timeline": [
    {
      "id": "created",
      "type": "created",
      "action": "Fixture Created",
      "user": "Committee Admin",
      "timestamp": "2025-01-15T10:00:00Z",
      "icon": "📅",
      "color": "blue",
      "details": "Round 1, Match 1 created"
    },
    {
      "id": 123,
      "type": "result_submitted",
      "action": "Result Submitted",
      "user": "Team Captain A",
      "timestamp": "2025-01-20T18:30:00Z",
      "icon": "📊",
      "color": "green",
      "details": "Score: Team A 3 - 2 Team B"
    }
  ]
}
```

---

### 2. ⚠️ Declare Walkover (WO)

When **ONE team is absent**, committee admin can declare a walkover.

**Scenarios:**
- **Home team absent** → Away team wins by WO
- **Away team absent** → Home team wins by WO

**Implementation:**

```typescript
// API endpoint: PATCH /api/fixtures/{fixtureId}/declare-wo

const declareWalkover = async (fixtureId: string, absentTeam: 'home' | 'away', userId: string, userName: string) => {
  const response = await fetch(`/api/fixtures/${fixtureId}/declare-wo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      absent_team: absentTeam, // 'home' or 'away'
      declared_by: userId,
      declared_by_name: userName,
      notes: 'Team did not show up for the match'
    })
  });
};
```

**What happens:**
1. Sets `match_status_reason` to `wo_home_absent` or `wo_away_absent`
2. Awards automatic win to present team (3-0 or similar)
3. Updates team stats (1 win for present team, 1 loss for absent team)
4. Records WO in audit log with timestamp and who declared it
5. Sends notifications to both teams

---

### 3. ❌ Declare Match NULL

When **BOTH teams are absent**, committee admin can nullify the match.

**Implementation:**

```typescript
// API endpoint: PATCH /api/fixtures/{fixtureId}/declare-null

const declareNull = async (fixtureId: string, userId: string, userName: string) => {
  const response = await fetch(`/api/fixtures/${fixtureId}/declare-null`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      declared_by: userId,
      declared_by_name: userName,
      notes: 'Both teams absent - match declared null'
    })
  });
};
```

**What happens:**
1. Sets `match_status_reason` to `null_both_absent`
2. Sets `status` to `cancelled`
3. No points awarded to either team
4. Match doesn't count in standings
5. Records declaration in audit log

---

### 4. 🔄 Edit Fixture Results

Committee admin can correct mistakes in submitted results.

**Process:**
1. **Revert old stats** (using revert APIs)
2. **Apply new stats** (using update APIs)
3. **Log the edit** in audit trail

**Implementation:**

```typescript
// API endpoint: PATCH /api/fixtures/{fixtureId}/edit-result

const editFixtureResult = async (
  fixtureId: string,
  seasonId: string,
  oldMatchups: any[],
  newMatchups: any[],
  userId: string,
  userName: string,
  reason: string
) => {
  // Step 1: Revert old stats
  await fetch('/api/realplayers/revert-fixture-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      season_id: seasonId,
      fixture_id: fixtureId,
      matchups: oldMatchups
    })
  });

  await fetch('/api/realplayers/revert-fixture-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fixture_id: fixtureId,
      season_id: seasonId,
      matchups: oldMatchups
    })
  });

  // Step 2: Update with new results
  await fetch('/api/fixtures/${fixtureId}/edit-result', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      matchups: newMatchups,
      edited_by: userId,
      edited_by_name: userName,
      edit_reason: reason
    })
  });

  // Step 3: Apply new stats
  await fetch('/api/realplayers/update-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      season_id: seasonId,
      fixture_id: fixtureId,
      matchups: newMatchups
    })
  });

  await fetch('/api/realplayers/update-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fixture_id: fixtureId,
      season_id: seasonId,
      matchups: newMatchups
    })
  });
};
```

---

### 5. ✏️ Edit Fixture Details

Committee admin can edit fixture information (teams, date, etc.)

**Implementation:**

```typescript
// API endpoint: PATCH /api/fixtures/{fixtureId}

const editFixture = async (fixtureId: string, updates: any, userId: string, userName: string) => {
  const response = await fetch(`/api/fixtures/${fixtureId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...updates,
      updated_by: userId,
      updated_by_name: userName
    })
  });
};
```

**Editable fields:**
- Home team / Away team
- Scheduled date/time
- Round number
- Match number
- Status

---

## Database Schema

### Fixtures Table (with audit fields)

```sql
CREATE TABLE fixtures (
    id VARCHAR(255) PRIMARY KEY,
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    home_team_id VARCHAR(255) NOT NULL,
    away_team_id VARCHAR(255) NOT NULL,
    home_team_name VARCHAR(255) NOT NULL,
    away_team_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    leg VARCHAR(20) DEFAULT 'first',
    scheduled_date TIMESTAMP,
    home_score INTEGER,
    away_score INTEGER,
    result VARCHAR(50),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    created_by_name VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255),
    updated_by_name VARCHAR(255),
    result_submitted_by VARCHAR(255),
    result_submitted_by_name VARCHAR(255),
    result_submitted_at TIMESTAMP WITH TIME ZONE,
    motm_player_id VARCHAR(255),
    motm_player_name VARCHAR(255),
    match_status_reason VARCHAR(255), -- 'normal', 'wo_home_absent', 'wo_away_absent', 'null_both_absent'
    declared_by VARCHAR(255),
    declared_by_name VARCHAR(255),
    declared_at TIMESTAMP WITH TIME ZONE
);
```

### Fixture Audit Log Table

```sql
CREATE TABLE fixture_audit_log (
    id SERIAL PRIMARY KEY,
    fixture_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_by VARCHAR(255) NOT NULL,
    action_by_name VARCHAR(255) NOT NULL,
    action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changes JSONB,
    notes TEXT,
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER,
    match_number INTEGER
);
```

---

## UI Integration

### Add Timeline Button to Fixture Cards

```tsx
import FixtureTimeline from '@/components/FixtureTimeline';

const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
const [showTimeline, setShowTimeline] = useState(false);

// In your fixture card:
<button
  onClick={() => {
    setSelectedFixtureId(fixture.id);
    setShowTimeline(true);
  }}
  className="text-blue-600 hover:text-blue-700"
>
  📋 View Timeline
</button>

// Add timeline modal:
<FixtureTimeline
  fixtureId={selectedFixtureId || ''}
  isOpen={showTimeline}
  onClose={() => setShowTimeline(false)}
/>
```

---

## Complete Workflow Examples

### Example 1: Team Reports Wrong Score

**Problem:** Team A submitted 3-2 but actual score was 2-2

**Solution:**
1. Committee admin opens fixture timeline
2. Sees result submission at 6:30 PM by Team Captain A
3. Clicks "Edit Result"
4. Changes score from 3-2 to 2-2
5. Enters reason: "Score correction - actual result was draw"
6. System:
   - Reverts old stats (Team A -3 points, Team B no change)
   - Applies new stats (Team A +1, Team B +1 for draw)
   - Logs edit in timeline

### Example 2: Team Doesn't Show Up

**Problem:** Team B didn't show up for the match

**Solution:**
1. Committee admin finds the fixture
2. Clicks "Declare Walkover"
3. Selects "Away team absent"
4. System:
   - Awards 3-0 win to Team A
   - Records WO in audit log
   - Updates standings
   - Sends notification to both teams

### Example 3: Both Teams Absent

**Problem:** Neither team showed up

**Solution:**
1. Committee admin clicks "Declare NULL"
2. System:
   - Marks match as cancelled
   - No points awarded
   - Match excluded from standings
   - Records in audit log

---

## Security & Permissions

✅ Only **committee_admin** role can:
- View audit logs
- Declare WO/NULL
- Edit results
- Override fixtures

✅ All actions are logged with:
- User ID
- User name
- Timestamp
- Changes made
- Reason (optional)

✅ Complete audit trail for accountability

---

## Testing Checklist

- [ ] Run migration successfully
- [ ] Create a fixture (check timeline shows creation)
- [ ] Submit result (check timeline shows submission)
- [ ] Edit result (check timeline shows edit + old/new values)
- [ ] Declare WO (check timeline and stats)
- [ ] Declare NULL (check timeline and stats)
- [ ] View complete timeline with all events
- [ ] Verify only committee admin can access these features

---

## Next Steps

1. ✅ Run the database migration
2. ✅ Integrate `<FixtureTimeline />` component in tournament page
3. ✅ Create WO/NULL API endpoints
4. ✅ Create result editing UI
5. ✅ Test complete workflow
6. ✅ Deploy to production

---

**All committee intervention features are now ready to implement!** 🚀
