const admin = require('firebase-admin');

// Use the credentials directly from the JSON you provided
const serviceAccount = {
  "type": "service_account",
  "project_id": "eaguedemo",
  "private_key_id": "f513fc9c909831791f94b8c53c0238b76d1478b6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDwj6jyeFOHPIZq\n6BoCGkomR9/9hIwnfwCpxFzHQJBcqBuzzuXoOOsDD6Jmx8cGuhBxCQUUlxFPFInd\nBJq+l2uncJzVyLzieDTkKUethBN3SK6vd+9dS0MjkMedfcmC8tWtoNlaWg9AjQ0D\niv8F3GXJlTMib8RSrUthcaGXEONfRbaa9riAmQGSrGjftsyEkqhiY3QL/GjyCl8B\nuCUc3PaqyU7Rti0/ehuKtH96aZjhqw0GpFg1Z+FE5uRXnNSKthlfLqz4ZRcCRgUx\nJqyATONMjJC5iqCE0JLjBTUfHEKgP551Nhp6l3MvzF8rUhHOeQEQZXZIz4Uz/h2L\nRp6vhwbfAgMBAAECggEADT/ETNJuu0iMmK++2vXKtrAHuKVHuNcoWLFNcNXv/YJu\nwCj5haA45VrDlYiUQB0YUblu87LcS7A0ZZ1eznd1gOvVX3rmWEzJkPVrErXvAodY\nw6ZF4ywFfxx2ughXBGTOevkcb3r9Uw9Rs6vAnviEDKWwgsmIFQuhVrUU8saF11Xa\nwmAf7tBluwUfGHi0GftV8/bfpnj0VAF83h+HkOgi9kP2hmSvTH9UzjoI/xaO8M+0\nAdv8kRUcMVid73KMqqpDFXETi+wxDTDi7HmcZ8mRzFtUr0w5V0ez2Lngc4TYIZwv\naLgp1WDHp/AHSc6Q+KqW+LBufR3O3VIPvguwlkkGHQKBgQD4MQbDEBSRq0vdV98j\nWOcRuyRa7lZSy5XT6mdbnwCeD1Q7GUT87WHr9+Eg02UhYl1H0wfyChmjZPohV9S1\nO7BfOTn9yY2XG8mTzey9570NNvOqpdnfa/s/30qdMlkjIS36XgrIE0JaYH67u1rn\ngIVR5lmaMhbA6dxfSedO+a1mdQKBgQD4IS12ocAm5LpcrcP5aGvMCapu8diHEGAg\nTqS/Y7X8ToKaWCXjrKe25G9Z5Eq3BNfoVwmyugcMzGYXtpbbho+V7VjdfxNKU1vY\nYQZzH+Lz++nkFPk6jdG7z0zcjRms0MlMFKVy/YF+Lh2SSRLynNm3XyPIsAnMeOA9\njmaJRFQVgwKBgQCZy6+YAofseIxrXb9NJRMS/reZjWV6quNuTSu9L7tvNqqIcLE6\nVlM+qP0dnUFmvZB2KIQc7TtT8Ae7z7RklddGOqz/4fzWbYatC4cvasHQxYOa9Gkd\nNMmdm92dqYxo42+dXNcrghu062S9Km07VX3H8YkGrxFAe+puNdqbKsbT3QKBgQCk\nKF8Jo02a7awV8Kg880aOAL8PE1WrVbwi46S/MlqOB+sD7dlzXSDAMTUyBYUgvEWT\nYzH5WnWblAbfHV+E8OtBx3sJXy8F90xGRTqdI7VksX819GJGyNi/JhC1wWwBF0h1\n2xryjqEDN8M8qresZvTrCjiEZ2K0Miw4zWMs4VW3vQKBgE3Bc4wl58HTpwM67cKn\nif3qBTCLjNUQcGc01hTx03d44RgFUoBX0pQJsH8rFsj5dt+f5QCePfnN/6Z7c6RD\nU4wtcILgyQIdDtsC7mfybbs6EF4fAxGYxrLPpSHHbb8lCB/uPWSjvn9rqmf3N5LS\nP5P5qFjtWSWEJ5bwVTo474Sw\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@eaguedemo.iam.gserviceaccount.com",
  "client_id": "100997191963755681958",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40eaguedemo.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

console.log('🔧 Testing Firebase Admin connection...');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function testConnection() {
  try {
    console.log('🔍 Testing Firestore connection...');
    
    // Try to list collections
    const collections = await db.listCollections();
    console.log('✅ Connection successful!');
    console.log(`📊 Found ${collections.length} collections:`);
    collections.forEach(collection => {
      console.log(`  - ${collection.id}`);
    });
    
    // Try to get team_seasons count
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    console.log(`📋 team_seasons documents: ${teamSeasonsSnapshot.size}`);
    
    // Try to get teams count
    const teamsSnapshot = await db.collection('teams').get();
    console.log(`🏆 teams documents: ${teamsSnapshot.size}`);
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testConnection();