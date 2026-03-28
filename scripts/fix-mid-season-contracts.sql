-- Fix contracts for players signed mid-season 16
-- These players should have contracts from 16.5 to 18.5 (mid-season 16 to mid-season 18)
-- Currently incorrectly saved as 16-17

-- First, let's see the current status
SELECT 
  pc.id,
  fp.name as player_name,
  pc.team_id,
  pc.contract_start,
  pc.contract_end,
  pc.season_id
FROM player_contracts pc
JOIN footballplayers fp ON pc.player_id = fp.id
WHERE fp.name IN (
  'Yeray Álvarez',
  'Eric García',
  'Jordan Pickford',
  'Dominik Livaković',
  'Pierre Kalulu',
  'Stefan Savić',
  'Danilo',
  'Federico Gatti',
  'Morten Hjulmand',
  'Y. Ndayishimiye',
  'Franck Kessié',
  'Khéphren Thuram',
  'Ángel Correa',
  'Karim Adeyemi',
  'Karim Benzema',
  'Nick Woltemade',
  'Callum Wilson',
  'D. Calvert-Lewin',
  'Evann Guessand',
  'Fábio Silva',
  'Martin Braithwaite',
  'Kaio Jorge'
)
ORDER BY fp.name;

-- Update the contracts from 16-17 to 16.5-18.5
UPDATE player_contracts pc
SET 
  contract_start = '16.5',
  contract_end = '18.5',
  updated_at = NOW()
FROM footballplayers fp
WHERE pc.player_id = fp.id
AND fp.name IN (
  'Yeray Álvarez',
  'Eric García',
  'Jordan Pickford',
  'Dominik Livaković',
  'Pierre Kalulu',
  'Stefan Savić',
  'Danilo',
  'Federico Gatti',
  'Morten Hjulmand',
  'Y. Ndayishimiye',
  'Franck Kessié',
  'Khéphren Thuram',
  'Ángel Correa',
  'Karim Adeyemi',
  'Karim Benzema',
  'Nick Woltemade',
  'Callum Wilson',
  'D. Calvert-Lewin',
  'Evann Guessand',
  'Fábio Silva',
  'Martin Braithwaite',
  'Kaio Jorge'
)
AND pc.contract_start = '16'
AND pc.contract_end = '17';

-- Verify the changes
SELECT 
  fp.name as player_name,
  pc.contract_start,
  pc.contract_end,
  pc.team_id,
  pc.season_id
FROM player_contracts pc
JOIN footballplayers fp ON pc.player_id = fp.id
WHERE fp.name IN (
  'Yeray Álvarez',
  'Eric García',
  'Jordan Pickford',
  'Dominik Livaković',
  'Pierre Kalulu',
  'Stefan Savić',
  'Danilo',
  'Federico Gatti',
  'Morten Hjulmand',
  'Y. Ndayishimiye',
  'Franck Kessié',
  'Khéphren Thuram',
  'Ángel Correa',
  'Karim Adeyemi',
  'Karim Benzema',
  'Nick Woltemade',
  'Callum Wilson',
  'D. Calvert-Lewin',
  'Evann Guessand',
  'Fábio Silva',
  'Martin Braithwaite',
  'Kaio Jorge'
)
ORDER BY fp.name;
