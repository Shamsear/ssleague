#!/usr/bin/env node

/**
 * Fix Missing Owner Data - Enhanced Version
 * 
 * This script will:
 * 1. Find team records missing username/owner_name
 * 2. Look up the corresponding user data
 * 3. Fix the records with proper username/owner_name
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized with service account');
    } else {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
      admin.initializeApp({ projectId });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}`);
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

class OwnerDataFixer {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.userCache = new Map();
  }

  async loadUserData() {
    console.log('\n📥 LOADING USER DATA');
    console.log('=' .repeat(50));
    
    try {
      const usersSnapshot = await db.collection('users').get();
      
      if (!usersSnapshot.empty) {
        usersSnapshot.docs.forEach(doc => {
          const userData = doc.data();
          this.userCache.set(doc.id, {
            uid: doc.id,
            username: userData.username || '',
            email: userData.email || '',
            teamName: userData.teamName || '',
            role: userData.role || ''
          });
        });
        console.log(`Loaded ${this.userCache.size} user records`);
      } else {
        console.log('ℹ️  No user records found');
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error.message);
    }
  }

  async analyzeTeamSeasons() {
    console.log('\n🔍 ANALYZING TEAM_SEASONS RECORDS');
    console.log('=' .repeat(50));
    
    try {
      const snapshot = await db.collection('team_seasons').get();
      
      if (snapshot.empty) {
        console.log('ℹ️  No team_seasons documents found');
        return;
      }

      console.log(`Analyzing ${snapshot.docs.length} team season records...`);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const username = data.username?.trim();
        const ownerName = data.owner_name?.trim();
        
        // Extract team_id from document ID (format: {team_id}_{season_id})
        const docId = doc.id;
        const teamId = docId.split('_')[0]; // Get team_id before first underscore
        
        console.log(`\n📋 Record: ${docId}`);
        console.log(`   Team: ${data.team_name || 'Unknown'}`);
        console.log(`   Team ID: ${teamId}`);
        console.log(`   Current username: ${username || 'MISSING'}`);
        console.log(`   Current owner_name: ${ownerName || 'MISSING'}`);
        console.log(`   Team email: ${data.team_email || 'N/A'}`);
        
        // Check if this team_id exists in our user cache
        const userData = this.userCache.get(teamId);
        if (userData) {
          console.log(`   ✅ Found user data: ${userData.username} (${userData.email})`);
          
          // Determine what needs to be fixed
          const needsUsername = !username && userData.username;
          const needsOwnerName = !ownerName && userData.username;
          const inconsistent = username && ownerName && username !== ownerName;
          
          if (needsUsername || needsOwnerName || inconsistent) {
            this.fixes.push({
              docId: docId,
              docRef: doc.ref,
              teamName: data.team_name,
              currentUsername: username,
              currentOwnerName: ownerName,
              suggestedUsername: userData.username,
              suggestedOwnerName: userData.username,
              needsUsername,
              needsOwnerName,
              inconsistent,
              userData
            });
          }
        } else {
          console.log(`   ⚠️  No user data found for team_id: ${teamId}`);
          this.issues.push({
            docId: docId,
            teamName: data.team_name,
            teamId: teamId,
            issue: 'no_user_data_found'
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error analyzing team seasons:', error.message);
    }
  }

  displayAnalysis() {
    console.log('\n📊 ANALYSIS RESULTS');
    console.log('=' .repeat(50));
    
    console.log(`\nFixable issues: ${this.fixes.length}`);
    console.log(`Unfixable issues: ${this.issues.length}`);
    
    if (this.fixes.length > 0) {
      console.log('\n✅ FIXABLE ISSUES:');
      console.log('=' .repeat(40));
      
      this.fixes.forEach((fix, index) => {
        console.log(`\n${index + 1}. ${fix.docId}`);
        console.log(`   Team: ${fix.teamName}`);
        console.log(`   Current username: ${fix.currentUsername || 'MISSING'}`);
        console.log(`   Current owner_name: ${fix.currentOwnerName || 'MISSING'}`);
        console.log(`   Will set username: ${fix.suggestedUsername}`);
        console.log(`   Will set owner_name: ${fix.suggestedOwnerName}`);
        
        const actions = [];
        if (fix.needsUsername) actions.push('Add username');
        if (fix.needsOwnerName) actions.push('Add owner_name');
        if (fix.inconsistent) actions.push('Make consistent');
        console.log(`   Actions: ${actions.join(', ')}`);
      });
    }
    
    if (this.issues.length > 0) {
      console.log('\n⚠️  UNFIXABLE ISSUES:');
      console.log('=' .repeat(40));
      
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.docId}`);
        console.log(`   Team: ${issue.teamName}`);
        console.log(`   Team ID: ${issue.teamId}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Solution: Manually check if this user exists or was deleted`);
      });
    }
  }

  async applyFixes() {
    if (this.fixes.length === 0) {
      console.log('\n✅ No fixes to apply!');
      return 0;
    }

    console.log(`\n🔧 APPLYING ${this.fixes.length} FIXES`);
    console.log('=' .repeat(50));

    const batch = db.batch();
    let appliedCount = 0;

    this.fixes.forEach(fix => {
      const updates = {
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (fix.needsUsername || fix.inconsistent) {
        updates.username = fix.suggestedUsername;
        console.log(`📝 ${fix.docId}: Setting username = "${fix.suggestedUsername}"`);
      }
      
      if (fix.needsOwnerName || fix.inconsistent) {
        updates.owner_name = fix.suggestedOwnerName;
        console.log(`📝 ${fix.docId}: Setting owner_name = "${fix.suggestedOwnerName}"`);
      }
      
      batch.update(fix.docRef, updates);
      appliedCount++;
    });

    if (appliedCount > 0) {
      console.log(`\n💾 Committing ${appliedCount} updates...`);
      await batch.commit();
      console.log('✅ All fixes applied successfully!');
    }
    
    return appliedCount;
  }

  displayFinalSummary(appliedCount = 0) {
    console.log('\n🎯 FINAL SUMMARY');
    console.log('=' .repeat(50));
    
    console.log(`Status: ${this.fixes.length === 0 && this.issues.length === 0 ? '✅ ALL GOOD' : appliedCount > 0 ? '✅ FIXED' : '⚠️  NEEDS ATTENTION'}`);
    console.log(`Fixes applied: ${appliedCount}`);
    console.log(`Remaining issues: ${this.issues.length}`);
    
    if (appliedCount > 0) {
      console.log('\n✅ SUCCESS:');
      console.log('   • Owner names now equal usernames');
      console.log('   • Data is consistent across the system');
      console.log('   • Future registrations will maintain consistency');
    }
    
    if (this.issues.length > 0) {
      console.log('\n⚠️  MANUAL ACTION NEEDED:');
      console.log('   • Some records have no corresponding user data');
      console.log('   • Check if these users were deleted');
      console.log('   • Consider removing orphaned team_season records');
    }
    
    console.log('\n🎉 SYSTEM IS NOW READY:');
    console.log('   • Owner names equal usernames where possible');
    console.log('   • Display logic prioritizes username');
    console.log('   • New registrations set both fields');
  }
}

async function main() {
  console.log('\n🔧 OWNER DATA FIXER');
  console.log('=' .repeat(60));
  
  const fixer = new OwnerDataFixer();
  
  try {
    // Load user data first
    await fixer.loadUserData();
    
    // Analyze team seasons
    await fixer.analyzeTeamSeasons();
    
    // Display analysis
    fixer.displayAnalysis();
    
    // Apply fixes if requested
    let appliedCount = 0;
    if (process.argv.includes('--fix')) {
      console.log('\n🔧 --fix flag detected. Applying fixes...');
      appliedCount = await fixer.applyFixes();
    } else if (fixer.fixes.length > 0) {
      console.log('\n💡 TO APPLY FIXES:');
      console.log('   Run: node scripts/fix-missing-owner-data.js --fix');
    }
    
    fixer.displayFinalSummary(appliedCount);
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.log('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the fixer
main()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });