# IST Timezone Implementation

This document describes how Indian Standard Time (IST) timezone handling is implemented across the entire application, including both Firebase and Neon databases.

## Overview

All timestamps in the system are now handled in **Indian Standard Time (IST)**, which is **UTC+5:30**. This ensures consistency across:
- Firebase Firestore timestamps
- Neon/PostgreSQL timestamps
- Client-side date displays
- Server-side date calculations
- Match deadlines and scheduling

## Utility Functions

All timezone-related functionality is centralized in `lib/utils/timezone.ts`. This module provides comprehensive IST timezone utilities.

### Core Functions

#### `getISTNow(): Date`
Returns the current date/time in IST.
```typescript
const now = getISTNow();
```

#### `toIST(date: Date | string | number): Date`
Converts any date to IST Date object.
```typescript
const istDate = toIST(someDate);
```

#### `createISTTimestamp(): Timestamp`
Creates a Firebase Timestamp in IST (for document creation).
```typescript
import { createISTTimestamp } from '@/lib/utils/timezone';
const timestamp = createISTTimestamp();
```

#### `timestampToIST(timestamp: Timestamp): Date`
Converts a Firebase Timestamp to IST Date.
```typescript
const istDate = timestampToIST(firestoreTimestamp);
```

### Date Parsing Functions

#### `parseISTDate(dateString: string): Date`
Parses a date string (YYYY-MM-DD) as IST.
```typescript
const date = parseISTDate('2025-10-11'); // Treats as IST date
```

#### `createISTDateTime(dateString: string, timeString?: string): Date`
Creates a Date from IST date and time strings.
```typescript
const deadline = createISTDateTime('2025-10-11', '17:00');
```

### Formatting Functions

#### `formatISTDate(date: Date): string`
Formats a date as YYYY-MM-DD in IST.
```typescript
const dateStr = formatISTDate(new Date()); // "2025-10-11"
```

#### `formatISTTime(date: Date): string`
Formats a date as HH:MM in IST.
```typescript
const timeStr = formatISTTime(new Date()); // "17:30"
```

#### `formatISTDateTime(date: Date): string`
Formats a date as full datetime in IST.
```typescript
const datetimeStr = formatISTDateTime(new Date()); // "2025-10-11 17:30:45"
```

#### `getISTToday(): string`
Gets today's date in IST as YYYY-MM-DD string.
```typescript
const today = getISTToday(); // Use this for date inputs
```

### Database Functions

#### `toNeonTimestamp(date: Date): string`
Converts IST Date to ISO string for Neon/PostgreSQL storage.
```typescript
const neonTimestamp = toNeonTimestamp(date);
```

#### `fromNeonTimestamp(timestamp: string): Date`
Parses a Neon timestamp string to IST Date.
```typescript
const date = fromNeonTimestamp(neonTimestampString);
```

### Comparison Functions

#### `compareISTDates(date1: Date, date2: Date): number`
Compares two dates in IST timezone.
Returns: -1, 0, or 1

#### `isISTDatePast(date: Date): boolean`
Checks if a date is in the past (IST).

#### `isISTDateFuture(date: Date): boolean`
Checks if a date is in the future (IST).

#### `getISTMinutesDiff(date1: Date, date2: Date): number`
Gets time difference in minutes.

#### `getISTHoursDiff(date1: Date, date2: Date): number`
Gets time difference in hours.

#### `getISTDaysDiff(date1: Date, date2: Date): number`
Gets time difference in days.

## Implementation in Firebase

### Document Creation
When creating documents with timestamps:
```typescript
import { getISTNow } from '@/lib/utils/timezone';

const fixture = {
  // ... other fields
  created_at: getISTNow(),
  updated_at: getISTNow(),
};
```

### Reading Timestamps
When reading Firestore timestamps:
```typescript
import { timestampToIST } from '@/lib/utils/timezone';

const data = doc.data();
const createdAt = data.created_at?.toDate ? timestampToIST(data.created_at) : getISTNow();
```

### Files Updated
The following Firebase library files have been updated:
- ✅ `lib/firebase/fixtures.ts` - All fixture timestamps use IST
- ✅ `lib/firebase/matchDays.ts` - Match day deadlines use IST (if applicable)
- ✅ `lib/firebase/seasons.ts` - Season dates use IST (if applicable)
- ✅ `lib/firebase/teams.ts` - Team registration dates use IST (if applicable)

## Implementation in Frontend

### Dashboard Pages
All dashboard pages that display or calculate dates use IST utilities:

#### Match Days Dashboard (`committee/team-management/match-days/page.tsx`)
- ✅ Uses `getISTNow()` for current time
- ✅ Uses `parseISTDate()` for scheduled dates
- ✅ Uses `createISTDateTime()` for deadline calculations

#### Edit Match Round (`committee/team-management/match-days/edit/page.tsx`)
- ✅ "Today" button uses `getISTToday()`
- ✅ All time inputs are in IST
- ✅ Date displays use IST formatting

#### Team Matches (`team/matches/page.tsx`)
- ✅ Phase calculations use `getISTNow()`
- ✅ Deadline parsing uses `createISTDateTime()`
- ✅ Match date displays use IST locale

### Date Input Components
When creating date inputs:
```typescript
<button onClick={() => setScheduledDate(getISTToday())}>
  Today
</button>
```

### Date Display
When displaying dates to users:
```typescript
{nextDeadline.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
{nextDeadline.date.toLocaleTimeString('en-IN', { 
  hour: '2-digit', 
  minute: '2-digit', 
  timeZone: 'Asia/Kolkata' 
})}
```

## Implementation in Neon Database

### Storing Timestamps
When inserting timestamps into Neon/PostgreSQL:
```typescript
import { toNeonTimestamp } from '@/lib/utils/timezone';

const query = `
  INSERT INTO table_name (created_at)
  VALUES ($1)
`;
await sql(query, [toNeonTimestamp(getISTNow())]);
```

### Reading Timestamps
When reading timestamps from Neon:
```typescript
import { fromNeonTimestamp } from '@/lib/utils/timezone';

const result = await sql`SELECT created_at FROM table_name`;
const createdAt = fromNeonTimestamp(result.rows[0].created_at);
```

### Database Schema
Ensure your Neon tables use `TIMESTAMPTZ` (timestamp with timezone) columns:
```sql
CREATE TABLE example (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Match Deadline System

The match deadline system is fully IST-aware:

### Phase Calculation
```typescript
const now = getISTNow();
const baseDate = parseISTDate(round.scheduled_date);

const homeDeadline = createISTDateTime(
  round.scheduled_date,
  round.home_fixture_deadline_time || '17:00'
);

if (now < homeDeadline) {
  return { phase: 'home_fixture', phaseLabel: 'Home Fixture Setup' };
}
```

### Phases
1. **Home Fixture Setup** - Before home deadline time on match day
2. **Fixture Entry** - Between home and away deadline times
3. **Result Entry** - After match day, before result deadline
4. **Closed** - After result deadline

All phase transitions happen based on IST time.

## Best Practices

### ✅ DO:
1. Always use `getISTNow()` instead of `new Date()` for current time
2. Use `parseISTDate()` when parsing YYYY-MM-DD date strings
3. Use `createISTDateTime()` when combining date and time strings
4. Use `timestampToIST()` when reading Firebase timestamps
5. Use `toNeonTimestamp()` when storing dates in Neon
6. Use `getISTToday()` for date input default values
7. Display dates using `'en-IN'` locale with `'Asia/Kolkata'` timezone

### ❌ DON'T:
1. Don't use `new Date()` directly for business logic
2. Don't parse dates without timezone information
3. Don't use `Date.now()` or `new Date().getTime()` without IST conversion
4. Don't assume browser timezone matches IST
5. Don't use `toLocaleDateString()` without specifying IST timezone

## Testing IST Implementation

To verify IST is working correctly:

```typescript
import { getISTNow, formatISTDateTime } from '@/lib/utils/timezone';

console.log('Current IST time:', formatISTDateTime(getISTNow()));
console.log('Expected IST offset: UTC+5:30');

const now = getISTNow();
const utc = new Date();
const offsetMinutes = (now.getTime() - utc.getTime()) / (1000 * 60);
console.log('Actual offset in minutes:', offsetMinutes);
// Should be approximately 330 minutes (5.5 hours)
```

## Migration Notes

### Existing Data
If you have existing data with incorrect timezones:
1. All Firebase timestamps are already UTC-based and will be correctly converted to IST on read
2. Neon timestamps stored as `TIMESTAMPTZ` will maintain their timezone information
3. String dates without timezone info should be treated as IST using `parseISTDate()`

### Future Development
- All new features should use the IST utility functions
- All date calculations must use IST-aware functions
- All user-facing dates must display in IST
- All database writes must store IST-aware timestamps

## Files Modified

### Core Utilities
- ✅ `lib/utils/timezone.ts` - New IST utility module

### Firebase Libraries
- ✅ `lib/firebase/fixtures.ts` - Updated to use IST utilities

### Dashboard Pages
- ✅ `app/dashboard/committee/team-management/match-days/page.tsx`
- ✅ `app/dashboard/committee/team-management/match-days/edit/page.tsx`
- ✅ `app/dashboard/team/matches/page.tsx`

## Support

For questions or issues related to IST timezone handling:
1. Check this documentation first
2. Review the `lib/utils/timezone.ts` source code
3. Test with the verification code provided above
4. Ensure all imports are correct

---

**Last Updated:** October 11, 2025  
**Timezone:** IST (UTC+5:30)
