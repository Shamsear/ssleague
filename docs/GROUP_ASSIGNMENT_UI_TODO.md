# Manual Group Assignment UI - Implementation Guide

## ✅ Completed
1. Database schema - `tournament_team_groups` table created
2. Database field - `group_assignment_mode` added to tournaments table  
3. API endpoints - `/api/tournaments/[id]/groups` (GET, POST, DELETE)
4. Form UI - Radio buttons for auto/manual mode in tournament forms
5. Fixture generation - Checks manual assignments before generating

## 🔧 To Implement

### 1. Add "Manage Groups" Button in Teams Tab
**File**: `app/dashboard/committee/team-management/tournament/page.tsx`
**Location**: After line 1154 (after "Save Team Assignments" button)

Add conditional button that shows when tournament has `has_group_stage: true` and `group_assignment_mode: 'manual'`:

```tsx
{/* Manage Groups Button - only for group stage tournaments with manual mode */}
{selectedTournamentForTeams && 
 tournaments.find(t => t.id === selectedTournamentForTeams)?.has_group_stage &&
 tournaments.find(t => t.id === selectedTournamentForTeams)?.group_assignment_mode === 'manual' && (
  <button
    onClick={() => setShowGroupAssignmentModal(true)}
    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:shadow-lg transition-all font-medium inline-flex items-center gap-2"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
    Manage Groups
  </button>
)}
```

### 2. Add State for Group Assignment Modal
Add to component state (around line 50-100):

```tsx
const [showGroupAssignmentModal, setShowGroupAssignmentModal] = useState(false);
const [groupAssignments, setGroupAssignments] = useState<{[teamId: string]: string}>({});
const [unassignedTeams, setUnassignedTeams] = useState<any[]>([]);
const [isLoadingGroups, setIsLoadingGroups] = useState(false);
const [isSavingGroups, setIsSavingGroups] = useState(false);
```

### 3. Create Load Groups Function
```tsx
const loadGroupAssignments = async (tournamentId: string) => {
  setIsLoadingGroups(true);
  try {
    const res = await fetchWithTokenRefresh(`/api/tournaments/${tournamentId}/groups`);
    const data = await res.json();
    
    if (data.success) {
      // Convert assignments array to map
      const assignmentMap: {[teamId: string]: string} = {};
      data.assignments.forEach((a: any) => {
        assignmentMap[a.team_id] = a.group_name;
      });
      
      setGroupAssignments(assignmentMap);
      setUnassignedTeams(data.unassignedTeams || []);
    }
  } catch (error) {
    console.error('Error loading group assignments:', error);
    showAlert({
      type: 'error',
      title: 'Error',
      message: 'Failed to load group assignments'
    });
  } finally {
    setIsLoadingGroups(false);
  }
};
```

### 4. Create Save Groups Function
```tsx
const handleSaveGroupAssignments = async () => {
  if (!selectedTournamentForTeams) return;
  
  setIsSavingGroups(true);
  try {
    // Convert map to array
    const assignments = Object.entries(groupAssignments).map(([team_id, group_name]) => ({
      team_id,
      group_name
    }));
    
    const res = await fetchWithTokenRefresh(`/api/tournaments/${selectedTournamentForTeams}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showAlert({
        type: 'success',
        title: 'Groups Saved',
        message: `${assignments.length} teams assigned to groups`
      });
      setShowGroupAssignmentModal(false);
    } else {
      showAlert({
        type: 'error',
        title: 'Save Failed',
        message: data.error || 'Failed to save group assignments'
      });
    }
  } catch (error: any) {
    showAlert({
      type: 'error',
      title: 'Error',
      message: 'Failed to save group assignments: ' + error.message
    });
  } finally {
    setIsSavingGroups(false);
  }
};
```

### 5. Create Group Assignment Modal Component
Add after the Teams tab content (around line 1169):

```tsx
{/* Group Assignment Modal */}
{showGroupAssignmentModal && selectedTournamentForTeams && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            👥 Assign Teams to Groups
          </h2>
          <button
            onClick={() => setShowGroupAssignmentModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingGroups ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Generate groups based on number_of_groups */}
            {Array.from({ length: tournaments.find(t => t.id === selectedTournamentForTeams)?.number_of_groups || 4 }, (_, i) => {
              const groupName = String.fromCharCode(65 + i); // A, B, C, D...
              const teamsInGroup = Object.entries(groupAssignments)
                .filter(([_, group]) => group === groupName)
                .map(([teamId]) => tournamentTeams.find(t => t.team_id === teamId))
                .filter(Boolean);
              
              return (
                <div key={groupName} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {groupName}
                    </span>
                    Group {groupName}
                  </h3>
                  
                  <div className="space-y-2 min-h-[200px]">
                    {teamsInGroup.map((team: any) => (
                      <div key={team.team_id} className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{team.team_name}</span>
                        <button
                          onClick={() => {
                            const newAssignments = {...groupAssignments};
                            delete newAssignments[team.team_id];
                            setGroupAssignments(newAssignments);
                          }}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    
                    {teamsInGroup.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No teams assigned
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unassigned Teams */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <h3 className="font-bold text-gray-900 mb-3">
              📦 Unassigned Teams ({Object.keys(groupAssignments).length} / {tournamentTeams.length} assigned)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {tournamentTeams
                .filter((team: any) => !groupAssignments[team.team_id])
                .map((team: any) => (
                  <div key={team.team_id} className="relative">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setGroupAssignments({
                            ...groupAssignments,
                            [team.team_id]: e.target.value
                          });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:border-blue-400 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{team.team_name}</option>
                      {Array.from({ length: tournaments.find(t => t.id === selectedTournamentForTeams)?.number_of_groups || 4 }, (_, i) => (
                        <option key={i} value={String.fromCharCode(65 + i)}>
                          → Group {String.fromCharCode(65 + i)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={async () => {
            const confirmed = await showConfirm({
              type: 'warning',
              title: 'Clear All Assignments',
              message: 'Remove all teams from their groups?',
              confirmText: 'Clear',
              cancelText: 'Cancel'
            });
            
            if (confirmed) {
              setGroupAssignments({});
            }
          }}
          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium"
        >
          Clear All
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowGroupAssignmentModal(false)}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveGroupAssignments}
            disabled={isSavingGroups}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isSavingGroups ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Save Groups
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 6. Load Groups When Modal Opens
Add useEffect to load groups when modal opens:

```tsx
useEffect(() => {
  if (showGroupAssignmentModal && selectedTournamentForTeams) {
    loadGroupAssignments(selectedTournamentForTeams);
  }
}, [showGroupAssignmentModal, selectedTournamentForTeams]);
```

## Summary
The implementation provides:
- Visual group columns (A, B, C, D...) based on `number_of_groups`
- Unassigned teams pool at the bottom
- Dropdown selectors to assign teams to groups
- Remove buttons to unassign teams
- Save/Cancel/Clear All actions
- Loading and saving states

This creates an intuitive drag-and-drop-like experience using dropdown selections.
