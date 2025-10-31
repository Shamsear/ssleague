# 📰 BILINGUAL NEWS + POLLS SYSTEM - COMPLETE IMPLEMENTATION GUIDE

## ✅ COMPLETED SO FAR:

### 1. Type Definitions (lib/news/types.ts)
- ✅ Added 100+ event types
- ✅ Language enum (en/ml)
- ✅ Tone enum (neutral/funny/harsh/dramatic)
- ✅ Reporter personas (Alex Thompson / രാജേഷ് നായർ)
- ✅ Poll types and interfaces

### 2. Database Schema
- ✅ Created `create-polls-system.sql` migration
- ✅ Tables: polls, poll_votes, poll_results
- ✅ Updated news table with language, tone, reporter_name
- ✅ Indexes for performance

**Run migration:**
```bash
# Connect to your Neon database and run:
psql -h [your-neon-host] -d [database] -f database/migrations/create-polls-system.sql
```

---

## 🔄 REMAINING IMPLEMENTATION STEPS:

### STEP 3: Run Database Migration
```bash
# Apply the polls system migration
npm run db:migrate create-polls-system.sql
```

### STEP 4: Update auto-generate.ts
This is a LARGE file - I'll create sample prompts for a few event types to show the pattern.

**Key points:**
- Each event type needs prompts for BOTH languages
- Each prompt should adapt tone based on context
- Malayalam prompts must be written in native Malayalam (not translated English)

**Sample structure:**
```typescript
const ENGLISH_PROMPTS: Record<NewsEventType, (input, tone) => string> = {
  'match_result': (input, tone) => {
    const reporter = REPORTERS.en.name_en;
    const personality = tone === 'harsh' ? 'critical and sarcastic' : 
                       tone === 'funny' ? 'witty and entertaining' :
                       tone === 'dramatic' ? 'intense and storytelling' : 'professional';
    
    return `You are ${reporter}, a ${REPORTERS.en.style}.
    Your personality: ${personality}
    
    Report on match result:
    ${input.metadata.home_team} ${input.metadata.home_score} - ${input.metadata.away_score} ${input.metadata.away_team}
    Winner: ${input.metadata.winner}
    
    ${tone === 'harsh' && input.metadata.goal_diff >= 3 ? 'Roast the losing team for the thrashing.' : ''}
    ${tone === 'funny' ? 'Add witty commentary and jokes.' : ''}
    ${tone === 'dramatic' ? 'Build narrative with tension and excitement.' : ''}
    
    Format as JSON: {"title": "...", "content": "...", "summary": "..."}`;
  }
};

const MALAYALAM_PROMPTS: Record<NewsEventType, (input, tone) => string> = {
  'match_result': (input, tone) => {
    const reporter = REPORTERS.ml.name_ml;
    const personality = tone === 'harsh' ? 'വിമർശനാത്മകവും കടുപ്പമുള്ളതുമായ' : 
                       tone === 'funny' ? 'രസകരവും വിനോദപ്രദവുമായ' :
                       tone === 'dramatic' ? 'ആവേശകരവും കഥപറച്ചിലുള്ളതുമായ' : 'പ്രൊഫഷണൽ';
    
    return `നിങ്ങൾ ${reporter}, ${REPORTERS.ml.style}.
    നിങ്ങളുടെ സ്വഭാവം: ${personality}
    
    മത്സര ഫലം റിപ്പോർട്ട് ചെയ്യുക:
    ${input.metadata.home_team} ${input.metadata.home_score} - ${input.metadata.away_score} ${input.metadata.away_team}
    ജയി: ${input.metadata.winner}
    
    ${tone === 'harsh' ? 'തോറ്റ ടീമിനെ നിശിതമായി വിമർശിക്കുക.' : ''}
    ${tone === 'funny' ? 'രസകരമായ കമന്ററി ചേർക്കുക.' : ''}
    ${tone === 'dramatic' ? 'കഥ പോലെ ആവേശകരമായി എഴുതുക.' : ''}
    
    JSON ഫോർമാറ്റിൽ: {"title": "...", "content": "...", "summary": "..."}`;
  }
};
```

### STEP 5: Create Polls API Routes

**File: app/api/polls/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Fetch polls
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season_id = searchParams.get('season_id');
  const status = searchParams.get('status');
  const poll_type = searchParams.get('poll_type');
  
  const sql = getTournamentDb();
  
  let query = sql`SELECT * FROM polls WHERE 1=1`;
  
  if (season_id) {
    query = sql`SELECT * FROM polls WHERE season_id = ${season_id}`;
  }
  if (status) {
    query = sql`${query} AND status = ${status}`;
  }
  if (poll_type) {
    query = sql`${query} AND poll_type = ${poll_type}`;
  }
  
  query = sql`${query} ORDER BY created_at DESC`;
  
  const polls = await query;
  
  return NextResponse.json({ success: true, polls });
}

// POST - Create poll
export async function POST(request: NextRequest) {
  const body = await request.json();
  const sql = getTournamentDb();
  
  const poll_id = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await sql`
    INSERT INTO polls (
      poll_id, season_id, poll_type,
      title_en, title_ml, description_en, description_ml,
      related_fixture_id, related_round_id,
      options, closes_at, created_by
    ) VALUES (
      ${poll_id}, ${body.season_id}, ${body.poll_type},
      ${body.title_en}, ${body.title_ml || null},
      ${body.description_en || null}, ${body.description_ml || null},
      ${body.related_fixture_id || null}, ${body.related_round_id || null},
      ${JSON.stringify(body.options)}, ${body.closes_at},
      ${body.created_by || null}
    )
  `;
  
  return NextResponse.json({ success: true, poll_id });
}
```

**File: app/api/polls/[pollId]/vote/route.ts**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  const { user_id, user_name, option_id } = await request.json();
  const sql = getTournamentDb();
  
  // Check if poll is still active
  const poll = await sql`
    SELECT status, closes_at FROM polls 
    WHERE poll_id = ${params.pollId}
  `;
  
  if (poll[0].status !== 'active' || new Date(poll[0].closes_at) < new Date()) {
    return NextResponse.json({ success: false, error: 'Poll is closed' }, { status: 400 });
  }
  
  const vote_id = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Upsert vote (replace if user already voted)
  await sql`
    INSERT INTO poll_votes (vote_id, poll_id, user_id, user_name, selected_option_id)
    VALUES (${vote_id}, ${params.pollId}, ${user_id}, ${user_name}, ${option_id})
    ON CONFLICT (poll_id, user_id) 
    DO UPDATE SET selected_option_id = ${option_id}, voted_at = NOW()
  `;
  
  // Update vote count in options JSON
  await sql`
    UPDATE polls 
    SET options = jsonb_set(
      options,
      ARRAY(SELECT jsonb_array_elements(options) ->> 'id' WHERE jsonb_array_elements(options) ->> 'id' = ${option_id})::text[],
      (SELECT jsonb_array_elements(options) || jsonb_build_object('votes', (jsonb_array_elements(options) ->> 'votes')::int + 1))
    ),
    total_votes = total_votes + 1
    WHERE poll_id = ${params.pollId}
  `;
  
  return NextResponse.json({ success: true });
}
```

### STEP 6: Create Language Toggle Component

**File: components/LanguageToggle.tsx**
```typescript
'use client';

import { useState, useEffect } from 'react';

export default function LanguageToggle() {
  const [language, setLanguage] = useState<'en' | 'ml'>('en');
  
  useEffect(() => {
    const saved = localStorage.getItem('news_language') as 'en' | 'ml';
    if (saved) setLanguage(saved);
  }, []);
  
  const toggleLanguage = (lang: 'en' | 'ml') => {
    setLanguage(lang);
    localStorage.setItem('news_language', lang);
    window.dispatchEvent(new Event('languageChange'));
  };
  
  return (
    <div className="flex items-center gap-2 bg-white rounded-full p-1 shadow-md">
      <button
        onClick={() => toggleLanguage('en')}
        className={`px-4 py-2 rounded-full transition-all ${
          language === 'en'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        English
      </button>
      <button
        onClick={() => toggleLanguage('ml')}
        className={`px-4 py-2 rounded-full transition-all ${
          language === 'ml'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        മലയാളം
      </button>
    </div>
  );
}
```

### STEP 7: Update News Page

**File: app/news/page.tsx - Add language filtering**
```typescript
const [language, setLanguage] = useState<'en' | 'ml'>('en');

useEffect(() => {
  const savedLang = localStorage.getItem('news_language') || 'en';
  setLanguage(savedLang as 'en' | 'ml');
  
  const handleLanguageChange = () => {
    const newLang = localStorage.getItem('news_language') || 'en';
    setLanguage(newLang as 'en' | 'ml');
    fetchNews(); // Refetch with new language
  };
  
  window.addEventListener('languageChange', handleLanguageChange);
  return () => window.removeEventListener('languageChange', handleLanguageChange);
}, []);

// In fetch URL:
params.append('language', language);
```

---

## 🎯 AUTO-TRIGGER POINTS:

### Match Prediction Polls
**Trigger:** When round starts
**File:** `app/api/rounds/[roundId]/start/route.ts` (or wherever round start is handled)
```typescript
// After starting round
const fixtures = await getFixturesForRound(roundId);
for (const fixture of fixtures) {
  await createMatchPredictionPoll(fixture);
}
```

### POTM Polls
**Trigger:** After result entry deadline
**File:** `app/api/fixtures/[fixtureId]/result/route.ts`
```typescript
// After saving result
const deadline = await getResultEntryDeadline(roundId);
if (new Date() >= deadline) {
  await createPOTMPoll(fixtureId);
}
```

### Daily Polls
**Trigger:** After result deadline
**File:** Committee manually or after last result of day
```typescript
await createDailyPolls(matchdayDate, seasonId);
```

---

## 📝 NEXT STEPS:

1. **Run the database migration**
2. **Implement auto-generate.ts updates** (this is the largest task - I can help with specific event types)
3. **Create polls API routes**
4. **Build UI components**
5. **Hook up auto-triggers**
6. **Test workflow**

Would you like me to continue with the full auto-generate.ts implementation showing all prompts for English and Malayalam? It's a very large file (1000+ lines) but essential for the system to work.
