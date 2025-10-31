# Team Dashboard Pages Audit

## Summary
Checking all team pages to verify:
1. ✅ Page file exists
2. ✅ Linked in RegisteredTeamDashboard
3. ❌ Missing link or missing page

---

## Pages Linked in Dashboard

### Quick Actions Grid

#### 🔥 Auction Card
| Link | Page Exists | In Dashboard | Notes |
|------|------------|--------------|-------|
| Tabs: 'auctions', 'results', 'overview' | Internal tabs | ✅ Yes | Internal state, not routes |

#### 💚 Team Management Card  
| Link | Page Exists | In Dashboard | Notes |
|------|------------|--------------|-------|
| My Squad (tab) | Internal tab | ✅ Yes | Internal state |
| `/dashboard/team/real-players` | ✅ Yes | ✅ Yes | Real players management |
| `/dashboard/team/contracts` | ✅ Yes | ✅ Yes | Contract management |

#### 📊 Competition Card
| Link | Page Exists | In Dashboard | Notes |
|------|------------|--------------|-------|
| `/dashboard/team/matches` | ✅ Yes | ✅ Yes | Match schedule |
| `/dashboard/team/all-teams` | ✅ Yes | ✅ Yes | All teams overview |
| `/dashboard/team/team-leaderboard` | ✅ Yes | ✅ Yes | Team standings |
| `/dashboard/team/fantasy/my-team` | ✅ Yes | ✅ Yes | Fantasy team |

#### 🎯 Planning Card
| Link | Page Exists | In Dashboard | Notes |
|------|------------|--------------|-------|
| `/dashboard/team/budget-planner` | ✅ Yes | ✅ Yes | Budget planning tool |
| `/dashboard/team/transactions` | ✅ Yes | ✅ Yes | Transaction history |
| `/dashboard/team/profile/edit` | ✅ Yes | ✅ Yes | Team settings |
| Overview (tab) | Internal tab | ✅ Yes | Internal state |

#### 🚨 Dynamic Links (shown conditionally)
| Link | Page Exists | In Dashboard | Notes |
|------|------------|--------------|-------|
| `/dashboard/team/tiebreaker/[id]` | ✅ Yes | ✅ Yes | Shown when tiebreakers exist |

---

## Pages NOT Linked in Dashboard (But Exist)

### Missing from Quick Actions
| Page Path | Exists | Purpose | Recommendation |
|-----------|--------|---------|----------------|
| `/dashboard/team/player-leaderboard` | ✅ Yes | Player stats/rankings | ⚠️ Should be added to Competition card |
| `/dashboard/team/fixtures/[id]` | ✅ Yes | Individual fixture details | Already accessible via matches |
| `/dashboard/team/fixture/[fixtureId]` | ✅ Yes | Fixture management | Already accessible via matches |
| `/dashboard/team/fixture/[fixtureId]/lineup` | ✅ Yes | Lineup selection | Already accessible via fixture |
| `/dashboard/team/fixture/[fixtureId]/select-opponent-lineup` | ✅ Yes | Opponent lineup | Already accessible |
| `/dashboard/team/fixture/[fixtureId]/substitute` | ✅ Yes | Substitutions | Already accessible |
| `/dashboard/team/statistics` | ✅ Yes | Detailed statistics | ⚠️ Should be added to Competition card |
| `/dashboard/team/profile` | ✅ Yes | Team profile view | Already linked in Overview tab |

### Fantasy Sub-pages (Already accessible via Fantasy link)
| Page Path | Exists | Purpose |
|-----------|--------|---------|
| `/dashboard/team/fantasy/draft` | ✅ Yes | Fantasy draft |
| `/dashboard/team/fantasy/leaderboard` | ✅ Yes | Fantasy standings |
| `/dashboard/team/fantasy/lineup` | ✅ Yes | Set fantasy lineup |
| `/dashboard/team/fantasy/transfers` | ✅ Yes | Fantasy transfers |

### Auction Sub-pages (Dynamic, shown when active)
| Page Path | Exists | Purpose |
|-----------|--------|---------|
| `/dashboard/team/round/[id]` | ✅ Yes | Auction round details |
| `/dashboard/team/bulk-round/[id]` | ✅ Yes | Bulk auction round |
| `/dashboard/team/bulk-tiebreaker/[id]` | ✅ Yes | Bulk tiebreaker |

### Player Pages (Accessible via search/squad)
| Page Path | Exists | Purpose |
|-----------|--------|---------|
| `/dashboard/team/player/[id]` | ✅ Yes | Individual player details |
| `/dashboard/team/players` | ✅ Yes | All players list |

---

## Recommendations

### 🔴 High Priority - Add to Dashboard

1. **Player Leaderboard** (`/dashboard/team/player-leaderboard`)
   - **Why**: Essential for teams to see player rankings
   - **Where**: Competition Card
   - **Icon**: 📋 Player Stats

2. **Statistics** (`/dashboard/team/statistics`)
   - **Why**: Detailed team performance analytics
   - **Where**: Competition Card OR Planning Card
   - **Icon**: 📈 Statistics

### 🟡 Medium Priority - Consider Adding

3. **All Players** (`/dashboard/team/players`)
   - **Why**: Browse all available players
   - **Where**: Team Management Card
   - **Icon**: 🎯 All Players

### ✅ Well Organized

- Auction pages are dynamically shown when active ✓
- Fantasy sub-pages accessible via main Fantasy link ✓
- Fixture/Match sub-pages accessible via Matches ✓
- Dynamic routes (tiebreakers, rounds) shown conditionally ✓

---

## Current Dashboard Structure

```
Quick Actions Grid (4 cards):

1. 🔥 Auction
   - [Internal tabs for auctions/bids/results]

2. 💚 Team  
   - ⚽ My Squad (tab)
   - 👥 Real Players
   - 📄 Contracts

3. 📊 Competition
   - 📅 Matches
   - 👥 All Teams ✓ NEW
   - 🏆 Leaderboard
   - ⭐ Fantasy

4. 🎯 Planning
   - 💰 Budget Planner
   - 💳 Transactions
   - ⚙️ Settings
   - 📊 Overview (tab)
```

---

## Missing Links to Add

### Suggested Addition to Competition Card:

```tsx
<Link href="/dashboard/team/player-leaderboard" className="...">
  📋 Player Stats
</Link>
```

### Suggested Addition to Planning or Competition Card:

```tsx
<Link href="/dashboard/team/statistics" className="...">
  📈 Statistics
</Link>
```

---

## Status: ✅ All Core Pages Accessible

All essential pages are either:
- ✅ Directly linked in dashboard
- ✅ Accessible via parent pages (fixtures via matches, etc.)
- ✅ Conditionally shown when relevant (tiebreakers, auction rounds)

**Only 2 useful pages not linked:**
1. Player Leaderboard - Should add ⚠️
2. Statistics - Should add ⚠️
