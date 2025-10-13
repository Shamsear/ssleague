#!/usr/bin/env node

/**
 * Verify Owner-Username Consistency
 * 
 * This script checks if owner names match usernames across the system
 * and identifies any inconsistencies that need to be addressed.
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccount.json');
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.log('📝 Make sure serviceAccount.json exists in the project root');
    process.exit(1);
  }
}

const db = admin.firestore();

async function checkOwnerUsernameConsistency() {
  console.log('\n🔍 CHECKING OWNER-USERNAME CONSISTENCY\n');
  console.log('=' .repeat(60));
  
  try {
    // Check team_seasons collection
    console.log('\n📊 Analyzing team_seasons collection...');
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    
    if (teamSeasonsSnapshot.empty) {
      console.log('ℹ️  No documents found in team_seasons collection');
    }
    
    const teamSeasonIssues = [];
    const teamSeasonStats = {
      total: 0,
      hasUsername: 0,
      hasOwnerName: 0,
      hasTeamEmail: 0,
      hasOwnerEmail: 0,
      consistent: 0,
      inconsistent: 0,
      missing: 0
    };
    
    teamSeasonsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      teamSeasonStats.total++;
      
      const hasUsername = data.username && data.username.trim() !== '';
      const hasOwnerName = data.owner_name && data.owner_name.trim() !== '';
      const hasTeamEmail = data.team_email && data.team_email.trim() !== '';
      const hasOwnerEmail = data.owner_email && data.owner_email.trim() !== '';
      
      if (hasUsername) teamSeasonStats.hasUsername++;
      if (hasOwnerName) teamSeasonStats.hasOwnerName++;
      if (hasTeamEmail) teamSeasonStats.hasTeamEmail++;
      if (hasOwnerEmail) teamSeasonStats.hasOwnerEmail++;
      
      // Check consistency
      let status = 'unknown';
      let issue = null;
      
      if (hasUsername && hasOwnerName) {
        if (data.username === data.owner_name) {
          status = 'consistent';
          teamSeasonStats.consistent++;
        } else {
          status = 'inconsistent';
          teamSeasonStats.inconsistent++;
          issue = `username: "${data.username}" != owner_name: "${data.owner_name}"`;
        }
      } else if (hasUsername && !hasOwnerName) {
        status = 'username_only';
      } else if (!hasUsername && hasOwnerName) {
        status = 'owner_only';
      } else {
        status = 'missing_both';
        teamSeasonStats.missing++;
        issue = 'Both username and owner_name are missing or empty';
      }
      
      if (issue || status === 'inconsistent' || status === 'missing_both') {
        teamSeasonIssues.push({
          id: doc.id,
          team_name: data.team_name || 'Unknown',
          season_id: data.season_id || 'Unknown',
          status,
          issue,
          username: data.username || 'N/A',
          owner_name: data.owner_name || 'N/A',
          team_email: data.team_email || 'N/A',
          owner_email: data.owner_email || 'N/A'
        });
      }
    });
    
    // Check teams collection (if exists)
    console.log('\n📊 Analyzing teams collection...');
    const teamsSnapshot = await db.collection('teams').get();
    
    const teamIssues = [];
    const teamStats = {
      total: 0,
      hasOwnerName: 0,
      hasOwnerEmail: 0,
      hasOwnerUid: 0
    };
    
    if (!teamsSnapshot.empty) {
      teamsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        teamStats.total++;
        
        if (data.owner_name && data.owner_name.trim() !== '') teamStats.hasOwnerName++;
        if (data.owner_email && data.owner_email.trim() !== '') teamStats.hasOwnerEmail++;
        if (data.owner_uid && data.owner_uid.trim() !== '') teamStats.hasOwnerUid++;
        
        // Note: teams collection doesn't have username field directly
        // The username comes from the linked user document
      });
    } else {
      console.log('ℹ️  No documents found in teams collection');
    }
    
    // Check users collection for reference
    console.log('\n📊 Analyzing users collection...');
    const usersSnapshot = await db.collection('users').get();
    
    const userStats = {
      total: 0,
      hasUsername: 0,
      hasEmail: 0,
      teamRole: 0
    };
    
    if (!usersSnapshot.empty) {
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        userStats.total++;
        
        if (data.username && data.username.trim() !== '') userStats.hasUsername++;
        if (data.email && data.email.trim() !== '') userStats.hasEmail++;
        if (data.role === 'team') userStats.teamRole++;
      });
    } else {
      console.log('ℹ️  No documents found in users collection');
    }
    
    // Display Results
    console.log('\n📈 ANALYSIS RESULTS');
    console.log('=' .repeat(60));
    
    console.log('\n🏆 TEAM_SEASONS COLLECTION:');
    console.log(`   Total documents: ${teamSeasonStats.total}`);
    console.log(`   Has username: ${teamSeasonStats.hasUsername} (${((teamSeasonStats.hasUsername/teamSeasonStats.total)*100).toFixed(1)}%)`);
    console.log(`   Has owner_name: ${teamSeasonStats.hasOwnerName} (${((teamSeasonStats.hasOwnerName/teamSeasonStats.total)*100).toFixed(1)}%)`);
    console.log(`   Has team_email: ${teamSeasonStats.hasTeamEmail} (${((teamSeasonStats.hasTeamEmail/teamSeasonStats.total)*100).toFixed(1)}%)`);
    console.log(`   Has owner_email: ${teamSeasonStats.hasOwnerEmail} (${((teamSeasonStats.hasOwnerEmail/teamSeasonStats.total)*100).toFixed(1)}%)`);
    console.log(`   Consistent (username = owner_name): ${teamSeasonStats.consistent}`);
    console.log(`   Inconsistent (username ≠ owner_name): ${teamSeasonStats.inconsistent}`);
    console.log(`   Missing both fields: ${teamSeasonStats.missing}`);
    
    if (teamStats.total > 0) {
      console.log('\n🏆 TEAMS COLLECTION:');
      console.log(`   Total documents: ${teamStats.total}`);
      console.log(`   Has owner_name: ${teamStats.hasOwnerName} (${((teamStats.hasOwnerName/teamStats.total)*100).toFixed(1)}%)`);
      console.log(`   Has owner_email: ${teamStats.hasOwnerEmail} (${((teamStats.hasOwnerEmail/teamStats.total)*100).toFixed(1)}%)`);
      console.log(`   Has owner_uid: ${teamStats.hasOwnerUid} (${((teamStats.hasOwnerUid/teamStats.total)*100).toFixed(1)}%)`);
    }
    
    if (userStats.total > 0) {
      console.log('\n👤 USERS COLLECTION:');
      console.log(`   Total users: ${userStats.total}`);
      console.log(`   Has username: ${userStats.hasUsername} (${((userStats.hasUsername/userStats.total)*100).toFixed(1)}%)`);
      console.log(`   Has email: ${userStats.hasEmail} (${((userStats.hasEmail/userStats.total)*100).toFixed(1)}%)`);
      console.log(`   Team role users: ${userStats.teamRole} (${((userStats.teamRole/userStats.total)*100).toFixed(1)}%)`);
    }
    
    // Display Issues
    if (teamSeasonIssues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      console.log('=' .repeat(60));
      
      teamSeasonIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. Document ID: ${issue.id}`);
        console.log(`   Team: ${issue.team_name}`);
        console.log(`   Season: ${issue.season_id}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Username: ${issue.username}`);
        console.log(`   Owner Name: ${issue.owner_name}`);
        console.log(`   Team Email: ${issue.team_email}`);
        console.log(`   Owner Email: ${issue.owner_email}`);
        if (issue.issue) {
          console.log(`   Issue: ${issue.issue}`);
        }
      });
    } else {
      console.log('\n✅ No issues found! All owner names are consistent with usernames.');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('=' .repeat(60));
    
    if (teamSeasonStats.inconsistent > 0) {
      console.log('❌ Found inconsistent owner/username pairs');
      console.log('   → Consider updating owner_name to match username');
      console.log('   → Or update username to match owner_name');
      console.log('   → Ensure data entry processes use consistent naming');
    }
    
    if (teamSeasonStats.missing > 0) {
      console.log('⚠️  Found records missing both username and owner_name');
      console.log('   → These records need manual review');
      console.log('   → Consider linking to user accounts for proper naming');
    }
    
    if (teamSeasonStats.consistent > 0) {
      console.log('✅ Good: Found records where username = owner_name');
      console.log('   → This is the desired state');
    }
    
    console.log('\n📝 CODE ANALYSIS:');
    console.log('   Current logic in teams.ts prioritizes username over owner_name:');
    console.log('   → owner_name: data.username || data.owner_name || ""');
    console.log('   This means the system already prefers username when available');
    
    console.log('\n🎯 SUMMARY:');
    console.log(`   System status: ${teamSeasonIssues.length === 0 ? '✅ CONSISTENT' : '⚠️  NEEDS ATTENTION'}`);
    console.log(`   Issues to resolve: ${teamSeasonIssues.length}`);
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Run the analysis
checkOwnerUsernameConsistency()
  .then(() => {
    console.log('\n✅ Analysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });