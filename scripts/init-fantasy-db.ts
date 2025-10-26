import { Pool } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function initFantasyDatabase() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  
  try {
    console.log('🚀 Initializing Fantasy League Database...\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/migrations/fantasy-league-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Ensure public schema exists and set as default
    await client.query('CREATE SCHEMA IF NOT EXISTS public');
    await client.query('SET search_path TO public');
    
    // Execute the schema statement by statement
    console.log('📝 Creating tables...');
    
    // Remove comments and split properly
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Split by semicolon and filter
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 10); // Ignore empty or very short statements
    
    for (const statement of statements) {
      if (statement.toLowerCase().includes('create table')) {
        const tableName = statement.match(/CREATE\s+TABLE\s+(\w+)/i)?.[1];
        console.log(`  Creating table: ${tableName}`);
      } else if (statement.toLowerCase().includes('create index')) {
        const indexName = statement.match(/CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)?.[1];
        console.log(`  Creating index: ${indexName}`);
      }
      
      try {
        await client.query(statement);
      } catch (err: any) {
        console.error(`\n\u274c Error executing statement:`, err.message);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
        throw err;
      }
    }

    console.log('✅ Fantasy database initialized successfully!\n');

    // Test the connection and show tables
    const result = await client.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       ORDER BY table_name`
    );

    console.log('📊 Created tables:');
    result.rows.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });

    console.log('\n✨ Fantasy database is ready to use!');
  } catch (error) {
    console.error('❌ Error initializing fantasy database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initFantasyDatabase();
