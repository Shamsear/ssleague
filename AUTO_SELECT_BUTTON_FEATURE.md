# Auto-Select Button Feature

## Overview
Added "Auto-Select Lineup" and "Clear" buttons to the lineup submission interface for quick and easy lineup management.

## Features Added

### 1. Auto-Select Lineup Button
- **Icon**: ⚡ (Lightning bolt)
- **Color**: Purple gradient
- **Function**: Instantly fills the lineup with optimal player selection

**Smart Selection Logic**:
- **5 players**: All selected as starters, no substitutes
- **6-7 players**: 
  - First 5 as starters
  - Remaining as substitutes (max 2)
  - Respects category requirements if enabled
  - Falls back to order-based selection if no requirements

### 2. Clear Button
- **Icon**: 🗑️ (Trash can)
- **Color**: Gray gradient
- **Function**: Resets all selections (clears starters and substitutes)
- **State**: Disabled when no players are selected

## User Interface

### Button Placement
Located between the validation summary and the player selection area, providing easy access before manual selection.

### Visual Feedback
- **5-player teams**: Blue info box explaining automatic selection
- **6-7 player teams**: Purple tip box suggesting the auto-select button
- Both buttons have hover effects and disabled states

### Responsive Design
- Buttons adapt to screen size (mobile/desktop)
- Text and icons scale appropriately
- Touch-friendly on mobile devices

## Use Cases

### Quick Lineup Creation
1. Team manager opens lineup page
2. Clicks "Auto-Select Lineup"
3. Reviews auto-selected players
4. Makes adjustments if needed
5. Submits lineup

### Reset and Retry
1. Team makes manual selections
2. Realizes they want to start over
3. Clicks "Clear" button
4. Starts fresh or uses auto-select

### Category-Aware Selection
When category requirements are enabled:
1. Auto-select prioritizes meeting minimum category requirements
2. Fills remaining spots with available players
3. Ensures valid lineup according to tournament rules

## Technical Implementation

### Auto-Select Algorithm
```typescript
1. Check if editable and roster exists
2. If 5 players → all as starters
3. If 6-7 players:
   a. If category requirements enabled:
      - Group players by category
      - Fill required categories first
      - Fill remaining with any players
   b. If no requirements:
      - Take first 5 as starters
   c. Remaining players as subs (max 2)
4. Update state with selections
```

### Clear Function
```typescript
1. Check if editable
2. Set startingXI to empty array
3. Set substitutes to empty array
```

## Benefits

1. **Speed**: Instant lineup creation vs manual selection
2. **Accuracy**: Respects tournament rules and category requirements
3. **Flexibility**: Can auto-select then adjust, or clear and start over
4. **User-Friendly**: Clear visual feedback and intuitive controls
5. **Accessibility**: Works on all devices and screen sizes

## Button States

### Auto-Select Button
- **Enabled**: When lineup is editable and roster has players
- **Disabled**: Never (always available when editable)

### Clear Button
- **Enabled**: When at least one player is selected
- **Disabled**: When no players are selected (grayed out)

## Visual Design

### Auto-Select Button
- Background: Purple gradient (500-600)
- Hover: Darker purple (600-700)
- Shadow: Medium shadow with hover lift effect
- Icon: Lightning bolt (⚡)

### Clear Button
- Background: Gray gradient (400-500)
- Hover: Darker gray (500-600)
- Disabled: Light gray (300-400)
- Shadow: Medium shadow (none when disabled)
- Icon: Trash can (🗑️)

## Integration with Existing Features

### Works With
- ✅ Category requirements validation
- ✅ Squad size settings
- ✅ Substitute limits
- ✅ Deadline checking
- ✅ Lock status
- ✅ Draft saving
- ✅ Lineup submission

### Respects
- ✅ Tournament settings
- ✅ Team roster
- ✅ Player availability
- ✅ Edit permissions
- ✅ Validation rules

## Testing Scenarios

1. **5-player team**: Auto-select fills all 5 as starters
2. **6-player team**: Auto-select fills 5 starters + 1 sub
3. **7-player team**: Auto-select fills 5 starters + 2 subs
4. **With category requirements**: Auto-select meets requirements
5. **Clear after selection**: All players removed from lineup
6. **Clear when empty**: Button is disabled
7. **After deadline**: Buttons not shown (not editable)
8. **Locked lineup**: Buttons not shown (not editable)

## User Feedback

### Info Messages
- 5-player teams: "Your team has exactly 5 players. All players have been automatically selected as starters."
- 6-7 player teams: "💡 Tip: Use the 'Auto-Select Lineup' button below to quickly fill your lineup..."

### Button Labels
- Auto-Select: "⚡ Auto-Select Lineup"
- Clear: "🗑️ Clear"

## Future Enhancements (Optional)

1. **Smart Selection**: AI-based selection considering player ratings
2. **Formation Presets**: Save and load favorite formations
3. **Undo/Redo**: Step back through selection changes
4. **Drag & Drop**: Reorder players visually
5. **Quick Swap**: One-click swap between starter and sub
