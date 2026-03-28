-- PREVIEW: Check contracts that will be updated
-- These players should have contracts from 16.5 to 18.5 (mid-season 16 to mid-season 18)
-- Currently showing as 16-17

-- Show current contracts for these players
SELECT 
  pc.id as contract_id,
  fp.name as player_name,
  pc.team_id,
  pc.contract_start as current_start,
  pc.contract_end as current_end,
  '16.5' as new_start,
  '18.5' as new_end,
  pc.season_id,
  pc.created_at
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
AND pc.contract_start = '16'
AND pc.contract_end = '17'
ORDER BY fp.name;

-- Count how many will be updated
SELECT 
  COUNT(*) as total_contracts_to_update
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
AND pc.contract_start = '16'
AND pc.contract_end = '17';

-- Check if any players already have correct contracts
SELECT 
  fp.name as player_name,
  pc.contract_start,
  pc.contract_end,
  'Already Correct' as status
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
AND pc.contract_start = '16.5'
AND pc.contract_end = '18.5'
ORDER BY fp.name;

-- Check if any players are not found
SELECT 
  player_name,
  'Not Found' as status
FROM (
  VALUES 
    ('Yeray Álvarez'),
    ('Eric García'),
    ('Jordan Pickford'),
    ('Dominik Livaković'),
    ('Pierre Kalulu'),
    ('Stefan Savić'),
    ('Danilo'),
    ('Federico Gatti'),
    ('Morten Hjulmand'),
    ('Y. Ndayishimiye'),
    ('Franck Kessié'),
    ('Khéphren Thuram'),
    ('Ángel Correa'),
    ('Karim Adeyemi'),
    ('Karim Benzema'),
    ('Nick Woltemade'),
    ('Callum Wilson'),
    ('D. Calvert-Lewin'),
    ('Evann Guessand'),
    ('Fábio Silva'),
    ('Martin Braithwaite'),
    ('Kaio Jorge')
) AS players(player_name)
WHERE player_name NOT IN (
  SELECT fp.name
  FROM player_contracts pc
  JOIN footballplayers fp ON pc.player_id = fp.id
  WHERE pc.contract_start = '16'
  AND pc.contract_end = '17'
)
AND player_name NOT IN (
  SELECT fp.name
  FROM player_contracts pc
  JOIN footballplayers fp ON pc.player_id = fp.id
  WHERE pc.contract_start = '16.5'
  AND pc.contract_end = '18.5'
);
