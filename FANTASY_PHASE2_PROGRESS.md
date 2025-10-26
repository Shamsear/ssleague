# Fantasy League Phase 2: Registration Flow Updates - IN PROGRESS

## ✅ What's Been Done

### 1. API Route Updated
**File:** `app/api/seasons/[id]/register/route.ts`

✅ **Changes Made:**
- Added `managerName` and `joinFantasy` parameters to request body
- Added manager_name field to team update (line 178)
- Added fantasy participation fields to team update (lines 180-183)
- Added manager_name to new team creation (line 249)
- Added fantasy_participating, fantasy_joined_at, fantasy_league_id to new team creation (lines 252-257)
- Added fantasy points tracking fields (player_points, team_bonus_points, total_points) to new team creation (lines 255-257)

### 2. Registration Page State Added
**File:** `app/register/team/page.tsx`

✅ **Changes Made:**
- Added state for showing registration form modal (line 31)
- Added state for manager name (line 32)
- Added state for fantasy opt-in checkbox (line 33)
- Updated handleDecision to show form instead of direct confirmation for "join" action (lines 133-136)

---

## 🚧 What Still Needs to be Done

### 1. Create Registration Form Modal
**Location:** `app/register/team/page.tsx`

Need to add a modal component that shows when user clicks "Join Season". The modal should include:

**Form Fields:**
```tsx
<div className="modal">
  <h3>Complete Your Registration</h3>
  
  <div className="form-group">
    <label>Manager Name</label>
    <input 
      type="text"
      value={managerName}
      onChange={(e) => setManagerName(e.target.value)}
      placeholder="Enter manager name"
      required
    />
    <small>This is for internal records only (not displayed publicly)</small>
  </div>
  
  <div className="form-group">
    <label>
      <input 
        type="checkbox"
        checked={joinFantasy}
        onChange={(e) => setJoinFantasy(e.target.checked)}
      />
      Join Fantasy League (Optional)
    </label>
    <p>Participate in the fantasy league system where you draft players and earn points based on their performance!</p>
  </div>
  
  <div className="actions">
    <button onClick={handleSubmitRegistration}>Confirm & Join</button>
    <button onClick={() => setShowRegistrationForm(false)}>Cancel</button>
  </div>
</div>
```

### 2. Create handleSubmitRegistration Function
**Location:** `app/register/team/page.tsx`

Need to create a function that:
1. Validates manager name (required)
2. Submits to API with manager name and fantasy opt-in
3. Shows success/error messages
4. Redirects to dashboard

```typescript
const handleSubmitRegistration = async () => {
  if (!managerName.trim()) {
    showAlert({
      type: 'error',
      title: 'Required Field',
      message: 'Please enter a manager name'
    });
    return;
  }

  setIsSubmitting(true);

  try {
    const response = await fetch(`/api/seasons/${seasonId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        userId: user!.uid,
        managerName: managerName.trim(),
        joinFantasy: joinFantasy
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Registration failed');
    }

    showAlert({
      type: 'success',
      title: 'Success',
      message: `Successfully joined ${season.name}!${joinFantasy ? ' You are now part of the fantasy league!' : ''}`
    });

    setTimeout(() => router.push('/dashboard/team'), 1500);
  } catch (err) {
    console.error('Error:', err);
    showAlert({
      type: 'error',
      title: 'Error',
      message: 'An error occurred. Please try again.'
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

### 3. Update API decline endpoint
**Location:** `app/api/seasons/[id]/register/route.ts`

Currently the decline logic is still in the old if/else block (line 184-209). It needs to be moved out to handle decline action properly without the modal.

### 4. Add Modal Styling
Need to add a modal component or use an existing one to show the registration form overlay.

---

## 📋 Complete Implementation Example

Here's the complete modal component to add:

```tsx
{/* Registration Form Modal - Add this above the existing AlertModal and ConfirmModal */}
{showRegistrationForm && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative">
      <button
        onClick={() => setShowRegistrationForm(false)}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Complete Your Registration
        </h3>
        <p className="text-gray-600 text-sm">
          Just a few more details to join {season.name}
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmitRegistration(); }} className="space-y-6">
        {/* Manager Name Field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Manager Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="Enter your name"
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            For internal records only (not displayed publicly)
          </p>
        </div>

        {/* Fantasy League Opt-in */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border-2 border-purple-200">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={joinFantasy}
              onChange={(e) => setJoinFantasy(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <div className="ml-3">
              <span className="text-sm font-semibold text-purple-900 block mb-1">
                🏆 Join Fantasy League (Optional)
              </span>
              <p className="text-xs text-purple-700">
                Draft players, set weekly lineups, earn points based on performance, and compete for the championship!
              </p>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowRegistrationForm(false)}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !managerName.trim()}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Joining...' : 'Confirm & Join'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

---

## 🎯 Testing Checklist

Once implementation is complete, test:

- [ ] Manager name field appears in registration modal
- [ ] Manager name is required (can't submit empty)
- [ ] Fantasy opt-in checkbox works
- [ ] Manager name gets saved to Firebase teams collection
- [ ] Fantasy participation status saves correctly
- [ ] Form validation works
- [ ] Cancel button closes modal
- [ ] Success message shows after registration
- [ ] User redirects to dashboard after success
- [ ] Decline button still works (skips the form)

---

## 📁 Files Modified

1. ✅ `app/api/seasons/[id]/register/route.ts` - API updated
2. 🚧 `app/register/team/page.tsx` - Partially updated (needs modal component)

---

## Next Step

Add the registration form modal component and handleSubmitRegistration function to `app/register/team/page.tsx`, then test the complete flow.

**Status:** ⚠️ Phase 2 - 70% Complete
**Remaining:** Add modal UI and submission handler
