const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Decrypt function for encrypted bid amounts
function decrypt(encryptedText) {
  if (!encryptedText || !ENCRYPTION_KEY) return null;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return parseInt(decrypted.toString());
  } catch (error) {
    return null;
  }
}

const releasedPlayers = [
  { name: 'Jackson Tchatchoua', team: 'LA MASIA FC' },
  { name: 'Nicola Zalewski', team: 'LA MASIA FC' },
  { name: 'Andrej Kramarić', team: 'LA MASIA FC' },
  { name: 'Jacob Ramsey', team: 'SKILL 555' },
  { name: 'Leon Bailey', team: 'SKILL 555' },
  { name: 'Paulinho', team: 'SKILL 555' },
  { name: 'Ander Barrenetxea', team: 'KOPITES' },
  { name: 'Julio Enciso', team: 'KOPITES' },
  { name: 'Iliman Ndiaye', team: 'LEGENDS FC' },
  { name: 'Simon Adingra', team: 'LEGENDS FC' },
  { name: 'Pedro Porro', team: 'LOS GALACTICOS' },
  { name: 'Giacomo Raspadori', team: 'LOS GALACTICOS' },
  { name: 'Kevin Danso', team: 'VARSITY SOCCERS' },
  { name: 'Dwight McNeil', team: 'VARSITY SOCCERS' },
  { name: 'Francisco Conceição', team: 'PORTLAND TIMBERS' },
  { name: 'Kim Min-jae', team: 'PORTLAND TIMBERS' },
  { name: 'Pablo Barrios', team: 'MANCHESTER UNITED' },
  { name: 'Noussair Mazraoui', team: 'MANCHESTER UNITED' },
  { name: 'Jarrad Branthwaite', team: 'FC BARCELONA' },
  { name: 'Nico González', team: 'FC BARCELONA' },
  { name: 'Álex Zendejas', team: 'QATAR GLADIATORS' }
];

async function previewAuctionAmounts() {
  console.log('Fetching auction amounts for released football players...\n');
  console.log('='.repeat(80));
  console.log('PREVIEW MODE - No changes will be made\n');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const player of releasedPlayers) {
    const searchName = player.name.toLowerCase();
    
    // First, get the id (primary key) from footballplayers table - this is what bids table uses
    const playerRecords = await sql`
      SELECT id, player_id, name, team_name
      FROM footballplayers
      WHERE LOWER(name) LIKE ${`%${searchName}%`}
      LIMIT 1
    `;
    
    if (playerRecords.length === 0) {
      results.push({
        name: player.name,
        team: player.team,
        status: 'NOT FOUND IN DATABASE',
        auctionAmount: null,
        refund75: null
      });
      continue;
    }
    
    const footballPlayerId = playerRecords[0].id; // This is the id used in bids table
    const actualName = playerRecords[0].name;
    
    // Search in bids table for this player
    let auctionAmount = null;
    let source = null;
    
    // Try bids table first - use the id from footballplayers table
    const bids = await sql`
      SELECT amount, actual_bid_amount, encrypted_bid_data, season_id, round_id
      FROM bids
      WHERE player_id = ${footballPlayerId}
        AND status = 'won'
        AND season_id = 'SSPSLS16'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    if (bids.length > 0) {
      const bid = bids[0];
      
      // Try actual_bid_amount first (most reliable)
      if (bid.actual_bid_amount) {
        auctionAmount = bid.actual_bid_amount;
        source = `bids (actual_bid_amount) - Round: ${bid.round_id}`;
      }
      // Try to get amount from encrypted field
      else if (bid.encrypted_bid_data) {
        const decrypted = decrypt(bid.encrypted_bid_data);
        if (decrypted !== null) {
          auctionAmount = decrypted;
          source = `bids (encrypted) - Round: ${bid.round_id}`;
        }
      }
      // If not encrypted or decryption failed, use plain amount
      else if (bid.amount) {
        auctionAmount = parseInt(bid.amount);
        source = `bids (amount) - Round: ${bid.round_id}`;
      }
    }
    
    const refund75 = auctionAmount ? Math.floor(auctionAmount * 0.75) : 0;
    
    results.push({
      name: actualName,
      team: player.team,
      footballPlayerId: footballPlayerId,
      auctionAmount: auctionAmount || 0,
      refund75: refund75,
      source: source || 'NOT FOUND IN AUCTION TABLES',
      status: auctionAmount ? 'FOUND' : 'NO AUCTION DATA'
    });
  }
  
  // Display results grouped by team
  const byTeam = new Map();
  results.forEach(r => {
    if (!byTeam.has(r.team)) {
      byTeam.set(r.team, []);
    }
    byTeam.get(r.team).push(r);
  });
  
  console.log('\nRESULTS BY TEAM:\n');
  
  for (const [team, players] of byTeam.entries()) {
    console.log(`\n${team}:`);
    players.forEach(p => {
      const statusIcon = p.status === 'FOUND' ? '✅' : '⚠️';
      console.log(`  ${statusIcon} ${p.name}`);
      console.log(`     Football Player ID: ${p.footballPlayerId || 'N/A'}`);
      console.log(`     Auction Amount: ${p.auctionAmount}`);
      console.log(`     75% Refund: ${p.refund75}`);
      console.log(`     Source: ${p.source}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Summary
  const found = results.filter(r => r.status === 'FOUND').length;
  const notFound = results.filter(r => r.status !== 'FOUND').length;
  const totalRefund = results.reduce((sum, r) => sum + r.refund75, 0);
  
  console.log('\nSUMMARY:');
  console.log(`  Total players: ${results.length}`);
  console.log(`  Found auction data: ${found}`);
  console.log(`  No auction data: ${notFound}`);
  console.log(`  Total 75% refund amount: ${totalRefund}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\nPREVIEW COMPLETE - No changes made to database');
  console.log('Review the amounts above before proceeding with updates');
  
  process.exit(0);
}

previewAuctionAmounts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
