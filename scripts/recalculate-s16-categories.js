// Script to recalculate categories for Season 16
async function recalculateCategories() {
  try {
    console.log('🔄 Recalculating categories for Season 16...\n');
    
    const response = await fetch('http://localhost:3000/api/realplayers/recalculate-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        season_id: 'SSPSLS16'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Success!\n');
      console.log(`Total Players: ${data.totalPlayers}`);
      console.log(`Legend: ${data.legendCount}`);
      console.log(`Classic: ${data.classicCount}\n`);
      
      if (data.updates && data.updates.length > 0) {
        console.log('📊 Category Assignments:');
        console.log('─'.repeat(80));
        console.log('Rank | Player Name              | Stars | Points | Old Cat  | New Cat');
        console.log('─'.repeat(80));
        
        data.updates.slice(0, 20).forEach(update => {
          const rank = update.rank.toString().padStart(4);
          const name = (update.playerName || 'Unknown').padEnd(24);
          const stars = update.starRating.toString().padStart(5);
          const points = update.points.toString().padStart(6);
          const oldCat = (update.oldCategory || 'N/A').padEnd(8);
          const newCat = update.newCategory.padEnd(7);
          console.log(`${rank} | ${name} | ${stars} | ${points} | ${oldCat} | ${newCat}`);
        });
        
        if (data.updates.length > 20) {
          console.log(`... and ${data.updates.length - 20} more players`);
        }
      }
      
      console.log('\n✨ Categories updated successfully!');
    } else {
      console.error('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Failed to recalculate categories:', error.message);
  }
}

recalculateCategories();
