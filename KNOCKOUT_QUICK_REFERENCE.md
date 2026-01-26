# Knockout Formats & Scoring - Quick Reference

## 🎯 Three Formats

| Format | Fixtures | Matchups | Best For |
|--------|----------|----------|----------|
| **Single Leg** | 1 | 5 (1v1 to 5v5) | Quick elimination |
| **Two-Legged** | 2 (H+A) | 5 per leg | Fair home/away balance |
| **Round Robin** | 1 | 25 (all vs all) | Comprehensive comparison |

## ⚽ Two Scoring Systems

| System | Win | Draw | Loss | Winner By |
|--------|-----|------|------|-----------|
| **Goal-Based** | Goals count | Goals count | Goals count | Most total goals |
| **Win-Based** | 3 points | 1 point each | 0 points | Most total points |

## 🔧 Quick Setup

### Committee Dashboard
1. Go to Tournament Management
2. Select tournament
3. Choose:
   - **Knockout Format**: Single Leg / Two-Legged / Round Robin
   - **Scoring System**: Goal-Based / Win-Based
   - **Matchup Mode**: Manual / Blind Lineup
4. Click "Generate Knockout Fixtures"

### Team Dashboard
1. Go to Matches
2. Click on knockout fixture
3. System automatically uses fixture's scoring system
4. Enter results normally
5. Share via WhatsApp (auto-formats correctly)

## 📊 Examples

### Single Leg + Goals
```
5 matchups → Sum goals → Winner
Home: 12 goals, Away: 10 goals → Home wins
```

### Single Leg + Wins
```
5 matchups → Count points
Home: 2 wins + 1 draw = 7 pts
Away: 2 wins + 1 draw = 7 pts
Result: Draw (or use tiebreaker)
```

### Two-Legged + Goals
```
Home Leg: Home 8-6 Away
Away Leg: Away 7-5 Home
Aggregate: Home 13-13 Away → Draw
```

### Round Robin + Wins
```
25 matchups
Home: 15 wins + 5 draws = 50 pts
Away: 8 wins + 7 draws = 31 pts
Winner: Home
```

## 🎮 Matchup Modes

### Manual
- Teams create matchups manually
- Full control over player pairings
- Can edit until deadline

### Blind Lineup
- Teams submit player order
- Auto-creates matchups (1v1, 2v2, etc.)
- No editing after creation

## 🔄 Penalties

### Goal-Based
- Substitution penalty = +2 or +3 **goals** to opponent
- Fine/violation = **goals** to opponent

### Win-Based
- Substitution penalty = +2 or +3 **points** to opponent
- Fine/violation = **points** to opponent

## 📱 WhatsApp Share

Automatically adapts:
- Shows "goals" or "points" based on system
- Calculates totals correctly
- Displays winner accurately

## 🗄️ Database

```sql
-- Fixtures table
scoring_system VARCHAR(20) DEFAULT 'goals'
knockout_format VARCHAR(20) DEFAULT 'single_leg'

-- Values
scoring_system: 'goals' | 'wins'
knockout_format: 'single_leg' | 'two_leg' | 'round_robin'
```

## ✅ Checklist

Before generating knockout:
- [ ] Choose format (single/two-leg/round-robin)
- [ ] Choose scoring (goals/wins)
- [ ] Choose matchup mode (manual/blind)
- [ ] Set start date
- [ ] Verify group stage complete (if applicable)

After generation:
- [ ] Verify fixtures created
- [ ] Check scoring system in fixture details
- [ ] Test result entry
- [ ] Test WhatsApp share

## 🚨 Common Issues

**Issue**: Wrong scoring shown
**Fix**: Check fixture.scoring_system field

**Issue**: Penalties not counting
**Fix**: Verify penalty type matches scoring system

**Issue**: WhatsApp shows wrong units
**Fix**: Reload fixture page to fetch latest scoring_system

## 📞 Quick Commands

```bash
# Check fixture scoring
SELECT id, knockout_format, scoring_system 
FROM fixtures 
WHERE knockout_round IS NOT NULL;

# Update scoring system
UPDATE fixtures 
SET scoring_system = 'wins' 
WHERE id = 'fixture_id';

# Set all knockout to goal-based
UPDATE fixtures 
SET scoring_system = 'goals' 
WHERE knockout_round IS NOT NULL;
```

---

**Need Help?** Check `KNOCKOUT_SCORING_SYSTEMS_COMPLETE.md` for full details.
