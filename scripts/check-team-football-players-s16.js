const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const auctionSql = neon(process.env.DATABASE_URL);
const seasonId = 'SSPSLS16';

const teams = [
  { name: 'KOPITES', id: 'SSPSLT0023' },
  { name: 'FC BARCELONA', id: 'SSPSLT0006' },
  { name: 'QATAR GLADIATORS', id: 'SSPSLT0009' }
];

async function checkPlayers() {
  for (const team of teams) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${team.name} (${team.id})`);
    console.log(`${'='