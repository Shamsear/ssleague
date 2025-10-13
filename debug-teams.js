// Debug script to check teams in the database
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// You'll need to add your Firebase config here
const firebaseConfig = {
  // Add your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTeams() {
  try {
    console.log('Checking teams in database...');
    const teamsRef = collection(db, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    console.log('Total documents in teams collection:', snapshot.size);
    
    snapshot.forEach((doc) => {
      console.log('Team ID:', doc.id);
      console.log('Team data:', doc.data());
    });
  } catch (error) {
    console.error('Error checking teams:', error);
  }
}

checkTeams();