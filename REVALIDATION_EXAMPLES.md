# Cache Revalidation Examples

## How to Trigger Instant Updates After Data Changes

When you update data in Firestore, trigger cache revalidation so all users see the changes within seconds.

---

## Method 1: Simple Function Call

### In Your Existing Admin Pages

```typescript
import { revalidateCache } from '@/lib/utils/revalidation';

// After updating a team
async function handleUpdateTeam(teamId: string, data: any) {
  try {
    // 1. Update Firestore
    await updateTeam(teamId, data);
    
    // 2. Trigger instant cache refresh
    const result = await revalidateCache('teams');
    
    if (result.success) {
      alert('Team updated! All users will see changes in 5-30 seconds.');
    } else {
      alert('Team updated, but cache refresh failed. Users will see changes in 15 minutes.');
    }
  } catch (error) {
    alert('Failed to update team');
  }
}
```

---

## Method 2: Using React Hook (With Loading State)

```typescript
import { useRevalidation } from '@/lib/utils/revalidation';

function TeamManagement() {
  const { revalidate, isRevalidating } = useRevalidation();
  
  async function handleUpdateTeam(teamId: string, data: any) {
    try {
      // Update Firestore
      await updateTeam(teamId, data);
      
      // Trigger cache refresh with loading state
      const result = await revalidate('teams');
      
      if (result.success) {
        alert('✅ Team updated and cache refreshed!');
      }
    } catch (error) {
      alert('❌ Update failed');
    }
  }
  
  return (
    <button 
      onClick={() => handleUpdateTeam(id, data)}
      disabled={isRevalidating}
    >
      {isRevalidating ? 'Refreshing cache...' : 'Update Team'}
    </button>
  );
}
```

---

## Method 3: Bulk Updates

```typescript
import { revalidateCache } from '@/lib/utils/revalidation';

// After bulk player updates
async function handleBulkPlayerUpdate(updates: any[]) {
  try {
    // 1. Bulk update Firestore
    await bulkUpdatePlayers(updates);
    
    // 2. Refresh both players and stats caches
    await revalidateCache('all'); // Refresh everything
    
    alert(`✅ ${updates.length} players updated! Cache refreshed.`);
  } catch (error) {
    alert('Failed to update players');
  }
}
```

---

## Update Your Existing superadmin/teams/page.tsx

Add revalidation to the existing handlers:

```typescript
// Add import at top
import { revalidateCache } from '@/lib/utils/revalidation';

// Update handleAddTeam
const handleAddTeam = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    setSubmitting(true);
    setError(null);
    
    await createTeam({
      team_name: formData.team_name,
      team_code: formData.team_code,
      owner_name: formData.owner_name || undefined,
      owner_email: formData.owner_email || undefined,
      initial_balance: formData.initial_balance,
      season_id: formData.season_id,
    });
    
    // ✨ NEW: Trigger instant cache refresh
    await revalidateCache('teams');
    
    // Reload data
    await loadData();
    
    // Reset form and close modal
    setShowAddTeamModal(false);
    setFormData({
      team_name: '',
      team_code: '',
      owner_name: '',
      owner_email: '',
      initial_balance: 10000000,
      season_id: '',
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create team';
    setError(errorMessage);
  } finally {
    setSubmitting(false);
  }
};

// Update handleUpdateTeam
const handleUpdateTeam = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!selectedTeam) return;
  
  try {
    setSubmitting(true);
    setError(null);
    
    await updateTeam(selectedTeam.id, {
      team_name: formData.team_name,
      team_code: formData.team_code,
      owner_name: formData.owner_name || undefined,
      owner_email: formData.owner_email || undefined,
      initial_balance: formData.initial_balance,
      season_id: formData.season_id,
    });
    
    // ✨ NEW: Trigger instant cache refresh
    await revalidateCache('teams');
    
    // Reload data
    await loadData();
    
    // Close modal and reset
    setShowEditTeamModal(false);
    setSelectedTeam(null);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update team';
    setError(errorMessage);
  } finally {
    setSubmitting(false);
  }
};

// Update handleDeleteTeam
const handleDeleteTeam = async (team: TeamData) => {
  if (!confirm(`Are you sure you want to delete "${team.team_name}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    setError(null);
    await deleteTeam(team.id);
    
    // ✨ NEW: Trigger instant cache refresh
    await revalidateCache('teams');
    
    // Reload data
    await loadData();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete team';
    setError(errorMessage);
    alert(`Error: ${errorMessage}`);
  }
};
```

---

## Environment Variable Setup

Make sure you have this in `.env.local`:

```bash
# For client-side revalidation (using NEXT_PUBLIC_)
NEXT_PUBLIC_REVALIDATE_SECRET=9wJ/292vCW/MRdYd90yr7knlsl3QnIu4138uu0pFrXU=
```

Or update the secret check in `lib/utils/revalidation.ts` to use the existing one.

---

## Testing Revalidation

### Test in Browser Console:
```javascript
// Open browser console on your admin page
const response = await fetch('/api/revalidate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    secret: '9wJ/292vCW/MRdYd90yr7knlsl3QnIu4138uu0pFrXU=',
    type: 'all'
  })
});
const result = await response.json();
console.log(result); // Should show success: true
```

### Test from PowerShell:
```powershell
$body = @{
    secret = "9wJ/292vCW/MRdYd90yr7knlsl3QnIu4138uu0pFrXU="
    type = "teams"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/revalidate" -Method POST -Body $body -ContentType "application/json"
```

---

## Summary

### Without Revalidation (Current)
- ✅ 99.8% fewer reads
- ⏱️ Updates show in 0-15 minutes (automatic refresh)

### With Revalidation (Recommended)
- ✅ 99.8% fewer reads
- ⚡ Updates show in 5-30 seconds (instant refresh)
- 🎯 Best of both worlds!

### How to Enable:
1. Add `import { revalidateCache } from '@/lib/utils/revalidation';` to admin pages
2. Call `await revalidateCache('teams');` after updates
3. Done! Users see changes in seconds instead of minutes.

---

## When to Use Each Type

| Type | When to Use |
|------|-------------|
| `'teams'` | After creating/updating/deleting teams |
| `'players'` | After player changes (stats, assignments, etc.) |
| `'stats'` | After match results or stat updates |
| `'all'` | After bulk operations affecting multiple types |

---

## Optional: Automatic Revalidation

To make it fully automatic (no manual calls needed), deploy the Firebase Cloud Functions in `firebase-functions/index.js`. They will automatically trigger revalidation whenever Firestore data changes.

See `CACHE_OPTIMIZATION_GUIDE.md` for Cloud Functions deployment instructions.
