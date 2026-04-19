# Combined Budget Fix Report

**Rounds:** SSPSLFBR00008, SSPSLFBR00009, SSPSLFBR00010
**Season:** SSPSLS17

**Generated:** 19/4/2026, 11:46:02 pm

---

## Round Summaries

### SSPSLFBR00008 - Round #1
- Base Price: £10
- Teams affected: 13
- Immediate assignments: 37
- Tiebreaker wins: 7
- Total to deduct: £3779

### SSPSLFBR00009 - Round #2
- Base Price: £10
- Teams affected: 9
- Immediate assignments: 10
- Tiebreaker wins: 1
- Total to deduct: £150

### SSPSLFBR00010 - Round #3
- Base Price: £10
- Teams affected: 1
- Immediate assignments: 1
- Tiebreaker wins: 0
- Total to deduct: £10

---

## Overall Summary

- **Total teams affected:** 13
- **Total players sold:** 56
- **Grand total to deduct:** £3939

---

## Blue Strikers

**Team ID:** SSPSLT0016

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £1831.00 |
| Spent | £30.00 |

### Players Acquired (6 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Bart Verbruggen | GK | £10 |
| ✅ immediate | A. Buongiorno | CB | £10 |
| ✅ immediate | Merih Demiral | CB | £10 |
| 🏆 tiebreaker | Rodrygo | RWF | £649 |
| 🏆 tiebreaker | Kim Min-Jae | CB | £299 |

**Round Subtotals:**
- Immediate: £30
- Tiebreaker: £948
- **Round Total: £978**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Joe Gomez | CB | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

**Team Grand Total: £988**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £1831.00 | -£988 | £843.00 |
| Spent | £30.00 | +£988 | £1018.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 988,
  football_spent = football_spent + 988,
  updated_at = NOW()
WHERE id = 'SSPSLT0016'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0016_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £988
- `football_spent`: INCREASE by £988

---

## FC Barcelona

**Team ID:** SSPSLT0006

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £3395.70 |
| Spent | £30.00 |

### Players Acquired (3 total across 3 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Ciro Immobile | CF | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Pepelu | DMF | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

#### SSPSLFBR00010 - Round #3

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Nathan Aké | CB | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

**Team Grand Total: £30**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £3395.70 | -£30 | £3365.70 |
| Spent | £30.00 | +£30 | £60.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 30,
  football_spent = football_spent + 30,
  updated_at = NOW()
WHERE id = 'SSPSLT0006'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0006_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £30
- `football_spent`: INCREASE by £30

---

## La Masia

**Team ID:** SSPSLT0008

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £3946.80 |
| Spent | £20.00 |

### Players Acquired (4 total across 1 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Manuel Ugarte | DMF | £10 |
| ✅ immediate | Patrik Schick | CF | £10 |
| ✅ immediate | Levi Colwill | CB | £10 |
| ✅ immediate | Piero Hincapié | CB | £10 |

**Round Subtotals:**
- Immediate: £40
- Tiebreaker: £0
- **Round Total: £40**

**Team Grand Total: £40**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £3946.80 | -£40 | £3906.80 |
| Spent | £20.00 | +£40 | £60.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 40,
  football_spent = football_spent + 40,
  updated_at = NOW()
WHERE id = 'SSPSLT0008'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0008_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £40
- `football_spent`: INCREASE by £40

---

## Legends FC

**Team ID:** SSPSLT0015

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £4016.70 |
| Spent | £30.00 |

### Players Acquired (3 total across 1 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Juan Brunetta | AMF | £10 |
| ✅ immediate | Lee Kang-In | RWF | £10 |
| ✅ immediate | Leandro Trossard | LWF | £10 |

**Round Subtotals:**
- Immediate: £30
- Tiebreaker: £0
- **Round Total: £30**

**Team Grand Total: £30**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £4016.70 | -£30 | £3986.70 |
| Spent | £30.00 | +£30 | £60.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 30,
  football_spent = football_spent + 30,
  updated_at = NOW()
WHERE id = 'SSPSLT0015'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0015_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £30
- `football_spent`: INCREASE by £30

---

## Los Blancos

**Team ID:** SSPSLT0034

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £1969.72 |
| Spent | £30.00 |

### Players Acquired (4 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Fabián Ruiz | CMF | £10 |
| ✅ immediate | Nico Paz | AMF | £10 |

**Round Subtotals:**
- Immediate: £20
- Tiebreaker: £0
- **Round Total: £20**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Ousmane Diomande | CB | £10 |
| ✅ immediate | Allan Saint-Maximin | LWF | £10 |

**Round Subtotals:**
- Immediate: £20
- Tiebreaker: £0
- **Round Total: £20**

**Team Grand Total: £40**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £1969.72 | -£40 | £1929.72 |
| Spent | £30.00 | +£40 | £70.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 40,
  football_spent = football_spent + 40,
  updated_at = NOW()
WHERE id = 'SSPSLT0034'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0034_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £40
- `football_spent`: INCREASE by £40

---

## Los Galacticos

**Team ID:** SSPSLT0021

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £2994.30 |
| Spent | £30.00 |

### Players Acquired (4 total across 1 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Youssouf Fofana | CMF | £10 |
| ✅ immediate | Giorgi Mamardashvili | GK | £10 |
| ✅ immediate | Léo Ortiz | CB | £10 |
| 🏆 tiebreaker | Semih Kılıçsoy | CF | £1760 |

**Round Subtotals:**
- Immediate: £30
- Tiebreaker: £1760
- **Round Total: £1790**

**Team Grand Total: £1790**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £2994.30 | -£1790 | £1204.30 |
| Spent | £30.00 | +£1790 | £1820.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 1790,
  football_spent = football_spent + 1790,
  updated_at = NOW()
WHERE id = 'SSPSLT0021'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0021_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £1790
- `football_spent`: INCREASE by £1790

---

## Manchester United

**Team ID:** SSPSLT0002

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £2063.90 |
| Spent | £30.00 |

### Players Acquired (5 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Nicolas Jackson | CF | £10 |
| ✅ immediate | Emre Can | DMF | £10 |
| ✅ immediate | Nicolás Otamendi | CB | £10 |
| 🏆 tiebreaker | Felix Nmecha | DMF | £500 |

**Round Subtotals:**
- Immediate: £30
- Tiebreaker: £500
- **Round Total: £530**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Waldemar Anton | CB | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

**Team Grand Total: £540**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £2063.90 | -£540 | £1523.90 |
| Spent | £30.00 | +£540 | £570.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 540,
  football_spent = football_spent + 540,
  updated_at = NOW()
WHERE id = 'SSPSLT0002'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0002_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £540
- `football_spent`: INCREASE by £540

---

## Psychoz

**Team ID:** SSPSLT0013

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £4107.00 |
| Spent | £30.00 |

### Players Acquired (3 total across 1 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Idrissa Guèye | DMF | £10 |
| ✅ immediate | Olivier Giroud | CF | £10 |
| ✅ immediate | Paul Onuachu | CF | £10 |

**Round Subtotals:**
- Immediate: £30
- Tiebreaker: £0
- **Round Total: £30**

**Team Grand Total: £30**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £4107.00 | -£30 | £4077.00 |
| Spent | £30.00 | +£30 | £60.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 30,
  football_spent = football_spent + 30,
  updated_at = NOW()
WHERE id = 'SSPSLT0013'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0013_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £30
- `football_spent`: INCREASE by £30

---

## Qatar Gladiators

**Team ID:** SSPSLT0009

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £755.78 |
| Spent | £30.00 |

### Players Acquired (6 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Takumi Minamino | AMF | £10 |
| ✅ immediate | Terem Moffi | CF | £10 |
| ✅ immediate | Jonathan Burkardt | CF | £10 |
| ✅ immediate | Warren Zaïre-Emery | CMF | £10 |
| ✅ immediate | Yeremy Pino | SS | £10 |

**Round Subtotals:**
- Immediate: £50
- Tiebreaker: £0
- **Round Total: £50**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| 🏆 tiebreaker | Kevin Danso | CB | £50 |

**Round Subtotals:**
- Immediate: £0
- Tiebreaker: £50
- **Round Total: £50**

**Team Grand Total: £100**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £755.78 | -£100 | £655.78 |
| Spent | £30.00 | +£100 | £130.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 100,
  football_spent = football_spent + 100,
  updated_at = NOW()
WHERE id = 'SSPSLT0009'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0009_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £100
- `football_spent`: INCREASE by £100

---

## Red Hawks FC

**Team ID:** SSPSLT0004

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £1775.00 |
| Spent | £30.00 |

### Players Acquired (3 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Carlos Augusto | LB | £10 |
| 🏆 tiebreaker | Beto | CF | £170 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £170
- **Round Total: £180**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Frank Zambo Anguissa | CMF | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

**Team Grand Total: £190**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £1775.00 | -£190 | £1585.00 |
| Spent | £30.00 | +£190 | £220.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 190,
  football_spent = football_spent + 190,
  updated_at = NOW()
WHERE id = 'SSPSLT0004'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0004_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £190
- `football_spent`: INCREASE by £190

---

## Skill 555

**Team ID:** SSPSLT0020

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £1727.10 |
| Spent | £30.00 |

### Players Acquired (4 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Portu | AMF | £10 |
| ✅ immediate | Wesley Fofana | CB | £10 |
| ✅ immediate | Matteo Darmian | RB | £10 |

**Round Subtotals:**
- Immediate: £30
- Tiebreaker: £0
- **Round Total: £30**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Adrien Rabiot | CMF | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

**Team Grand Total: £40**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £1727.10 | -£40 | £1687.10 |
| Spent | £30.00 | +£40 | £70.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 40,
  football_spent = football_spent + 40,
  updated_at = NOW()
WHERE id = 'SSPSLT0020'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0020_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £40
- `football_spent`: INCREASE by £40

---

## TM Asgardians

**Team ID:** SSPSLT0005

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £1574.00 |
| Spent | £30.00 |

### Players Acquired (5 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Brennan Johnson | SS | £10 |
| ✅ immediate | Lewis Hall | LB | £10 |
| 🏆 tiebreaker | Sven Botman | CB | £20 |

**Round Subtotals:**
- Immediate: £20
- Tiebreaker: £20
- **Round Total: £40**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Kingsley Coman | LWF | £10 |
| ✅ immediate | Ivan Toney | CF | £10 |

**Round Subtotals:**
- Immediate: £20
- Tiebreaker: £0
- **Round Total: £20**

**Team Grand Total: £60**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £1574.00 | -£60 | £1514.00 |
| Spent | £30.00 | +£60 | £90.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 60,
  football_spent = football_spent + 60,
  updated_at = NOW()
WHERE id = 'SSPSLT0005'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0005_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £60
- `football_spent`: INCREASE by £60

---

## Varsity Soccers

**Team ID:** SSPSLT0010

### Current State (Neon)

| Field | Value |
|-------|-------|
| Budget | £3820.20 |
| Spent | £30.00 |

### Players Acquired (6 total across 2 rounds)

#### SSPSLFBR00008 - Round #1

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Edson Álvarez | DMF | £10 |
| ✅ immediate | Malik Tillman | AMF | £10 |
| ✅ immediate | Gerard Martín | LB | £10 |
| ✅ immediate | Yassine Bounou | GK | £10 |
| 🏆 tiebreaker | Enzo Boyomo | CB | £11 |

**Round Subtotals:**
- Immediate: £40
- Tiebreaker: £11
- **Round Total: £51**

#### SSPSLFBR00009 - Round #2

| Type | Player | Position | Amount |
|------|--------|----------|--------|
| ✅ immediate | Luciano | SS | £10 |

**Round Subtotals:**
- Immediate: £10
- Tiebreaker: £0
- **Round Total: £10**

**Team Grand Total: £61**

### After Deduction

| Field | Current | Change | New Value |
|-------|---------|--------|----------|
| Budget | £3820.20 | -£61 | £3759.20 |
| Spent | £30.00 | +£61 | £91.00 |

### SQL to Execute (Neon)

```sql
UPDATE teams
SET 
  football_budget = football_budget - 61,
  football_spent = football_spent + 61,
  updated_at = NOW()
WHERE id = 'SSPSLT0010'
AND season_id = 'SSPSLS17';
```

### Firebase Update

**Document:** `team_seasons/SSPSLT0010_SSPSLS17`

**Fields to update:**
- `football_budget`: DECREASE by £61
- `football_spent`: INCREASE by £61

---

## Final Summary Table

| Team | Total Players | Total Amount |
|------|--------------|-------------|
| Blue Strikers | 6 | £988 |
| FC Barcelona | 3 | £30 |
| La Masia | 4 | £40 |
| Legends FC | 3 | £30 |
| Los Blancos | 4 | £40 |
| Los Galacticos | 4 | £1790 |
| Manchester United | 5 | £540 |
| Psychoz | 3 | £30 |
| Qatar Gladiators | 6 | £100 |
| Red Hawks FC | 3 | £190 |
| Skill 555 | 4 | £40 |
| TM Asgardians | 5 | £60 |
| Varsity Soccers | 6 | £61 |

**GRAND TOTAL: £3939**

---

## Instructions

1. Review each team's data carefully
2. For each team you want to fix:
   - Copy the SQL statement and run it in your Neon console
   - Update the Firebase document using the budget sync page or Firebase console
3. Verify the changes after applying

**Budget Sync Page:** http://localhost:3000/dashboard/committee/reports/budget-sync

