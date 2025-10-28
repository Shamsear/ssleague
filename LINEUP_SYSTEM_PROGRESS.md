# Lineup System Implementation Progress

## ✅ Completed (4/10 Tasks)

### 1. Lineup Submission UI Component ✅
**File:** `components/LineupSubmission.tsx`

**Features:**
- Select 5 starting players + 2 substitutes
- Real-time validation with visual feedback
- Classic player count tracker (minimum 2 required)
- Deadline countdown display
- Lock status indication
- Drag-free simple interface with "Start" and "Sub" buttons
- Error messaging
- Edit existing lineups

**Validation Rules:**
- Exactly 5 starting players
- Exactly 2 substitutes  
- No duplicate players
- Minimum 2 classic category players
- Respects deadline (1 hour after round start)

---

### 2. Lineup Submission Page ✅
**File:** `app/dashboard/team/fixture/[fixtureId]/lineup/page.tsx`

**URL:** `/dashboard/team/fixture/[fixtureId]/lineup`

**Features:**
- Dedicated clean page for lineup management
- Shows fixture details (teams, round, match number)
- Loads existing lineup if already submitted
- Integrates LineupSubmission component
- Redirects to fixture page after success

---

### 3. Substitution UI for Live Matches ✅
**Files:**
- `components/LineupSubstitution.tsx`
- `app/dashboard/team/fixture/[fixtureId]/substitute/page.tsx`

**URL:** `/dashboard/team/fixture/[fixtureId]/substitute`

**Features:**
- Two-column selection interface:
  - Left: Players coming OFF (Starting XI)
  - Right: Players coming ON (Substitutes)
- Visual selection with color coding (red for out, green for in)
- Substitution summary display
- Optional notes field (e.g., "Tactical change", "Injury")
- Confirmation modal before executing
- Substitution history with timestamps
- Auto-refresh lineup after substitution

**API:**
- `POST /api/lineups/[id]/substitute` - Make substitution
- `GET /api/lineups/[id]/substitutions` - Get substitution history

---

### 4. Dashboard Lineup Status Widget ✅
**File:** `components/LineupStatusWidget.tsx`

**Features:**
- Shows next 5 upcoming fixtures
- Summary stats:
  - Count of fixtures needing lineup
  - Count of submitted lineups
  - Count of locked lineups
- Per-fixture display:
  - Round and match number
  - Teams playing
  - Scheduled date/time
  - Lineup status (Required/Submitted/Locked)
  - Deadline countdown (days/hours/minutes)
  - Color-coded urgency
  - Action buttons (Submit/Edit Lineup, View Fixture)
- Animated "Action Required" badge for urgent fixtures
- Quick links to lineup submission page

**API:**
- `GET /api/team/[teamId]/fixtures` - Get team fixtures with filters

---

## 🔧 Supporting API Endpoints Created

1. **`GET /api/fixtures/[fixtureId]/editable`**
   - Checks if lineup can be edited
   - Returns deadline and round start time

2. **`GET /api/team/[teamId]/roster`**
   - Gets active players for a team in a season
   - Required for lineup submission

3. **`GET /api/team/[teamId]/fixtures`**
   - Gets fixtures for a team
   - Supports filtering by status and season
   - Used by dashboard widget

4. **`GET /api/lineups/[id]/substitutions`**
   - Gets substitution history for a lineup
   - Shows all swaps made during match

---

## 📋 Remaining Tasks (6/10)

### 5. Committee Lineup Monitoring Dashboard
**Status:** Not Started

Build admin dashboard showing:
- All fixtures for a round
- Which teams have/haven't submitted lineups
- Warning status for each team
- Ability to manually lock lineups
- Handle opponent lineup selection

---

### 6. Automatic Lineup Locking Cron Job
**Status:** Not Started

Create scheduled job to:
- Run every hour
- Find lineups past deadline (round start + 1 hour)
- Automatically set `is_locked = true`
- Could use Vercel Cron or similar

---

### 7. Stats Integration
**Status:** Not Started

Update match result submission to:
- Record `participation_type` for each player based on lineup
- Set to 'started', 'subbed_in', 'subbed_out', or 'unused_sub'
- Only count stats for 'started' and 'subbed_in' players
- Store `lineup_id` reference in player stats

---

### 8. Notification System
**Status:** Not Started

Build system to:
- Send warnings to teams missing lineups (first offense)
- Notify opponent they can select lineup (second offense)
- Support email and/or in-app notifications
- Track warning status in database

---

### 9. Lineup History/Audit Log
**Status:** Not Started

Create view showing:
- All lineup submissions for a fixture
- Changes made to lineups
- All substitutions during match
- Timestamps for each action
- Who made each change

---

### 10. Opponent Lineup Selection Interface
**Status:** Not Started

Build special UI for:
- Opponent to select lineup when other team fails twice
- Same validation rules (2 classic minimum, 5+2 players)
- Mark lineup with `selected_by_opponent = true`
- Notify both teams of selection

---

## 🗄️ Database Schema (Already Created)

### `lineups` Table
```sql
- id (PK): lineup_{fixture_id}_{team_id}
- fixture_id (FK)
- team_id
- starting_xi: JSONB [player_ids]
- substitutes: JSONB [player_ids]
- classic_player_count: integer
- is_locked: boolean
- submitted_by: user_id
- submitted_at: timestamp
- warning_given: boolean
- selected_by_opponent: boolean
```

### `lineup_substitutions` Table
```sql
- id (PK)
- lineup_id (FK)
- player_out: player_id
- player_out_name: string
- player_in: player_id
- player_in_name: string
- made_at: timestamp
- made_by: user_id
- made_by_name: string
- notes: text (optional)
```

---

## 🎯 Usage Examples

### Team Owner Workflow

1. **Submit Lineup:**
   - Navigate to `/dashboard/team/fixture/[fixtureId]/lineup`
   - Select 5 starters and 2 subs
   - Ensure at least 2 classic players
   - Click "Submit Lineup"

2. **Make Substitution During Match:**
   - Navigate to `/dashboard/team/fixture/[fixtureId]/substitute`
   - Select player to come off from Starting XI
   - Select player to come on from Substitutes
   - Add optional notes
   - Confirm substitution

3. **Check Lineup Status:**
   - View dashboard (add `<LineupStatusWidget />` component)
   - See all upcoming fixtures
   - Quick link to submit missing lineups

### Committee Admin Workflow (To Be Implemented)

1. View round monitoring dashboard
2. See which teams haven't submitted lineups
3. Send warnings to teams
4. Manually lock lineups if needed
5. Handle opponent selection for failed teams

---

## 🚀 Next Steps

**Priority Order:**
1. Implement committee monitoring dashboard (Task #5)
2. Add lineup locking cron job (Task #6)
3. Integrate with stats calculation (Task #7)
4. Build notification system (Task #8)
5. Create audit log view (Task #9)
6. Build opponent selection UI (Task #10)

---

## 📝 Notes

- All backend APIs are complete and functional
- Database tables are created via migration
- Frontend components use modern React with TypeScript
- UI uses Tailwind CSS with glass morphism effects
- All validation rules are enforced both client and server-side
- Lineup deadline is 1 hour after round start time

**Last Updated:** 2024-01-27  
**Progress:** 40% Complete (4/10 tasks)
