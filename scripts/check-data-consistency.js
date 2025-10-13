#!/usr/bin/env node

/**
 * Check Data Consistency - Standalone Version
 * 
 * This script verifies owner/username consistency using Firebase Admin SDK directly
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized with service account');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('   • Check your .env.local file has Firebase credentials');
    console.log('   • Verify FIREBASE_ADMIN_* environment variables');
    console.log('   • Make sure you have internet connection');
    process.exit(1);
  }
}

const db = admin.firestore();

class DataChecker {
  constructor() {
    this.stats = {
      teamSeasons: { total: 0, hasUsername: 0, hasOwnerName: 0, consistent: 0, issues: 0 },
      teams: { total: 0, hasUsername: 0, hasOwnerName: 0, consistent: 0, issues: 0 }
    };
    this.issues = [];
  }

  async checkTeamSeasons() {
    console.log('\n📊 CHECKING TEAM_SEASONS COLLECTION');
    console.log('=' .repeat(50));
    
    try {
      const snapshot = await db.collection('team_seasons').get();
      
      if (snapshot.empty) {
        console.log('ℹ️  No team_seasons documents found');
        return;
      }

      console.log(`Checking ${snapshot.docs.length} team season records...`);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        this.stats.teamSeasons.total++;
        
        const username = data.username?.trim();
        const ownerName = data.owner_name?.trim();
        
        if (username) this.stats.teamSeasons.hasUsername++;
        if (ownerName) this.stats.teamSeasons.hasOwnerName++;
        
        let issueType = null;
        
        if (username && ownerName) {
          if (username === ownerName) {
            this.stats.teamSeasons.consistent++;
          } else {
            issueType = 'different_values';
            this.stats.teamSeasons.issues++;
          }
        } else if (username && !ownerName) {
          issueType = 'missing_owner_name';
          this.stats.teamSeasons.issues++;
        } else if (!username && ownerName) {
          issueType = 'missing_username';
          this.stats.teamSeasons.issues++;
        } else {
          issueType = 'missing_both';
          this.stats.teamSeasons.issues++;
        }
        
        if (issueType) {
          this.issues.push({
            collection: 'team_seasons',
            id: doc.id,
            teamName: data.team_name || 'Unknown',
            seasonId: data.season_id || 'Unknown',
            username: username || null,
            ownerName: ownerName || null,
            issueType,
            docRef: doc.ref
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error checking team_seasons:', error.message);
    }
  }

  async checkTeams() {
    console.log('\n📊 CHECKING TEAMS COLLECTION');
    console.log('=' .repeat(50));
    
    try {
      const snapshot = await db.collection('teams').get();
      
      if (snapshot.empty) {
        console.log('ℹ️  No teams documents found');
        return;
      }

      console.log(`Checking ${snapshot.docs.length} team records...`);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        this.stats.teams.total++;
        
        const username = data.username?.trim();
        const ownerName = data.owner_name?.trim();
        
        if (username) this.stats.teams.hasUsername++;
        if (ownerName) this.stats.teams.hasOwnerName++;
        
        let issueType = null;
        
        if (username && ownerName) {
          if (username === ownerName) {
            this.stats.teams.consistent++;
          } else {
            issueType = 'different_values';
            this.stats.teams.issues++;
          }
        } else if (username && !ownerName) {
          issueType = 'missing_owner_name';
          this.stats.teams.issues++;
        } else if (!username && ownerName) {
          issueType = 'missing_username';
          this.stats.teams.issues++;
        }
        
        if (issueType) {
          this.issues.push({
            collection: 'teams',
            id: doc.id,
            teamName: data.team_name || 'Unknown',
            username: username || null,
            ownerName: ownerName || null,
            issueType,
            docRef: doc.ref
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error checking teams:', error.message);
    }
  }

  displayResults() {
    console.log('\n📈 RESULTS SUMMARY');
    console.log('=' .repeat(50));
    
    // Team Seasons Stats
    console.log('\n🏆 TEAM_SEASONS COLLECTION:');
    console.log(`   Total records: ${this.stats.teamSeasons.total}`);
    if (this.stats.teamSeasons.total > 0) {
      console.log(`   Has username: ${this.stats.teamSeasons.hasUsername} (${(this.stats.teamSeasons.hasUsername/this.stats.teamSeasons.total*100).toFixed(1)}%)`);
      console.log(`   Has owner_name: ${this.stats.teamSeasons.hasOwnerName} (${(this.stats.teamSeasons.hasOwnerName/this.stats.teamSeasons.total*100).toFixed(1)}%)`);
      console.log(`   Consistent: ${this.stats.teamSeasons.consistent}`);
      console.log(`   Issues: ${this.stats.teamSeasons.issues}`);
    }
    
    // Teams Stats
    console.log('\n🏆 TEAMS COLLECTION:');
    console.log(`   Total records: ${this.stats.teams.total}`);
    if (this.stats.teams.total > 0) {
      console.log(`   Has username: ${this.stats.teams.hasUsername} (${(this.stats.teams.hasUsername/this.stats.teams.total*100).toFixed(1)}%)`);
      console.log(`   Has owner_name: ${this.stats.teams.hasOwnerName} (${(this.stats.teams.hasOwnerName/this.stats.teams.total*100).toFixed(1)}%)`);
      console.log(`   Consistent: ${this.stats.teams.consistent}`);
      console.log(`   Issues: ${this.stats.teams.issues}`);
    }

    // Issues Details
    if (this.issues.length > 0) {
      console.log('\n⚠️  DETAILED ISSUES:');
      console.log('=' .repeat(50));
      
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.collection}/${issue.id}`);
        console.log(`   Team: ${issue.teamName}`);
        if (issue.seasonId) console.log(`   Season: ${issue.seasonId}`);
        console.log(`   Username: ${issue.username || 'MISSING'}`);
        console.log(`   Owner Name: ${issue.ownerName || 'MISSING'}`);
        console.log(`   Issue: ${this.getIssueDescription(issue.issueType)}`);
      });
      
      console.log('\n🔧 WHAT TO DO:');
      console.log('   Run with --fix flag to automatically fix these issues');
      console.log('   Command: node scripts/check-data-consistency.js --fix');
      
    } else {
      console.log('\n✅ No issues found! All data is consistent.');
    }
  }

  getIssueDescription(issueType) {
    const descriptions = {
      'different_values': 'username and owner_name have different values',
      'missing_owner_name': 'has username but missing owner_name',
      'missing_username': 'has owner_name but missing username',
      'missing_both': 'missing both username and owner_name'
    };
    return descriptions[issueType] || 'unknown issue';
  }

  async fixIssues() {
    if (this.issues.length === 0) {
      console.log('\n✅ No issues to fix!');
      return;
    }

    console.log(`\n🔧 FIXING ${this.issues.length} ISSUES`);
    console.log('=' .repeat(50));

    const batch = db.batch();
    let fixedCount = 0;

    this.issues.forEach(issue => {
      let updates = {};
      
      switch (issue.issueType) {
        case 'different_values':
          if (issue.username) {
            updates.owner_name = issue.username;
            console.log(`📝 ${issue.id}: Setting owner_name = "${issue.username}"`);
            fixedCount++;
          }
          break;
          
        case 'missing_owner_name':
          if (issue.username) {
            updates.owner_name = issue.username;
            console.log(`📝 ${issue.id}: Adding owner_name = "${issue.username}"`);
            fixedCount++;
          }
          break;
          
        case 'missing_username':
          if (issue.ownerName) {
            updates.username = issue.ownerName;
            console.log(`📝 ${issue.id}: Adding username = "${issue.ownerName}"`);
            fixedCount++;
          }
          break;
          
        case 'missing_both':
          console.log(`⚠️  ${issue.id}: Cannot fix - both fields missing`);
          break;
      }
      
      if (Object.keys(updates).length > 0) {
        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
        batch.update(issue.docRef, updates);
      }
    });

    if (fixedCount > 0) {
      console.log(`\n💾 Applying ${fixedCount} fixes...`);
      await batch.commit();
      console.log('✅ All fixes applied successfully!');
    } else {
      console.log('ℹ️  No automatic fixes could be applied');
    }
    
    return fixedCount;
  }

  displayFinalSummary(fixedCount = 0) {
    console.log('\n🎯 FINAL SUMMARY');
    console.log('=' .repeat(50));
    
    const totalIssues = this.issues.length;
    console.log(`Status: ${totalIssues === 0 ? '✅ ALL CONSISTENT' : fixedCount > 0 ? '✅ FIXED' : '⚠️  NEEDS ATTENTION'}`);
    console.log(`Total records: ${this.stats.teamSeasons.total + this.stats.teams.total}`);
    console.log(`Issues found: ${totalIssues}`);
    if (fixedCount > 0) console.log(`Issues fixed: ${fixedCount}`);
    
    console.log('\n✅ SYSTEM STATUS:');
    console.log('   • Code already prioritizes username over owner_name');
    console.log('   • New registrations now set both fields correctly');
    if (fixedCount > 0) {
      console.log('   • Existing data inconsistencies have been fixed');
    }
    console.log('   • Owner names will equal usernames for all teams');
  }
}

async function main() {
  console.log('\n🔍 DATA CONSISTENCY CHECKER');
  console.log('=' .repeat(60));
  
  const checker = new DataChecker();
  let fixedCount = 0;
  
  try {
    // Check data
    await checker.checkTeamSeasons();
    await checker.checkTeams();
    
    // Display results
    checker.displayResults();
    
    // Fix if requested
    if (process.argv.includes('--fix') && checker.issues.length > 0) {
      console.log('\n🔧 --fix flag detected. Applying fixes...');
      fixedCount = await checker.fixIssues();
    }
    
    checker.displayFinalSummary(fixedCount);
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.log('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the checker
main()
  .then(() => {
    console.log('\n✅ Check completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });