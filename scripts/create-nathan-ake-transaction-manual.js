/**
 * Manual Transaction Creation for Nathan Aké
 * 
 * This script creates the missing transaction for Nathan Aké purchase
 * Run this in the browser console while logged in as admin/committee
 */

async function createNathanAkeTransaction() {
  try {
    console.log('🔄 Creating missing transaction for Nathan Aké...');
    
    const response = await fetch('/api/admin/create-missing-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Transaction created successfully!');
      console.log('📝 Transaction ID:', data.data.transactionId);
      console.log('👤 Player:', data.data.player);
      console.log('🏆 Team:', data.data.team);
      console.log('💰 Amount:', data.data.amount);
      console.log('🎯 Round:', data.data.round);
      return data;
    } else {
      console.error('❌ Failed to create transaction:', data.error);
      return data;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the function
createNathanAkeTransaction();
