import { sql } from '../lib/neon/config';

async function addIsStarredColumn() {
  try {
    console.log('🔄 Adding is_starred column to footballplayers table...');
    
    // Add is_starred column with default value false
    await sql`
      ALTER TABLE footballplayers 
      ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false
    `;
    
    console.log('✅ Successfully added is_starred column!');
    
    // Verify the column was added
    const result = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'footballplayers' 
      AND column_name = 'is_starred'
    `;
    
    console.log('✅ Column verified:', result);
    
  } catch (error) {
    console.error('❌ Error adding is_starred column:', error);
    throw error;
  }
}

// Run the migration
addIsStarredColumn()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
