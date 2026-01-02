# Poll Creation - Malayalam Translation Fix

**Date:** 2026-01-02 12:32  
**Error:** "Both question_en and question_ml are required"  
**Fix:** Added Malayalam translations for poll questions

---

## 🐛 Problem

Poll creation was failing with error:
```
Both question_en and question_ml are required
```

The code was sending `question_ar` (Arabic) but the API expects `question_ml` (Malayalam).

---

## ✅ Solution

### 1. **Fixed Field Names**
Changed from `question_ar` to `question_ml`:

**Before:**
```typescript
const payload = {
  question_en: question,
  question_ar: question,  // ❌ Wrong field name
  ...
};
```

**After:**
```typescript
const payload = {
  question_en: questionEn,
  question_ml: questionMl,  // ✅ Correct field name
  ...
};
```

### 2. **Added Malayalam Translations**

Added proper Malayalam translations for poll questions:

```typescript
// English questions
const questionEn = isPlayer
  ? `Who should win ${activeTab === 'POTD' ? 'Player of the Day' : 'Player of the Week'}?`
  : `Which team should win ${activeTab === 'TOD' ? 'Team of the Day' : 'Team of the Week'}?`;

// Malayalam questions
const questionMl = isPlayer
  ? `${activeTab === 'POTD' ? 'ദിവസത്തെ മികച്ച കളിക്കാരൻ' : 'ആഴ്ചയിലെ മികച്ച കളിക്കാരൻ'} ആരായിരിക്കണം?`
  : `${activeTab === 'TOD' ? 'ദിവസത്തെ മികച്ച ടീം' : 'ആഴ്ചയിലെ മികച്ച ടീം'} ഏതായിരിക്കണം?`;
```

### 3. **Fixed Option Text**

Changed `text_ar` to `text_ml` for options:

**Before:**
```typescript
const options = candidates.map((candidate, idx) => ({
  text_en: candidate.player_name || candidate.team_name,
  text_ar: candidate.player_name || candidate.team_name,  // ❌ Wrong field
}));
```

**After:**
```typescript
const options = candidates.map((candidate, idx) => ({
  text_en: candidate.player_name || candidate.team_name,
  text_ml: candidate.player_name || candidate.team_name,  // ✅ Correct field
}));
```

---

## 📝 Malayalam Translations

### POTD (Player of the Day)
- **English**: "Who should win Player of the Day?"
- **Malayalam**: "ദിവസത്തെ മികച്ച കളിക്കാരൻ ആരായിരിക്കണം?"

### POTW (Player of the Week)
- **English**: "Who should win Player of the Week?"
- **Malayalam**: "ആഴ്ചയിലെ മികച്ച കളിക്കാരൻ ആരായിരിക്കണം?"

### TOD (Team of the Day)
- **English**: "Which team should win Team of the Day?"
- **Malayalam**: "ദിവസത്തെ മികച്ച ടീം ഏതായിരിക്കണം?"

### TOW (Team of the Week)
- **English**: "Which team should win Team of the Week?"
- **Malayalam**: "ആഴ്ചയിലെ മികച്ച ടീം ഏതായിരിക്കണം?"

---

## 🎯 Result

Poll creation now works with proper bilingual support:

```json
{
  "season_id": "SSPSLS16",
  "poll_type": "award_potw",
  "question_en": "Who should win Player of the Week?",
  "question_ml": "ആഴ്ചയിലെ മികച്ച കളിക്കാരൻ ആരായിരിക്കണം?",
  "options": [
    {
      "text_en": "Muhammed Fijas",
      "text_ml": "Muhammed Fijas"
    },
    {
      "text_en": "Gokul GC",
      "text_ml": "Gokul GC"
    }
  ]
}
```

---

## ✅ Benefits

1. **Bilingual Support**: Polls now support both English and Malayalam
2. **API Compliance**: Meets API requirements for both languages
3. **User Experience**: Malayalam-speaking fans can read polls in their language
4. **Consistency**: All poll types have proper translations

---

**Status:** ✅ **FIXED**  
**Testing:** Poll creation should now work successfully  
**Languages:** English + Malayalam (മലയാളം)
