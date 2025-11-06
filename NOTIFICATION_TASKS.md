# Notification Implementation Tasks

## ✅ Completed
1. Created admin manual notification page: `/app/dashboard/committee/notifications/page.tsx`

## 🔄 Remaining Tasks

### 1. Add Link to Committee Dashboard
File: `app/dashboard/committee/page.tsx`
Add this card in the Fantasy & Content Management section (around line 850):

```tsx
<Link href="/dashboard/committee/notifications">
  <Card className="hover:shadow-md transition-shadow cursor-pointer">
    <CardHeader>
      <Bell className="w-8 h-8 mb-2 text-yellow-500" />
      <CardTitle>Manual Notifications</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">
        Send manual notifications to teams
      </p>
    </CardContent>
  </Card>
</Link>
```

Don't forget to import Bell: `import { Bell } from "lucide-react";`

---

## 2. APIs Requiring Notifications (41 Total)

### HIGH PRIORITY (31 APIs)

#### Auction & Bidding (7 APIs)
- [ ] `/api/admin/rounds/[id]/start`
- [ ] `/api/admin/rounds/[id]/finalize`
- [ ] `/api/admin/bulk-rounds/[id]/start`
- [ ] `/api/admin/bulk-rounds/[id]/finalize`
- [ ] `/api/tiebreakers/route` (POST)
- [ ] `/api/admin/bulk-tiebreakers/[id]/start`
- [ ] `/api/admin/bulk-tiebreakers/[id]/finalize`

#### Lineup & Match (5 APIs)
- [ ] `/api/lineups/[lineupId]/lock`
- [ ] `/api/fixtures/[fixtureId]/matchups` (POST)
- [ ] `/api/fixtures/[fixtureId]/edit-result`
- [ ] `/api/fixtures/[fixtureId]/declare-null`
- [ ] `/api/fixtures/[fixtureId]/declare-wo`
- [ ] `/api/fixtures/bulk` (POST)

#### Financial (6 APIs)
- [ ] `/api/admin/transactions/bonus`
- [ ] `/api/admin/transactions/fine`
- [ ] `/api/admin/transactions/adjustment`
- [ ] `/api/contracts/mid-season-salary`
- [ ] `/api/contracts/expire`
- [ ] `/api/admin/refund-salaries`

#### Player Management (4 APIs)
- [ ] `/api/players/transfer`
- [ ] `/api/players/release`
- [ ] `/api/players/swap`
- [ ] `/api/players/assign-contract`

#### Registration & Seasons (5 APIs)
- [ ] `/api/seasons/route` (POST)
- [ ] `/api/seasons/[id]` (PUT)
- [ ] `/api/seasons/[id]/toggle-player-registration`
- [ ] `/api/admin/registration-phases`
- [ ] `/api/seasons/[id]/register`

#### Fantasy League (4 APIs)
- [ ] `/api/fantasy/round-complete`
- [ ] `/api/fantasy/transfer-windows/[windowId]/toggle`
- [ ] `/api/fantasy/calculate-points`
- [ ] `/api/fantasy/transfers/make`

### MEDIUM PRIORITY (10 APIs)

#### Awards (4 APIs)
- [ ] `/api/player-awards/add`
- [ ] `/api/player-awards/auto-award`
- [ ] `/api/trophies/route` (POST)
- [ ] `/api/trophies/award`

#### News & Polls (4 APIs)
- [ ] `/api/news/route` (POST)
- [ ] `/api/news/season-events`
- [ ] `/api/polls/create`
- [ ] `/api/polls/close`

#### Tournaments (2 APIs)
- [ ] `/api/tournaments/[id]/fixtures`
- [ ] `/api/knockout/generate`

---

## 3. Standard Notification Pattern

For each API, add this after successful operation:

```typescript
// Import at top
import { sendNotificationToTeams } from "@/lib/notificationHelper";

// After successful operation
await sendNotificationToTeams({
  type: "success" | "info" | "warning" | "error",
  title: "Short title",
  message: "Detailed message",
  recipientType: "all" | "specific",
  teamIds: [], // if recipientType is "specific"
  link: "/relevant/page", // optional
  priority: "high" | "normal" | "low"
});
```

---

## 4. Example Implementation

File: `app/api/admin/rounds/[id]/start/route.ts`

```typescript
// Add notification after round starts
await sendNotificationToTeams({
  type: "info",
  title: "🔥 New Round Started!",
  message: `Round ${round.roundNumber} for ${player.name} is now open for bidding. Deadline: ${round.deadline}`,
  recipientType: "all",
  link: `/auction/rounds/${round._id}`,
  priority: "high"
});
```

---

## Next Steps

1. Add Bell icon link to committee dashboard
2. Go through each API file listed above
3. Add notification call after successful operation
4. Test each notification type
5. Verify notifications appear in team dashboards

---

## Testing Checklist

After implementation, test:
- [ ] Notifications appear in team dashboard
- [ ] Correct teams receive notifications
- [ ] Links work correctly
- [ ] Priority levels display correctly
- [ ] Manual notification page works

---

## Notes

- The notification helper is already created in `lib/notificationHelper.ts`
- Notification schema exists in `models/Notification.ts`
- Teams can view notifications in their dashboard
- Admin can send manual notifications from `/dashboard/committee/notifications`
