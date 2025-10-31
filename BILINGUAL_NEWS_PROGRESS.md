# 📊 BILINGUAL NEWS + POLLS IMPLEMENTATION PROGRESS

## ✅ COMPLETED (4/17 tasks)

### 1. Type Definitions ✅
**File:** `lib/news/types.ts`
- ✅ 100+ event types added
- ✅ Language enum (en/ml)
- ✅ Tone enum (neutral/funny/harsh/dramatic)
- ✅ Reporter personas (Alex Thompson / രാജേഷ് നായർ)
- ✅ Poll interfaces

### 2. Database Schema ✅
**File:** `database/migrations/create-polls-system.sql`
- ✅ polls table with bilingual support
- ✅ poll_votes table
- ✅ poll_results table
- ✅ news table updates (language, tone, reporter_name columns)
- ✅ Indexes for performance

**Next Step:** Run the migration!
```bash
# Connect to Neon database
psql -h [your-host] -d [database] -f database/migrations/create-polls-system.sql
```

### 3. Poll Helper Functions ✅
**File:** `lib/polls/create.ts`
- ✅ createMatchPredictionPoll()
- ✅ createPlayerOfMatchPoll()
- ✅ createDailyBestPlayerPoll()
- ✅ createDailyBestTeamPoll()
- ✅ createWeeklyPlayerPoll()
- ✅ createWeeklyTeamPoll()
- ✅ createWeeklyManagerPoll()
- ✅ createSeasonPolls() - all 6 types

### 4. Polls API Routes ✅
**Files Created:**
- `app/api/polls/route.ts` - GET (fetch polls) & POST (create poll)
- `app/api/polls/[pollId]/vote/route.ts` - POST (submit vote) & GET (check vote)

**Endpoints:**
- ✅ GET /api/polls?season_id=X&status=active
- ✅ POST /api/polls (create poll)
- ✅ POST /api/polls/[pollId]/vote (submit/update vote)
- ✅ GET /api/polls/[pollId]/vote?user_id=X (check if voted)

---

## 🔄 IN PROGRESS (13/17 remaining)

### 5. Reporter Personas & Tone System 🔨
**Next:** Define how tones work with each reporter
- Alex Thompson (EN): Professional, adapts tone based on event
- രാജേഷ് നായർ (ML): Local flavor, passionate style

### 6. Bilingual News Prompts 🔨
**File:** `lib/news/auto-generate.ts` (needs major update)
- Need separate English & Malayalam prompts for each event type
- Dynamic tone injection (funny/harsh/dramatic)
- This is the LARGEST task (~1000+ lines)

### 7. Update News API 🔨
**File:** `app/api/news/route.ts`
- Generate BOTH languages simultaneously
- Link news to polls when applicable
- Set appropriate tone based on event context

### 8. Language Toggle Component 🔨
**File:** `components/LanguageToggle.tsx`
- EN/ML switcher
- localStorage persistence
- Trigger news refetch on change

### 9. Update News Page 🔨
**File:** `app/news/page.tsx`
- Add language filtering
- Show embedded polls
- Display in selected language

### 10. Poll Widget Components 🔨
**Files to create:**
- `components/polls/PollWidget.tsx` - Embedded in news
- `components/polls/VoteButton.tsx` - Vote interface
- `components/polls/PollResults.tsx` - Show results

### 11-13. Auto-Trigger Integrations 🔨
Hook polls into existing systems:
- **Match Predictions:** Round start → create polls
- **POTM Polls:** Result deadline → create POTM polls
- **Daily Polls:** Matchday complete → create daily polls

### 14-15. Manual Poll Creation UI 🔨
Committee dashboard buttons:
- "Create Weekly Polls" → Form to select nominees
- "Create Season Polls" → Season-end predictions

### 16. Poll Closing & Results 🔨
- Auto-close at deadline
- Generate bilingual results news
- Mark correct predictions

### 17. End-to-End Testing 🔨
Complete workflow test

---

## 📝 NEXT IMMEDIATE STEPS:

### Step A: Run Database Migration
```bash
psql -h [neon-host] -d [database] -f database/migrations/create-polls-system.sql
```

### Step B: Create Sample Bilingual Prompts
Would you like me to:
1. Create a few sample event prompts (EN + ML) to show the pattern?
2. OR create ALL prompts for all 100+ event types at once?

Recommend: Start with 5-10 most important events, test them, then expand.

**Priority Events to Start:**
1. match_result
2. player_milestone  
3. match_scheduled
4. auction_completed
5. hat_trick

### Step C: Create UI Components
After prompts work, build:
1. LanguageToggle
2. PollWidget
3. Update news page

---

## 🎯 ESTIMATED COMPLETION:

- **Database + API:** ✅ 100% Done
- **Poll System:** ✅ 100% Done
- **Prompts & News Generation:** 🔨 0% (largest task)
- **UI Components:** 🔨 0%
- **Auto-Triggers:** 🔨 0%
- **Testing:** 🔨 0%

**Overall Progress:** ~25% Complete

**Time Estimate:**
- Prompts (100+ events × 2 languages): 4-6 hours
- UI Components: 2-3 hours
- Auto-Triggers: 1-2 hours
- Testing & Fixes: 2-3 hours

**Total:** 9-14 hours of development remaining

---

## 💡 RECOMMENDATIONS:

### Option 1: MVP Approach (Fastest)
1. Implement 10 key event prompts (EN + ML)
2. Create basic UI components
3. Hook up match predictions only
4. Test and iterate

**Timeline:** 3-4 hours

### Option 2: Full Implementation
1. All 100+ event prompts (EN + ML)
2. All UI components
3. All auto-triggers
4. Complete testing

**Timeline:** 10-14 hours

### Option 3: Phase-by-Phase
**Phase 1:** Match-related (predictions, results, POTM)
**Phase 2:** Player & Team events
**Phase 3:** Season & Awards events

Which approach would you prefer?
