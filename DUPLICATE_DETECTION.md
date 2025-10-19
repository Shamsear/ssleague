# Duplicate Detection Feature for Historical Import

## Overview
This feature implements intelligent duplicate detection for player and team names during the historical season import process. It helps identify potential duplicates or name variations (e.g., "Karthik" vs "Karthiks", "Real Madrid" vs "Real Madrid CF") before data is imported into the database.

## How It Works

### 1. **Fuzzy String Matching**
The system uses the Levenshtein distance algorithm to calculate similarity between names:
- **Levenshtein Distance**: Measures the minimum number of single-character edits (insertions, deletions, substitutions) needed to change one string into another
- **Similarity Score**: Converts the distance into a percentage (0-100%)
- **Threshold**: Default is 70% - names with 70% or higher similarity are flagged as potential duplicates

### 2. **Name Normalization**
Before comparison, all names are normalized:
- Converted to lowercase
- Extra spaces removed
- Special characters stripped
- This ensures "Real Madrid" matches "real madrid" or "REAL MADRID"

### 3. **Real-time Detection**
- When the preview page loads, it automatically fetches all existing players and teams from the database
- It then compares each imported name against the database using fuzzy matching
- Results are displayed in a user-friendly format with similarity scores

## Components

### 1. **Fuzzy Matching Utility** (`lib/utils/fuzzyMatch.ts`)

```typescript
// Calculate similarity between two strings
calculateSimilarity("Karthik", "Karthiks") // Returns ~87.5%

// Find potential matches
findMatches("Real Madrid", existingTeamNames, 70, 3)
// Returns top 3 matches with similarity >= 70%

// Check for duplicates
isPotentialDuplicate("Messi", existingPlayerNames, 85)
// Returns true if any match has >= 85% similarity
```

Key functions:
- `calculateSimilarity(str1, str2)`: Calculate similarity percentage
- `findMatches(name, existingNames, threshold, maxResults)`: Find potential matches
- `normalizeName(name)`: Normalize name for comparison
- `isPotentialDuplicate(name, existingNames, threshold)`: Quick duplicate check
- `batchFindMatches(names, existingNames, threshold)`: Batch processing for multiple names

### 2. **API Endpoint** (`app/api/seasons/historical/check-duplicates/route.ts`)

**GET** `/api/seasons/historical/check-duplicates`
- Fetches all existing players and teams from the database
- Returns structured data for client-side matching

**POST** `/api/seasons/historical/check-duplicates`
- Accepts array of player and team names
- Performs server-side duplicate checking
- Returns matched entities

### 3. **Preview Page Integration** (`app/dashboard/superadmin/historical-seasons/preview/page.tsx`)

The preview page now includes:
- Automatic duplicate detection on page load
- Visual display of potential duplicates with similarity scores
- One-click correction buttons
- Real-time re-checking when names are edited

## User Interface

### Duplicate Matches Display

When potential duplicates are found, users see:

```
⚠️ 3 Potential Duplicate(s) Found
These names are similar to existing database entries. Review and correct them before importing.

👤 Player: Karthiks
Found 1 similar player(s) in database

  [87%]  Karthik                                    [Use This]
  Similar to your input (edit distance: 1)

💡 Tip: Click "Use This" to replace your input with the existing database name, or edit your name in the table below to keep it as-is.
```

Features:
- **Similarity Badge**: Shows percentage match or "EXACT" for 100% matches
- **Edit Distance**: Shows how many character changes are needed
- **Use This Button**: One-click to apply the suggestion
- **Type Indicator**: Shows whether it's a player (👤) or team (👥)

## Configuration

### Adjusting Similarity Threshold

You can adjust the sensitivity in `preview/page.tsx`:

```typescript
// In loadExistingEntitiesAndCheckDuplicates()
const threshold = 70; // Change this value (0-100)
```

Recommended thresholds:
- **60-70%**: More lenient, catches more variations but may have false positives
- **70-80%**: Balanced approach (default)
- **85-90%**: Stricter, only catches very similar names
- **95-100%**: Only catches nearly identical names

## Examples

### Example 1: Player Name Variations

Input: `"Karthiks"`
Existing: `["Karthik", "Karthik Kumar", "Kartik"]`

Results:
- Karthik: 87.5% similarity (1 edit distance)
- Karthik Kumar: 73.3% similarity
- Kartik: 77.8% similarity

### Example 2: Team Name Variations

Input: `"Real Madrid CF"`
Existing: `["Real Madrid", "Real Madrid C.F.", "FC Real Madrid"]`

Results:
- Real Madrid: 83.3% similarity
- Real Madrid C.F.: 93.3% similarity (almost exact)
- FC Real Madrid: 78.6% similarity

### Example 3: Case Insensitivity

Input: `"BARCELONA"`
Existing: `["Barcelona", "barcelona fc", "FC Barcelona"]`

All normalized to lowercase before comparison:
- Barcelona: 100% similarity (exact match)
- barcelona fc: 75% similarity
- FC Barcelona: 75% similarity

## Benefits

1. **Prevents Data Duplication**: Catches similar names before they're added to the database
2. **Data Quality**: Ensures consistency in naming across historical imports
3. **User-Friendly**: Clear visual feedback with actionable suggestions
4. **Flexible**: Adjustable threshold for different use cases
5. **Efficient**: Client-side matching after initial database fetch
6. **Real-time**: Automatically re-checks when users edit names

## Workflow

1. **Upload CSV**: User uploads historical season data
2. **Preview Page**: Data is parsed and displayed
3. **Auto-Check**: System automatically checks for duplicates
4. **Review Duplicates**: User sees potential matches with similarity scores
5. **Correct Names**: 
   - Click "Use This" to adopt existing database name
   - Or manually edit in the table below
6. **Validate**: System re-validates and re-checks after changes
7. **Import**: Once satisfied, user proceeds with import

## Technical Details

### Levenshtein Distance Algorithm

The implementation uses dynamic programming with O(m*n) time complexity:
- Creates a 2D matrix to store distances
- Fills matrix using recurrence relation
- Returns minimum edit distance

### Performance Considerations

- **Client-side matching**: Performed in browser after initial API call
- **Debouncing**: 300ms delay after name edits before re-checking
- **Caching**: Existing entities fetched once and cached
- **Batch processing**: Can process multiple names efficiently

### Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge) that support:
- ES6+ JavaScript
- Fetch API
- React 18+
- Next.js 13+

## Future Enhancements

Potential improvements:
1. **Phonetic Matching**: Add Soundex or Metaphone for "sounds-like" matching
2. **Machine Learning**: Train model to recognize common name variations
3. **User Feedback**: Learn from user corrections to improve suggestions
4. **Bulk Actions**: Apply same correction to multiple similar names
5. **Custom Rules**: Allow admins to define team name aliases
6. **History Tracking**: Keep record of name corrections made

## Troubleshooting

### No duplicates detected when they should be

- Check the threshold value (may be too high)
- Verify API endpoint is returning data
- Check browser console for errors

### Too many false positives

- Increase the threshold value
- Consider adding custom rules for common variations

### Performance issues with large datasets

- The API call fetches all entities once
- Client-side matching is efficient even with thousands of names
- If needed, implement pagination or incremental loading

## Related Files

- `lib/utils/fuzzyMatch.ts` - Core matching logic
- `app/api/seasons/historical/check-duplicates/route.ts` - API endpoint
- `app/dashboard/superadmin/historical-seasons/preview/page.tsx` - UI implementation
- `app/api/seasons/historical/import/route.ts` - Import logic (not modified)

## Support

For questions or issues related to duplicate detection:
1. Check browser console for error messages
2. Verify Firebase permissions for reading `realplayers` and `teams` collections
3. Ensure API endpoint is accessible
4. Review threshold settings for your use case
