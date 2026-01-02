import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

(async () => {
    const r = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='teams' 
    ORDER BY ordinal_position
  `;
    console.log('Teams columns:', r.map((x: any) => x.column_name).join(', '));
})().catch(console.error);
