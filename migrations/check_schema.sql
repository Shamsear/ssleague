-- Check the data type of the id column in footballplayers table
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'footballplayers' 
AND column_name = 'id';

-- Check all columns in footballplayers
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'footballplayers'
ORDER BY ordinal_position;
