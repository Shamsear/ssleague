/**
 * Verification Script: Check Team Users
 * 
 * This script verifies that team users have been created properly with all necessary fields for login.
 * Run with: npx ts-node scripts/verify-team-users.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CERT_URL
};

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();
const auth = getAuth();

interface TeamUserIssue {
  teamName: string;
  teamId?: string;
  email?: string;
  username?: string;
  issues: string[];
  hasAuthUser: boolean;
  hasFirestoreUser: boolean;
  hasUsernameEntry: boolean;
  firestoreData?: any;
}

async function verifyTeamUsers() {
  console.log('🔍 Verifying team users...\n');
  
  const issues: TeamUserIssue[] = [];
  let totalTeams = 0;
  let teamsWithUsers = 0;
  let teamsWithoutUsers = 0;
  
  try {
    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    totalTeams = teamsSnapshot.size;
    
    console.log(`Found ${totalTeams} teams\n`);
    console.log('─'.repeat(80));
    
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.team_name || teamDoc.id;
      const teamId = teamDoc.id;
      const userId = teamData.userId;
      const email = teamData.userEmail;
      
      const teamIssues: string[] = [];
      let hasAuthUser = false;
      let hasFirestoreUser = false;
      let hasUsernameEntry = false;
      let firestoreData: any = null;
      let username: string | undefined;
      
      console.log(`\n📦 Team: ${teamName} (${teamId})`);
      
      // Check if team document has user reference
      if (!userId) {
        teamIssues.push('Missing userId in team document');
        console.log('   ❌ No userId in team document');
      } else {
        console.log(`   ✅ UserId: ${userId}`);
        
        // Check if Firebase Auth user exists
        try {
          const authUser = await auth.getUser(userId);
          hasAuthUser = true;
          console.log(`   ✅ Firebase Auth user exists`);
          console.log(`      - Email: ${authUser.email}`);
          console.log(`      - Display Name: ${authUser.displayName}`);
          console.log(`      - Disabled: ${authUser.disabled}`);
        } catch (error: any) {
          teamIssues.push(`Firebase Auth user not found (${error.code})`);
          console.log(`   ❌ Firebase Auth user NOT found: ${error.code}`);
        }
        
        // Check if Firestore user document exists
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          hasFirestoreUser = true;
          firestoreData = userDoc.data();
          username = firestoreData?.username;
          
          console.log(`   ✅ Firestore user document exists`);
          console.log(`      - Username: ${username || 'MISSING!'}`);
          console.log(`      - Email: ${firestoreData?.email}`);
          console.log(`      - Role: ${firestoreData?.role}`);
          console.log(`      - isActive: ${firestoreData?.isActive}`);
          console.log(`      - isApproved: ${firestoreData?.isApproved}`);
          
          // Check critical fields
          if (!username) {
            teamIssues.push('Missing username in Firestore user document');
            console.log(`      ❌ WARNING: Username is missing!`);
          } else {
            // Check if username exists in usernames collection
            const usernameDoc = await db.collection('usernames').doc(username.toLowerCase()).get();
            if (usernameDoc.exists) {
              const usernameData = usernameDoc.data();
              hasUsernameEntry = true;
              console.log(`   ✅ Username entry exists in 'usernames' collection`);
              console.log(`      - Username: ${username.toLowerCase()}`);
              console.log(`      - Points to UID: ${usernameData?.uid}`);
              
              // Verify username points to correct UID
              if (usernameData?.uid !== userId) {
                teamIssues.push(`Username entry points to wrong UID: ${usernameData?.uid} (should be ${userId})`);
                console.log(`      ❌ WARNING: Username points to wrong UID!`);
              }
            } else {
              teamIssues.push('Username NOT found in usernames collection (CRITICAL FOR LOGIN)');
              console.log(`   ❌ Username '${username.toLowerCase()}' NOT in 'usernames' collection - LOGIN WILL FAIL!`);
            }
          }
          if (!firestoreData?.email) {
            teamIssues.push('Missing email in Firestore user document');
            console.log(`      ❌ WARNING: Email is missing!`);
          }
          if (firestoreData?.role !== 'team') {
            teamIssues.push(`Incorrect role: ${firestoreData?.role} (should be 'team')`);
            console.log(`      ⚠️  WARNING: Role is '${firestoreData?.role}' not 'team'`);
          }
          if (!firestoreData?.isActive) {
            teamIssues.push('User is not active');
            console.log(`      ⚠️  WARNING: User is not active`);
          }
          if (!firestoreData?.isApproved) {
            teamIssues.push('User is not approved');
            console.log(`      ⚠️  WARNING: User is not approved`);
          }
        } else {
          teamIssues.push('Firestore user document not found');
          console.log(`   ❌ Firestore user document NOT found`);
        }
      }
      
      if (!email) {
        teamIssues.push('Missing userEmail in team document');
        console.log(`   ❌ No email in team document`);
      } else {
        console.log(`   ✅ Email: ${email}`);
      }
      
      if (teamIssues.length > 0) {
        teamsWithoutUsers++;
        issues.push({
          teamName,
          teamId,
          email,
          username,
          issues: teamIssues,
          hasAuthUser,
          hasFirestoreUser,
          hasUsernameEntry,
          firestoreData
        });
        console.log(`   ⚠️  ${teamIssues.length} issue(s) found`);
      } else {
        teamsWithUsers++;
        console.log(`   ✅ All checks passed (can login)`);
      }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 SUMMARY\n');
    console.log(`Total teams: ${totalTeams}`);
    console.log(`Teams with complete user setup: ${teamsWithUsers} ✅`);
    console.log(`Teams with issues: ${teamsWithoutUsers} ❌`);
    
    if (issues.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log('\n❌ ISSUES FOUND:\n');
      
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.teamName} (${issue.teamId})`);
        issue.issues.forEach(i => console.log(`   - ${i}`));
        
        if (issue.email) {
          console.log(`   📧 Email: ${issue.email}`);
        }
        if (issue.username) {
          console.log(`   👤 Username: ${issue.username}`);
        }
        
        // Suggest fix
        if (!issue.hasUsernameEntry && issue.username) {
          console.log(`   🔧 FIX: Need to create entry in 'usernames' collection`);
          console.log(`      Document ID: ${issue.username.toLowerCase()}`);
          console.log(`      Content: { uid: "${issue.firestoreData?.uid}" }`);
        } else if (issue.hasAuthUser && issue.hasFirestoreUser && !issue.firestoreData?.username) {
          console.log(`   🔧 FIX: Need to add username to Firestore user document`);
        } else if (!issue.hasAuthUser) {
          console.log(`   🔧 FIX: Need to create Firebase Auth user`);
        } else if (!issue.hasFirestoreUser) {
          console.log(`   🔧 FIX: Need to create Firestore user document`);
        }
        console.log('');
      });
      
      console.log('To fix these issues, you can:');
      console.log('1. Re-import the season (recommended - will create missing users)');
      console.log('2. Manually create/fix users in Firebase Console');
      console.log('3. Run a repair script (you may need to create one)');
    } else {
      console.log('\n✅ All teams have proper user setup!');
    }
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  }
}

// Run verification
verifyTeamUsers()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
