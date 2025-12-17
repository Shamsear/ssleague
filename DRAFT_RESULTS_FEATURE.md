# Draft Results Feature

## Overview
Added a "Save as Draft" feature for fixture results that allows teams to save their results without triggering any calculations, salary deductions, or status changes.

## Changes Made

### 1. New API Endpoint
**File**: `app/api/fixtures/[fixtureId]/draft-results/route.ts`

- **Method**: PUT
- **Purpose**: Save fixture results as draft
- **What it does**:
  - Saves match goals to matchups table
  - Updates fixture scores and MOTM
  - Does NOT change fixture status to "completed"
  - Does NOT trigger salary deductions
  - Does NOT trigger player points calculations
  - Does NOT trigger fantasy points calculations
  - Does NOT trigger team stats updates

### 2. Frontend Changes
**File**: `app/dashboard/team/fixture/[fixtureId]/page.tsx`

- Added "💾 Save as Draft" button next to "Save Results" button
- Blue gradient styling to differentiate from submit button
- Validates all results are entered before saving
- Shows success message after saving
- Reloads page to show updated draft data

### 3. Duplicate Prevention Fix
**File**: `app/api/realplayers/update-points/route.ts`

- Added check for existing salary transactions before deducting
- Prevents duplicate salary deductions when results are edited
- Logs when skipping deductions due to existing transactions

## How It Works

### Save as Draft Flow:
1. User enters match results
2. Clicks "💾 Save as Draft"
3. Results are saved to database
4. Scores are calculated and displayed
5. **NO** calculations or deductions happen
6. User can edit and save draft multiple times

### Submit Results Flow:
1. User enters match results (or loads from draft)
2. Clicks "Save Results"
3. Results are saved to database
4. Fixture status changes to "completed"
5. Salary deductions happen (only once, checked)
6. Player points are calculated
7. Fantasy points are calculated
8. Team stats are updated

## Benefits

1. **No Pressure**: Teams can save partial work without consequences
2. **No Duplicates**: Salary deductions only happen once on first submit
3. **Flexibility**: Teams can review and edit before final submission
4. **Safety**: Draft saves don't affect standings, budgets, or stats

## Usage

1. Navigate to fixture page during result entry phase
2. Enter match results
3. Click "💾 Save as Draft" to save without submitting
4. Edit as needed and save draft again
5. When ready, click "Save Results" to finalize

## Technical Notes

- Draft saves update `matchups` table with goals
- Draft saves update `fixtures` table with scores and MOTM
- Draft saves do NOT change `status` field
- Submit checks for existing transactions to prevent duplicates
- All calculations only happen on final submit, not on draft saves
