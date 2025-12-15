# Fixture Lineup Edit Requirements

## Current System Overview

### Fixture Creation Flow
1. **Draft Phase**: Round not scheduled yet - teams can save draft lineups
2. **Home Fixture Phase**: Before home deadline - home team creates matchups
3. **Fixture Entry Phase**: After home deadline, before away deadline - both teams can create/edit
4. **Result Entry Phase**: After away deadline - enter match results
5. **Closed**: After result deadline - read-only

### Current Limitations
- Home team can only create matchups during home fixture phase
- Once matchups are created, lineups are locked
- No ability for home team to edit lineup after initial submission

## New Requirements

### 1. Home Team Lineup Editing (Before Home Deadline)
**Requirement**: Home team should be able to edit their lineup multiple times until the home fixture deadline.

**Use Case**: If home team wants to change a player in their lineup, they can do so before the deadline.

**Implementation**:
- Allow home team to modify their lineup (starting XI and substitutes) until home deadline
- Each edit should update the lineup in the database
- If matchups have already been created, editing lineup should:
  - Delete existing matchups
  - Allow home team to recreate matchups with new lineup
  - Send notification to away team about lineup change

### 2. Dual Fixture Creation (After Home Deadline)
**Requirement**: If home team didn't submit fixture by deadline, both home and away teams can create fixtures.

**Key Constraint**: First-come-first-served - whichever team submits first wins.

**Implementation**:
- After home deadline passes, check if matchups exist
- If no matchups exist:
  - Both teams can see "Create Fixture" button
  - Each team works on their own draft (not visible to other team)
  - When a team clicks "Submit", check if matchups already exist
  - If matchups don't exist, create them (first team wins)
  - If matchups already exist, show error "Fixture already created by opponent"
  - Refresh page to show the created matchups

### 3. Race Condition Handling
**Technical Challenge**: Both teams might submit at the same time.

**Solution**:
- Use database transaction with row-level locking
- Check for existing matchups within the transaction
- Only allow one team's submission to succeed
- Return appropriate error to the second team

## Technical Implementation Plan

### Phase 1: Home Team Lineup Editing

#### 1.1 Update Lineup API
**File**: `app/api/lineups/route.ts` or `app/api/fixtures/[fixtureId]/lineup/route.ts`

**Changes**:
- Add `PUT` method to update existing lineup
- Check if user is home team
- Check if current time is before home deadline
- If matchups exist, add warning that they will be deleted
- Update lineup in database
- If matchups exist, delete them and log the action

#### 1.2 Update Frontend
**File**: `app/dashboard/team/fixture/[fixtureId]/page.tsx`

**Changes**:
- Add "Edit Lineup" button for home team (visible before home deadline)
- Show warning modal: "Editing lineup will delete existing matchups. Continue?"
- After edit, redirect to lineup page
- After lineup save, redirect back to fixture page

### Phase 2: Dual Fixture Creation

#### 2.1 Update Matchups API
**File**: `app/api/fixtures/[fixtureId]/matchups/route.ts`

**Changes to POST method**:
```typescript
export async function POST(request: NextRequest, { params }: { params: Promise<{ fixtureId: string }> }) {
  const sql = getTournamentDb();
  const { fixtureId } = await params;
  const body = await request.json();
  const { matchups, created_by } = body;

  // Start transaction
  await sql.begin(async (tx) => {
    // Lock the fixture row to prevent race conditions
    const [fixture] = await tx`
      SELECT * FROM fixtures
      WHERE id = ${fixtureId}
      FOR UPDATE
    `;

    // Check if matchups already exist
    const existingMatchups = await tx`
      SELECT COUNT(*) as count
      FROM matchups
      WHERE fixture_id = ${fixtureId}
    `;

    if (existingMatchups[0].count > 0) {
      throw new Error('MATCHUPS_ALREADY_EXIST');
    }

    // Insert matchups
    for (const matchup of matchups) {
      await tx`
        INSERT INTO matchups (...)
        VALUES (...)
      `;
    }

    // Log who created the matchups
    await tx`
      UPDATE fixtures
      SET 
        matchups_created_by = ${created_by},
        matchups_created_at = NOW()
      WHERE id = ${fixtureId}
    `;
  });

  return NextResponse.json({ success: true });
}
```

#### 2.2 Update Frontend Logic
**File**: `app/dashboard/team/fixture/[fixtureId]/page.tsx`

**Changes**:
```typescript
// In the phase calculation logic
if (currentPhase === 'fixture_entry' && bothLineupsSubmitted) {
  // After home deadline, before away deadline
  if (!matchupsExist) {
    // Both teams can create
    canCreate = true;  // Both home and away
  } else {
    // Matchups exist - determine who can edit
    const createdBy = matchups[0]?.created_by;
    canEditMatch = createdBy === user.uid;
  }
}

// In handleCreateMatchups function
const handleCreateMatchups = async () => {
  setIsSaving(true);
  try {
    const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchups: matchupsToSave,
        created_by: user!.uid,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle race condition
      if (errorData.error === 'MATCHUPS_ALREADY_EXIST') {
        showAlert({
          type: 'warning',
          title: 'Fixture Already Created',
          message: 'The opponent has already created the fixture. Refreshing...'
        });
        
        // Refresh page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      }
      
      throw new Error(errorData.details || errorData.error);
    }

    showAlert({
      type: 'success',
      title: 'Success',
      message: 'Matchups created successfully!'
    });
    window.location.reload();
  } catch (error: any) {
    console.error('Error creating matchups:', error);
    showAlert({
      type: 'error',
      title: 'Creation Failed',
      message: error.message
    });
  } finally {
    setIsSaving(false);
  }
};
```

### Phase 3: Database Schema Updates

#### 3.1 Add Tracking Fields to Fixtures Table
```sql
ALTER TABLE fixtures
ADD COLUMN matchups_created_by VARCHAR(255),
ADD COLUMN matchups_created_at TIMESTAMP,
ADD COLUMN lineup_last_edited_by VARCHAR(255),
ADD COLUMN lineup_last_edited_at TIMESTAMP;
```

#### 3.2 Add Audit Log for Lineup Changes
```sql
CREATE TABLE lineup_audit_log (
  id SERIAL PRIMARY KEY,
  fixture_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted'
  previous_lineup JSONB,
  new_lineup JSONB,
  changed_by VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);
```

## UI/UX Considerations

### 1. Home Team Lineup Editing
- Show clear indicator: "You can edit your lineup until [home deadline]"
- Display countdown timer to home deadline
- Warning modal when editing after matchups created
- Success message after lineup update

### 2. Dual Creation Phase
- Show message: "Home team didn't submit. Both teams can now create fixture."
- Display "Create Fixture" button for both teams
- Show loading state during submission
- Handle race condition gracefully with friendly message

### 3. Notifications
- Notify away team when home team edits lineup
- Notify both teams when matchups are created
- Notify losing team in race condition

## Testing Scenarios

### Scenario 1: Home Team Edits Lineup Before Deadline
1. Home team submits initial lineup
2. Home team creates matchups
3. Home team realizes they want to change a player
4. Home team clicks "Edit Lineup"
5. System shows warning about deleting matchups
6. Home team confirms and edits lineup
7. Matchups are deleted
8. Home team recreates matchups with new lineup
9. Away team receives notification

### Scenario 2: Both Teams Try to Create Fixture
1. Home deadline passes without home team submission
2. Both teams see "Create Fixture" button
3. Home team starts creating matchups (not submitted yet)
4. Away team starts creating matchups (not submitted yet)
5. Home team clicks "Submit" first
6. Home team's matchups are saved
7. Away team clicks "Submit" 2 seconds later
8. Away team sees "Fixture already created" message
9. Away team's page refreshes to show home team's matchups

### Scenario 3: Exact Same Time Submission
1. Both teams click "Submit" at exact same millisecond
2. Database transaction locks fixture row
3. First transaction to acquire lock succeeds
4. Second transaction fails with "already exists" error
5. Second team sees friendly error message
6. Page refreshes to show created matchups

## Security Considerations

1. **Authorization**: Verify user is part of the fixture before allowing any action
2. **Deadline Validation**: Always check deadlines on server-side, not just client-side
3. **Transaction Integrity**: Use database transactions to prevent race conditions
4. **Audit Trail**: Log all lineup changes and matchup creations
5. **Rate Limiting**: Prevent spam submissions

## Migration Plan

### Step 1: Database Changes
- Add new columns to fixtures table
- Create lineup_audit_log table
- Test on staging database

### Step 2: API Updates
- Update matchups POST endpoint with transaction logic
- Add lineup edit endpoint
- Add error handling for race conditions
- Deploy to staging

### Step 3: Frontend Updates
- Add edit lineup functionality
- Update phase logic for dual creation
- Add race condition handling
- Test on staging

### Step 4: Testing
- Test all scenarios
- Load test race condition handling
- User acceptance testing

### Step 5: Production Deployment
- Deploy during low-traffic period
- Monitor for errors
- Have rollback plan ready

## Success Metrics

1. **Home Team Satisfaction**: Home teams can edit lineups without issues
2. **Race Condition Handling**: 100% of dual submissions handled gracefully
3. **No Data Corruption**: All matchups created correctly, no duplicates
4. **User Experience**: Clear messaging, no confusion
5. **Performance**: Lineup edits complete in < 2 seconds

## Future Enhancements

1. **Real-time Updates**: Use WebSocket to show when opponent is creating fixture
2. **Draft Preview**: Show draft matchups before final submission
3. **Lineup History**: Show history of lineup changes
4. **Undo Functionality**: Allow undo of recent lineup changes
5. **Collaborative Mode**: Allow both teams to see each other's drafts (optional)
