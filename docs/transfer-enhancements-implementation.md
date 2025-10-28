# Transfer Window Enhancements - Implementation Guide

## Summary of Changes

### ✅ COMPLETED:
1. **Draft Page Captain Selection** - Added captain/VC selection at end of draft
   - Shows UI when squad is complete (max size reached)
   - Two dropdowns for captain and vice-captain selection
   - "Complete Draft" button to finalize
   - Visual feedback with Crown and Star icons

2. **Transfer Page State & Functions** - Added state and functions for captain/team changes
   - Added tab state: `'players' | 'captains' | 'team'`
   - Captain state: `captainId`, `viceCaptainId`, tracking of original values
   - Team state: `myTeam`, `realTeams`, `selectedTeamId`
   - Functions: `saveCaptains()`, `changeTeamAffiliation()`
   - Load real teams in `loadTransferData()`

### 🔄 REMAINING:
3. **Transfer Page UI with Tabs** - Need to add tab navigation and content sections
4. **Remove Captain Selection from My Team Page** - Keep display only, remove edit capability
5. **API Updates** (if needed) - Verify APIs work during transfer windows

---

## What's Left To Do

### 1. Add Tabs to Transfer Page UI

Replace the current single-view transfer interface with a tabbed interface:

**Tab Bar** (after header):
```tsx
<div className="flex gap-2 mb-6">
  <button onClick={() => setActiveTab('players')} className={activeTab === 'players' ? 'active' : ''}>
    <ArrowLeftRight /> Player Transfers
  </button>
  <button onClick={() => setActiveTab('captains')} className={activeTab === 'captains' ? 'active' : ''}>
    <Crown /> Captain Changes
  </button>
  <button onClick={() => setActiveTab('team')} className={activeTab === 'team' ? 'active' : ''}>
    <UsersIcon /> Team Affiliation
  </button>
</div>
```

**Tab Content Sections**:

#### Tab 1: Player Transfers (existing)
- Keep current UI (Player Out | Summary | Player In)
- Wrap in `{activeTab === 'players' && (...)}`

#### Tab 2: Captain Changes (NEW)
```tsx
{activeTab === 'captains' && (
  <div>
    <h2>Change Captain & Vice-Captain</h2>
    <p>Updates take effect immediately</p>
    
    <div className="grid md:grid-cols-2 gap-6">
      {/* Captain dropdown */}
      <select value={captainId} onChange={(e) => setCaptainId(e.target.value)}>
        {mySquad.map(player => (
          <option value={player.real_player_id}>{player.player_name}</option>
        ))}
      </select>
      
      {/* Vice Captain dropdown */}
      <select value={viceCaptainId} onChange={(e) => setViceCaptainId(e.target.value)}>
        {mySquad.map(player => (
          <option value={player.real_player_id}>{player.player_name}</option>
        ))}
      </select>
    </div>
    
    <button onClick={saveCaptains} disabled={isSavingCaptains || captainId === originalCaptainId && viceCaptainId === originalViceCaptainId}>
      Save Changes
    </button>
  </div>
)}
```

#### Tab 3: Team Affiliation (NEW)
```tsx
{activeTab === 'team' && (
  <div>
    <h2>Change Supported Team</h2>
    <p>Select which real team you support for passive points</p>
    
    <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
      <option value="">Select a team...</option>
      {realTeams.map(team => (
        <option key={team.team_id} value={team.team_id}>{team.team_name}</option>
      ))}
    </select>
    
    {myTeam?.supported_team_name && (
      <div className="current">
        Currently supporting: {myTeam.supported_team_name}
      </div>
    )}
    
    <button onClick={changeTeamAffiliation} disabled={isSavingTeam || selectedTeamId === myTeam?.supported_team_id}>
      Change Team
    </button>
  </div>
)}
```

---

### 2. Update My Team Page

**File:** `/app/dashboard/team/fantasy/my-team/page.tsx`

**Change:**
- Remove the entire "Captain Selection" section (lines 351-421)
- Keep the badges showing current captain/VC in the player list (lines 447-456)
- Add a note: "To change captain/VC, use the transfer window"

**Keep:**
```tsx
{player.is_captain && (
  <span className="badge">👑 C</span>
)}
{player.is_vice_captain && (
  <span className="badge">⭐ VC</span>
)}
```

**Remove:**
```tsx
{/* Captain Selection section - DELETE THIS ENTIRE BLOCK */}
<div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
  <div className="flex items-center justify-between mb-4">
    <h2>Captain & Vice-Captain</h2>
    <button onClick={saveCaptains}>Save Selection</button>
  </div>
  {/* ... dropdowns ... */}
</div>
```

---

### 3. Verify APIs

**Existing APIs that should work:**
- ✅ `/api/fantasy/squad/set-captain` - Updates captain/VC
- ✅ `/api/fantasy/teams/select-supported` - Changes supported team

**No new APIs needed!** The existing endpoints work fine during transfer windows.

---

## Testing Checklist

### Draft Flow:
- [  ] Complete draft by selecting all players
- [  ] Captain/VC selection UI appears
- [  ] Can select captain and vice-captain
- [  ] Cannot select same player for both
- [  ] "Complete Draft" button saves successfully

### Transfer Window - Players Tab:
- [  ] Can swap players as before
- [  ] Transfers count towards limit
- [  ] Point penalties apply

### Transfer Window - Captains Tab:
- [  ] Current captain/VC shown
- [  ] Can change both selections
- [  ] Save button disabled if no changes
- [  ] Changes persist after save

### Transfer Window - Team Tab:
- [  ] Current supported team shown
- [  ] Can select new team from dropdown
- [  ] Save button disabled if no changes
- [  ] Team change persists

### My Team Page:
- [  ] Captain/VC badges still show
- [  ] No edit capability (dropdowns removed)
- [  ] Message directs to transfer window

---

## Files Modified

1. ✅ `/app/dashboard/team/fantasy/draft/page.tsx` - Added captain selection
2. 🔄 `/app/dashboard/team/fantasy/transfers/page.tsx` - Needs tab UI added
3. 🔄 `/app/dashboard/team/fantasy/my-team/page.tsx` - Needs captain edit removed

---

## Next Steps

Would you like me to:
1. **Add the tab UI to transfers page** (big chunk of JSX)
2. **Clean up the my-team page** (remove captain selection section)
3. **Create a complete working transfers page file** (full rewrite)

Choose which part you'd like me to implement next!
