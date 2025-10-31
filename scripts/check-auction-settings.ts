import { getAuctionDb } from '../lib/neon/auction-config';

const sql = getAuctionDb();

sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'auction_settings' ORDER BY ordinal_position`
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error);
