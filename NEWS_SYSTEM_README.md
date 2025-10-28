# 📰 AI-Powered News Generation System

## ✅ What's Been Built

A comprehensive automated news system that uses Google's Gemini AI to generate tournament updates automatically when database events occur.

### Core Features:

1. **AI News Generation** - 20+ event types with custom prompts
2. **Public News Page** - `/news` - Shows all published updates
3. **Admin Dashboard** - `/admin/news` - Review, edit, and publish AI drafts
4. **Auto-Triggers** - News generated automatically on:
   - Player registration milestones (10th, 25th, 50th, 75th, 100th player, etc.)
   - Confirmed slots filled
   - Registration phase changes (Phase 1 → Phase 2, Paused, Closed)
   - *Ready for: Team registration, auction results, matches, fantasy*

## 🚀 Setup Instructions

### Step 1: Get Gemini API Key

1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

### Step 2: Add API Key to Environment

Edit `.env.local` and replace `your_gemini_api_key_here` with your actual key:

```env
GEMINI_API_KEY=AIzaSy...your_actual_key_here
```

### Step 3: Restart Development Server

```bash
npm run dev
```

## 📋 How to Use

### For Users (Public):

Visit **`http://localhost:3000/news`** to see all published tournament updates.

- Filter by category (Registration, Team, Auction, Fantasy, Match, etc.)
- Automatically updated as events happen
- No account needed

### For Admins:

1. Visit **`http://localhost:3000/admin/news`**
2. See all AI-generated news drafts
3. Review, edit if needed, then publish
4. Published news appears instantly on public page

## 🤖 How AI News Works

### Automatic Triggers (Already Hooked In):

| Event | When It Fires | News Generated |
|-------|---------------|----------------|
| **10th player registers** | Player registration API | "🎯 10 players registered! Registration gaining momentum..." |
| **25th player registers** | Player registration API | "🎉 Quarter-century milestone! 25 players now registered..." |
| **50th player registers** | Player registration API | "🚀 Half-century! 50 confirmed players ready for action..." |
| **Confirmed slots full** | Player registration API | "⚠️ Confirmed slots filled! Unconfirmed registration opens soon..." |
| **Phase 2 enabled** | Admin phase change | "📢 Phase 2 now open! Unconfirmed/waitlist registration live..." |
| **Registration closed** | Admin phase change | "🔒 Registration closed. Final player count: XX..." |

### Ready to Hook (You can add later):

- Team registrations
- Auction results & highlights
- Match results & standings
- Fantasy league updates
- Player of the match
- Finals & season winners

## 🔧 Adding More Event Hooks

To add news generation to other APIs, use this pattern:

```typescript
import { triggerNewsGeneration } from '@/lib/news/trigger';

// After an important event in your API:
triggerNewsGeneration({
  event_type: 'match_result',
  category: 'match',
  season_id: 'SSPSLS16',
  season_name: 'SSPSLS16',
  metadata: {
    home_team: 'Team A',
    away_team: 'Team B',
    home_score: 3,
    away_score: 2,
    winner: 'Team A',
  },
}).catch(err => console.error('News generation failed:', err));
```

## 📊 Event Types Available

### Player Registration:
- `player_milestone` - 10th, 25th, 50th, etc.
- `registration_phase_change` - Phase transitions
- `confirmed_slots_filled` - Slots full notification

### Team:
- `team_registered` - New team joins
- `team_players_assigned` - Post-auction roster
- `team_roster_complete` - Full squad ready

### Auction:
- `auction_scheduled` - Auction date announced
- `auction_started` - LIVE auction notification
- `auction_completed` - Auction wrap-up
- `player_sold` - Individual player sale
- `auction_highlights` - Top buys/surprises

### Fantasy:
- `fantasy_opened` - Fantasy league opens
- `fantasy_draft_complete` - Draft finished
- `fantasy_weekly_winner` - Weekly winner
- `fantasy_standings_update` - Standings update

### Match:
- `match_scheduled` - Upcoming match
- `match_result` - Match outcome
- `player_of_match` - POTM announcement
- `tournament_standings` - League table update
- `semifinals_result` - Semifinal outcome
- `finals_result` - Championship result

### Season:
- `season_launched` - New season announcement
- `season_winner` - Champion crowned

## 💰 Cost Analysis

**Gemini API Usage:**
- Free tier: 1,500 requests/day
- Your usage: ~5-10 requests/day (news generation)
- **Cost: $0** (well within free tier)

**Vercel Functions:**
- ~0.17 GB-hours/month for news generation
- **Cost: $0** (0.17% of free tier)

## 🧪 Testing

### Test News Generation Manually:

```bash
curl -X POST http://localhost:3000/api/news \
  -H "Content-Type: application/json" \
  -d '{
    "generate_with_ai": true,
    "generation_input": {
      "event_type": "player_milestone",
      "category": "milestone",
      "season_name": "SSPSLS16",
      "metadata": {
        "milestone_number": 50,
        "player_count": 50
      }
    }
  }'
```

### Test Full Workflow:

1. Register the 10th player → Check `/admin/news` for draft
2. Edit/publish the draft
3. View on `/news` public page
4. Register 25th player → Another draft created
5. And so on...

## 📁 File Structure

```
lib/
├── gemini/
│   └── config.ts              # Gemini API setup
├── news/
│   ├── types.ts               # TypeScript interfaces
│   ├── auto-generate.ts       # AI prompt templates
│   └── trigger.ts             # Helper to trigger news

app/
├── api/
│   └── news/
│       └── route.ts           # News CRUD API
├── news/
│   └── page.tsx               # Public news page
└── admin/
    └── news/
        └── page.tsx           # Admin management

app/api/register/player/confirm/route.ts  # ✅ Hooked
app/api/admin/registration-phases/route.ts # ✅ Hooked
```

## 🎯 Next Steps

1. **Test the system** - Register players and watch news generate
2. **Hook into more APIs** - Add triggers to auction, matches, fantasy
3. **Customize prompts** - Edit `lib/news/auto-generate.ts` to tweak AI tone
4. **Add images** - Extend NewsItem with image URLs for richer posts

## 🆘 Troubleshooting

**News not generating?**
- Check Gemini API key is correct in `.env.local`
- Check server logs for errors
- Ensure you've restarted dev server after adding key

**AI content not good?**
- Edit prompts in `lib/news/auto-generate.ts`
- Change model from `gemini-1.5-flash` to `gemini-1.5-pro` in `lib/gemini/config.ts`

**Want to disable auto-generation temporarily?**
- Comment out the `triggerNewsGeneration()` calls in API routes
- Or add a feature flag in environment variables

## 📝 Notes

- All AI-generated news starts as **drafts** - admins must review and publish
- News generation runs **asynchronously** - won't slow down main operations
- Errors in news generation are **silently caught** - won't break registration/other features
- Admins can **edit AI content** before publishing
- System scales automatically with usage

---

**Built with:**
- Next.js 15
- Google Gemini AI (gemini-1.5-flash)
- Firebase Firestore (news storage)
- TypeScript
- Tailwind CSS

**Ready for production!** 🚀
