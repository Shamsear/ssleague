# IST Timezone - Quick Reference Guide

## 🇮🇳 All times in this system are in IST (UTC+5:30)

### Quick Import
```typescript
import { 
  getISTNow, 
  getISTToday, 
  parseISTDate, 
  createISTDateTime,
  formatISTDate,
  formatISTTime 
} from '@/lib/utils/timezone';
```

---

## Common Tasks

### 1. Get Current Time
```typescript
// ✅ DO THIS
const now = getISTNow();

// ❌ NOT THIS
const now = new Date();
```

### 2. Get Today's Date String
```typescript
// ✅ DO THIS
const today = getISTToday(); // "2025-10-11"

// ❌ NOT THIS
const today = new Date().toISOString().split('T')[0];
```

### 3. Parse a Date String (YYYY-MM-DD)
```typescript
// ✅ DO THIS
const date = parseISTDate('2025-10-11');

// ❌ NOT THIS
const date = new Date('2025-10-11');
```

### 4. Create DateTime from Date + Time
```typescript
// ✅ DO THIS
const deadline = createISTDateTime('2025-10-11', '17:00');

// ❌ NOT THIS
const deadline = new Date('2025-10-11T17:00:00');
```

### 5. Display Date to User
```typescript
// ✅ DO THIS
date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
date.toLocaleTimeString('en-IN', { 
  hour: '2-digit', 
  minute: '2-digit',
  timeZone: 'Asia/Kolkata' 
})

// ❌ NOT THIS
date.toLocaleDateString()
date.toLocaleTimeString()
```

### 6. Set "Today" Button in Date Input
```typescript
// ✅ DO THIS
<button onClick={() => setDate(getISTToday())}>
  Today
</button>

// ❌ NOT THIS
<button onClick={() => setDate(new Date().toISOString().split('T')[0])}>
  Today
</button>
```

### 7. Read Firebase Timestamp
```typescript
import { timestampToIST } from '@/lib/utils/timezone';

// ✅ DO THIS
const date = data.created_at?.toDate ? timestampToIST(data.created_at) : getISTNow();

// ❌ NOT THIS
const date = data.created_at?.toDate() || new Date();
```

### 8. Create New Document with Timestamps
```typescript
import { getISTNow } from '@/lib/utils/timezone';

// ✅ DO THIS (client-side)
const doc = {
  created_at: getISTNow(),
  updated_at: getISTNow(),
};

// For Firebase, still use serverTimestamp() when available:
import { serverTimestamp } from 'firebase/firestore';
const doc = {
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
};
```

### 9. Store in Neon Database
```typescript
import { toNeonTimestamp, getISTNow } from '@/lib/utils/timezone';

// ✅ DO THIS
await sql`INSERT INTO table (created_at) VALUES (${toNeonTimestamp(getISTNow())})`;
```

### 10. Read from Neon Database
```typescript
import { fromNeonTimestamp } from '@/lib/utils/timezone';

// ✅ DO THIS
const result = await sql`SELECT created_at FROM table`;
const date = fromNeonTimestamp(result.rows[0].created_at);
```

---

## Match Deadline Calculations

### Calculate Phase
```typescript
import { getISTNow, parseISTDate, createISTDateTime } from '@/lib/utils/timezone';

const now = getISTNow();
const baseDate = parseISTDate(round.scheduled_date);

const homeDeadline = createISTDateTime(
  round.scheduled_date,
  round.home_fixture_deadline_time || '17:00'
);

const awayDeadline = createISTDateTime(
  round.scheduled_date,
  round.away_fixture_deadline_time || '17:00'
);

if (now < homeDeadline) {
  return 'Home Fixture Setup';
} else if (now < awayDeadline) {
  return 'Fixture Entry';
} else {
  return 'Result Entry';
}
```

---

## Comparison & Calculations

### Compare Dates
```typescript
import { compareISTDates, isISTDatePast, isISTDateFuture } from '@/lib/utils/timezone';

if (compareISTDates(date1, date2) < 0) {
  // date1 is before date2
}

if (isISTDatePast(deadline)) {
  // deadline has passed
}

if (isISTDateFuture(scheduledDate)) {
  // scheduled for future
}
```

### Calculate Time Differences
```typescript
import { getISTMinutesDiff, getISTHoursDiff, getISTDaysDiff } from '@/lib/utils/timezone';

const minutes = getISTMinutesDiff(startDate, endDate);
const hours = getISTHoursDiff(startDate, endDate);
const days = getISTDaysDiff(startDate, endDate);
```

---

## Format for Display

```typescript
import { formatISTDate, formatISTTime, formatISTDateTime } from '@/lib/utils/timezone';

const dateStr = formatISTDate(date);        // "2025-10-11"
const timeStr = formatISTTime(date);        // "17:30"
const datetimeStr = formatISTDateTime(date); // "2025-10-11 17:30:45"
```

---

## Complete Example: Phase Display Component

```typescript
import { 
  getISTNow, 
  parseISTDate, 
  createISTDateTime,
  getISTMinutesDiff 
} from '@/lib/utils/timezone';

function MatchPhaseDisplay({ round }) {
  const now = getISTNow();
  
  if (!round.scheduled_date) {
    return <Badge color="yellow">Set Schedule Date</Badge>;
  }
  
  const homeDeadline = createISTDateTime(
    round.scheduled_date,
    round.home_fixture_deadline_time || '17:00'
  );
  
  const awayDeadline = createISTDateTime(
    round.scheduled_date,
    round.away_fixture_deadline_time || '17:00'
  );
  
  if (now < homeDeadline) {
    const remaining = getISTMinutesDiff(now, homeDeadline);
    return (
      <div>
        <Badge color="blue">Home Fixture Setup</Badge>
        <span>{remaining} minutes left</span>
      </div>
    );
  } else if (now < awayDeadline) {
    const remaining = getISTMinutesDiff(now, awayDeadline);
    return (
      <div>
        <Badge color="purple">Fixture Entry</Badge>
        <span>{remaining} minutes left</span>
      </div>
    );
  }
  
  return <Badge color="green">Result Entry</Badge>;
}
```

---

## Testing

### Verify IST is Working
```typescript
import { getISTNow, formatISTDateTime } from '@/lib/utils/timezone';

console.log('Current IST:', formatISTDateTime(getISTNow()));
console.log('Expected offset: UTC+5:30');

// Should show ~330 minutes difference from UTC
const now = getISTNow();
const utc = new Date();
const offsetMinutes = (now.getTime() - utc.getTime()) / (1000 * 60);
console.log('Actual offset:', offsetMinutes, 'minutes');
```

---

## ⚠️ Common Mistakes to Avoid

1. ❌ Using `new Date()` for business logic
2. ❌ Using `.toLocaleDateString()` without timezone parameter
3. ❌ Parsing date strings without timezone context
4. ❌ Assuming browser timezone is IST
5. ❌ Hardcoding timezone offsets
6. ❌ Using `Date.now()` without conversion
7. ❌ Comparing dates from different timezones directly

---

## 📚 Full Documentation

For complete documentation, see: `docs/IST_TIMEZONE_IMPLEMENTATION.md`

---

**Remember:** When in doubt, use the IST utilities! 🇮🇳⏰
