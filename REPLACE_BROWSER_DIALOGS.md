# Replace Browser Dialogs with Custom Modals

## Overview

This guide shows how to replace native browser dialogs (`alert`, `confirm`, `prompt`) with custom React modals throughout the application.

## Components Created

1. **`AlertModal`** - Replaces `alert()`
2. **`ConfirmModal`** - Replaces `confirm()`
3. **`PromptModal`** - Replaces `prompt()`
4. **`useModal` hook** - Easy integration

---

## How to Use

### Step 1: Import Components and Hook

```tsx
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import PromptModal from '@/components/modals/PromptModal';
```

### Step 2: Initialize Hook

```tsx
const {
  alertState,
  showAlert,
  closeAlert,
  confirmState,
  showConfirm,
  closeConfirm,
  handleConfirm,
  promptState,
  showPrompt,
  closePrompt,
  handlePromptConfirm,
} = useModal();
```

### Step 3: Add Modal Components to JSX

```tsx
return (
  <>
    {/* Your page content */}
    <div>...</div>

    {/* Modal Components */}
    <AlertModal
      isOpen={alertState.isOpen}
      onClose={closeAlert}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
    />

    <ConfirmModal
      isOpen={confirmState.isOpen}
      onConfirm={handleConfirm}
      onCancel={closeConfirm}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      type={confirmState.type}
    />

    <PromptModal
      isOpen={promptState.isOpen}
      onConfirm={handlePromptConfirm}
      onCancel={closePrompt}
      title={promptState.title}
      message={promptState.message}
      placeholder={promptState.placeholder}
      defaultValue={promptState.defaultValue}
      confirmText={promptState.confirmText}
      cancelText={promptState.cancelText}
    />
  </>
);
```

---

## Replacement Examples

### Replace `alert()`

**Before:**
```tsx
alert('Player assigned successfully!');
```

**After:**
```tsx
showAlert({
  type: 'success',
  message: 'Player assigned successfully!'
});
```

**With custom title:**
```tsx
showAlert({
  type: 'error',
  title: 'Upload Failed',
  message: 'Please upload a CSV or Excel file'
});
```

### Replace `confirm()`

**Before:**
```tsx
if (!confirm('Are you sure you want to delete this bid?')) return;
// Do something
```

**After:**
```tsx
const confirmed = await showConfirm({
  type: 'danger',
  title: 'Delete Bid',
  message: 'Are you sure you want to delete this bid?',
  confirmText: 'Delete',
  cancelText: 'Cancel'
});

if (!confirmed) return;
// Do something
```

**Or with then/catch:**
```tsx
showConfirm({
  type: 'danger',
  message: 'Are you sure you want to delete ALL fixtures?',
  confirmText: 'Delete All'
}).then(confirmed => {
  if (confirmed) {
    // Delete fixtures
  }
});
```

### Replace `prompt()`

**Before:**
```tsx
const reason = window.prompt('Enter reason for editing result:');
if (reason === null) return; // User cancelled
// Use reason
```

**After:**
```tsx
const reason = await showPrompt({
  title: 'Edit Reason',
  message: 'Enter reason for editing result:',
  placeholder: 'Reason...',
  defaultValue: ''
});

if (!reason) return; // User cancelled or empty
// Use reason
```

---

## Alert Types

### Success Alert
```tsx
showAlert({
  type: 'success',
  title: 'Success',
  message: 'Operation completed successfully!'
});
```

### Error Alert
```tsx
showAlert({
  type: 'error',
  title: 'Error',
  message: 'Failed to save data. Please try again.'
});
```

### Warning Alert
```tsx
showAlert({
  type: 'warning',
  title: 'Warning',
  message: 'This action cannot be undone!'
});
```

### Info Alert
```tsx
showAlert({
  type: 'info',
  title: 'Information',
  message: 'Please wait while we process your request.'
});
```

---

## Confirm Types

### Danger Confirm (Red)
```tsx
showConfirm({
  type: 'danger',
  title: 'Delete Fixture',
  message: 'This action cannot be undone!',
  confirmText: 'Delete',
  cancelText: 'Cancel'
});
```

### Warning Confirm (Yellow)
```tsx
showConfirm({
  type: 'warning',
  title: 'Clear All Bids',
  message: 'Are you sure you want to clear all bids?',
  confirmText: 'Clear',
  cancelText: 'Cancel'
});
```

### Info Confirm (Blue)
```tsx
showConfirm({
  type: 'info',
  title: 'Start Round',
  message: 'Start Round 1 now?',
  confirmText: 'Start',
  cancelText: 'Cancel'
});
```

---

## Complete Example

Here's a complete example replacing dialogs in a page:

```tsx
'use client';

import { useState } from 'react';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import PromptModal from '@/components/modals/PromptModal';

export default function ExamplePage() {
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
    promptState,
    showPrompt,
    closePrompt,
    handlePromptConfirm,
  } = useModal();

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      // Delete logic here
      await deleteItem();
      
      showAlert({
        type: 'success',
        message: 'Item deleted successfully!'
      });
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete item. Please try again.'
      });
    }
  };

  const handleEdit = async () => {
    const reason = await showPrompt({
      title: 'Edit Reason',
      message: 'Enter reason for editing:',
      placeholder: 'Reason...'
    });

    if (!reason) return; // Cancelled

    try {
      // Edit logic with reason
      await editItem(reason);
      
      showAlert({
        type: 'success',
        message: 'Item updated successfully!'
      });
    } catch (error) {
      showAlert({
        type: 'error',
        message: 'Failed to update item.'
      });
    }
  };

  return (
    <>
      <div>
        <button onClick={handleDelete}>Delete</button>
        <button onClick={handleEdit}>Edit</button>
      </div>

      {/* Modals */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />

      <PromptModal
        isOpen={promptState.isOpen}
        onConfirm={handlePromptConfirm}
        onCancel={closePrompt}
        title={promptState.title}
        message={promptState.message}
        placeholder={promptState.placeholder}
        defaultValue={promptState.defaultValue}
        confirmText={promptState.confirmText}
        cancelText={promptState.cancelText}
      />
    </>
  );
}
```

---

## Files to Update

Based on the search, these files use browser dialogs and should be updated:

### Team Dashboard Files
- [ ] `app/dashboard/team/statistics/page.tsx` - 1 alert
- [ ] `app/dashboard/team/round/[id]/page.tsx` - 3 alerts, 1 confirm
- [ ] `app/dashboard/team/RegisteredTeamDashboard.tsx` - 2 confirms, 2 alerts
- [ ] `app/dashboard/team/profile/edit/page.tsx` - 1 alert
- [ ] `app/dashboard/team/OptimizedDashboard.tsx` - 2 confirms, 2 alerts
- [ ] `app/dashboard/team/fixture/[fixtureId]/page.tsx` - ~15 alerts, ~1 confirm

### Committee Dashboard Files
- [ ] `app/dashboard/committee/tiebreakers/page.tsx` - 1 confirm, 3 alerts
- [ ] `app/dashboard/committee/team-management/tournament/page.tsx` - 6 alerts, 2 confirms
- [ ] `app/dashboard/committee/team-management/team-members/page.tsx` - 8 alerts
- [ ] `app/dashboard/committee/team-management/match-days/page.tsx` - ~10 alerts, 2 confirms
- [ ] `app/dashboard/committee/team-management/fixture/[fixtureId]/page.tsx` - 4 alerts, 3 confirms, 1 prompt

---

## Benefits

✅ **Better UX**: Custom styled modals matching your design system
✅ **More Control**: Custom buttons, colors, icons
✅ **Accessibility**: Keyboard support (ESC to close)
✅ **Consistent**: Same look across all dialogs
✅ **Flexible**: Easy to add animations, custom styling
✅ **Type-safe**: Full TypeScript support

---

## Next Steps

1. ✅ Modal components created
2. ✅ Hook created
3. ✅ Documentation created
4. 🔲 Update pages one by one (start with high-priority pages)
5. 🔲 Test thoroughly
6. 🔲 Remove browser dialog usage

---

**Start with the most important pages first** (e.g., fixture submission, tournament management) and gradually replace all browser dialogs.
