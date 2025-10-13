# SQL Syntax Fix Summary

## Issue
The Neon SQL library changed its API and no longer allows nested `sql()` calls inside template literals for `IN` clauses.

### Error Message
```
Error: This function can now be called only as a tagged-template function: sql`SELECT ${value}`, 
not sql("SELECT $1", [value], options). For a conventional function call with value placeholders 
($1, $2, etc.), use sql.query("SELECT $1", [value], options).
```

---

## Root Cause
**Old (Broken) Syntax:**
```typescript
WHERE column IN ${sql(arrayOfValues)}
```

**New (Fixed) Syntax:**
```typescript
const valuesList = arrayOfValues.map(v => `'${v}'`).join(',');
WHERE column IN (${sql.raw(valuesList)})
```

---

## Files Fixed

### 1. ✅ `/app/api/admin/tiebreakers/route.ts`

**Line 89 - Status Filter:**
```typescript
// BEFORE (broken)
conditions.push(sql`t.status IN ${sql(statuses)}`);

// AFTER (fixed)
const statusList = statuses.map(s => `'${s}'`).join(',');
conditions.push(sql`t.status IN (${sql.raw(statusList)})`);
```

**Line 123 - Tiebreaker IDs:**
```typescript
// BEFORE (broken)
WHERE tt.tiebreaker_id IN ${sql(tiebreakerIds)}

// AFTER (fixed)
const idsList = tiebreakerIds.join(',');
WHERE tt.tiebreaker_id IN (${sql.raw(idsList)})
```

---

### 2. ✅ `/app/api/team/dashboard/route.ts`

**Line 226 - Active Round IDs:**
```typescript
// BEFORE (broken)
AND b.round_id IN ${sql(activeRoundIds)}

// AFTER (fixed)
const roundIdsList = activeRoundIds.map(id => `'${id}'`).join(',');
AND b.round_id IN (${sql.raw(roundIdsList)})
```

---

### 3. ✅ `/app/api/admin/rounds/[id]/finalize-preview/route.ts`

**Line 181 - Player IDs:**
```typescript
// BEFORE (broken)
WHERE id IN ${sql(playerIdsArray)}

// AFTER (fixed)
const playerIdsList = playerIdsArray.join(',');
WHERE id IN (${sql.raw(playerIdsList)})
```

---

## Key Pattern Changes

### For String Arrays (UUIDs, statuses, etc.)
```typescript
// Add quotes around each value
const list = array.map(item => `'${item}'`).join(',');
sql`WHERE column IN (${sql.raw(list)})`
```

### For Number Arrays (IDs)
```typescript
// No quotes needed for numbers
const list = array.join(',');
sql`WHERE column IN (${sql.raw(list)})`
```

---

## Why This Works

1. **`sql.raw()`** tells Neon to insert the string directly into the query without parameterization
2. We manually build the comma-separated list with proper SQL syntax
3. The parentheses `()` around the IN clause are required SQL syntax
4. For strings, we add single quotes `'value'`
5. For numbers, no quotes are needed

---

## Testing

After these fixes:
- ✅ Tiebreakers API now loads correctly
- ✅ Team dashboard fetches bids without errors
- ✅ Round finalization preview works
- ✅ No more `sql()` nesting errors

---

## Prevention

**Search Pattern to Find Similar Issues:**
```bash
# In your codebase, search for:
IN ${sql(
```

This will catch any remaining instances of the old syntax.

---

## Migration Guide for Future IN Clauses

**Template for String Arrays:**
```typescript
if (myStringArray.length > 0) {
  const valuesList = myStringArray.map(v => `'${v}'`).join(',');
  const result = await sql`
    SELECT * FROM table 
    WHERE column IN (${sql.raw(valuesList)})
  `;
}
```

**Template for Number Arrays:**
```typescript
if (myNumberArray.length > 0) {
  const valuesList = myNumberArray.join(',');
  const result = await sql`
    SELECT * FROM table 
    WHERE column IN (${sql.raw(valuesList)})
  `;
}
```

---

## Additional Notes

⚠️ **Security Consideration:**
When using `sql.raw()`, ensure values are sanitized to prevent SQL injection. In our case:
- UUIDs from Firebase are safe (alphanumeric)
- Status strings are from enums/constants
- Numbers from database IDs are safe

If accepting user input, validate/sanitize before using `sql.raw()`.

---

**Fixed:** 2025-10-09
**Total Files Modified:** 3
**Total Fixes:** 4 locations
