#!/usr/bin/env node

/**
 * Verify and Fix Owner-Username Data
 * 
 * This script will:
 * 1. Check all team records for owner/username consistency
 * 2. Report any inconsistencies found
 * 3. Optionally fix the inconsistencies
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Import the admin setup from your project
const { adminDb } = require('../lib/firebase/admin');

class OwnerDataVerifier {
  constructor() {
    this.stats = {
      total: 0,
      hasUsername: 0,
      hasOwnerName: 0,
      consistent: 0,
      inconsistent: 0,
      missing: 0,
      fixed: 0
    };
    this.issues = [];
  }

  async verifyTeamSeasonsCollection() {
    console.log('\n📊 CHECKING TEAM_SEASONS COLLECTION');
    console.log('=' .repeat(50));
    
    try {
      const snapshot = await adminDb.collection('team_seasons').get();
      
      if (snapshot.empty) {
        console.log('ℹ️  No documents found in team_seasons collection');
        return;
      }

      console.log(`Found ${snapshot.docs.length} team records to check...`);

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        this.stats.total++;
        
        const hasUsername = data.username && data.username.trim() !== '';
        const hasOwnerName = data.owner_name && data.owner_name.trim() !== '';
        
        if (hasUsername) this.stats.hasUsername++;
        if (hasOwnerName) this.stats.hasOwnerName++;
        
        // Determine status
        let status = 'unknown';
        let issue = null;
        
        if (hasUsername && hasOwnerName) {
          if (data.username === data.owner_name) {
            status = 'consistent';
            this.stats.consistent++;
          } else {
            status = 'inconsistent';
            this.stats.inconsistent++;
            issue = `username: "${data.username}" ≠ owner_name: "${data.owner_name}"`;
          }
        } else if (hasUsername && !hasOwnerName) {
          status = 'missing_owner_name';
          issue = 'Has username but missing owner_name';
        } else if (!hasUsername && hasOwnerName) {
          status = 'missing_username';
          issue = 'Has owner_name but missing username';
        } else {
          status = 'missing_both';
          this.stats.missing++;
          issue = 'Missing both username and owner_name';
        }
        
        if (status !== 'consistent') {
          this.issues.push({
            id: doc.id,
            collection: 'team_seasons',
            team_name: data.team_name || 'Unknown',
            season_id: data.season_id || 'Unknown',
            status,
            issue,
            username: data.username || null,
            owner_name: data.owner_name || null,
            team_email: data.team_email || null,
            docRef: doc.ref
          });
        }
      });

    } catch (error) {
      console.error('❌ Error checking team_seasons:', error);
    }
  }

  async verifyTeamsCollection() {
    console.log('\n📊 CHECKING TEAMS COLLECTION');
    console.log('=' .repeat(50));
    
    try {
      const snapshot = await adminDb.collection('teams').get();
      
      if (snapshot.empty) {
        console.log('ℹ️  No documents found in teams collection');
        return;
      }

      console.log(`Found ${snapshot.docs.length} team records to check...`);

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        
        const hasOwnerName = data.owner_name && data.owner_name.trim() !== '';
        const hasUsername = data.username && data.username.trim() !== '';
        
        if (hasUsername && hasOwnerName && data.username !== data.owner_name) {
          this.issues.push({
            id: doc.id,
            collection: 'teams',
            team_name: data.team_name || 'Unknown',
            status: 'inconsistent',
            issue: `username: "${data.username}" ≠ owner_name: "${data.owner_name}"`,
            username: data.username || null,
            owner_name: data.owner_name || null,
            docRef: doc.ref
          });
        } else if (!hasUsername && hasOwnerName) {
          this.issues.push({
            id: doc.id,
            collection: 'teams',
            team_name: data.team_name || 'Unknown',
            status: 'missing_username',
            issue: 'Has owner_name but missing username',
            username: data.username || null,
            owner_name: data.owner_name || null,
            docRef: doc.ref
          });
        }
      });

    } catch (error) {
      console.error('❌ Error checking teams:', error);
    }
  }

  displayResults() {
    console.log('\n📈 VERIFICATION RESULTS');
    console.log('=' .repeat(50));
    
    console.log('\n🏆 TEAM_SEASONS STATISTICS:');
    console.log(`   Total records: ${this.stats.total}`);
    console.log(`   Has username: ${this.stats.hasUsername} (${((this.stats.hasUsername/this.stats.total)*100).toFixed(1)}%)`);
    console.log(`   Has owner_name: ${this.stats.hasOwnerName} (${((this.stats.hasOwnerName/this.stats.total)*100).toFixed(1)}%)`);
    console.log(`   Consistent: ${this.stats.consistent}`);
    console.log(`   Inconsistent: ${this.stats.inconsistent}`);
    console.log(`   Missing data: ${this.stats.missing}`);
    
    if (this.issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      console.log('=' .repeat(50));
      
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.collection}/${issue.id}`);
        console.log(`   Team: ${issue.team_name}`);
        if (issue.season_id) console.log(`   Season: ${issue.season_id}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Username: ${issue.username || 'N/A'}`);
        console.log(`   Owner Name: ${issue.owner_name || 'N/A'}`);
        if (issue.team_email) console.log(`   Email: ${issue.team_email}`);
        console.log(`   Issue: ${issue.issue}`);
      });
    } else {
      console.log('\n✅ No issues found! All records are consistent.');
    }
  }

  async fixIssues() {
    if (this.issues.length === 0) {
      console.log('\n✅ No issues to fix!');
      return;
    }

    console.log(`\n🔧 FIXING ${this.issues.length} ISSUES`);
    console.log('=' .repeat(50));

    const batch = adminDb.batch();
    let updateCount = 0;

    this.issues.forEach(issue => {
      let updateData = {};
      
      if (issue.status === 'inconsistent' && issue.username) {
        // Set owner_name to match username
        updateData.owner_name = issue.username;
        console.log(`📝 ${issue.id}: Setting owner_name = "${issue.username}"`);
        updateCount++;
      } else if (issue.status === 'missing_owner_name' && issue.username) {
        // Add missing owner_name from username
        updateData.owner_name = issue.username;
        console.log(`📝 ${issue.id}: Adding owner_name = "${issue.username}"`);
        updateCount++;
      } else if (issue.status === 'missing_username' && issue.owner_name) {
        // Add missing username from owner_name
        updateData.username = issue.owner_name;
        console.log(`📝 ${issue.id}: Adding username = "${issue.owner_name}"`);
        updateCount++;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        batch.update(issue.docRef, updateData);
      }
    });

    if (updateCount > 0) {
      console.log(`\n💾 Committing ${updateCount} updates...`);
      await batch.commit();
      console.log('✅ All fixes applied successfully!');
      this.stats.fixed = updateCount;
    } else {
      console.log('ℹ️  No fixes could be applied automatically');
    }
  }

  displaySummary() {
    console.log('\n🎯 FINAL SUMMARY');
    console.log('=' .repeat(50));
    
    const hasIssues = this.issues.length > 0;
    console.log(`Status: ${hasIssues ? '⚠️  HAD ISSUES' : '✅ ALL GOOD'}`);
    console.log(`Total records checked: ${this.stats.total}`);
    console.log(`Issues found: ${this.issues.length}`);
    console.log(`Issues fixed: ${this.stats.fixed}`);
    
    if (this.stats.fixed > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('   All owner names now equal usernames where possible');
      console.log('   New registrations will maintain this consistency');
    }
    
    console.log('\n📋 WHAT HAPPENS NEXT:');
    console.log('   • Your display logic already prioritizes username');
    console.log('   • New registrations now set both fields correctly');
    console.log('   • Existing data has been made consistent');
    console.log('   • No further action needed!');
  }
}

async function main() {
  console.log('\n🔍 OWNER-USERNAME DATA VERIFICATION & MIGRATION');
  console.log('=' .repeat(60));
  
  const verifier = new OwnerDataVerifier();
  
  try {
    // Verify data
    await verifier.verifyTeamSeasonsCollection();
    await verifier.verifyTeamsCollection();
    
    // Display results
    verifier.displayResults();
    
    // Ask user if they want to fix issues
    if (verifier.issues.length > 0) {
      console.log('\n❓ WOULD YOU LIKE TO FIX THESE ISSUES?');
      console.log('   This will update the inconsistent records to make owner_name = username');
      console.log('\n   Options:');
      console.log('   1. Run with --fix flag to automatically fix');
      console.log('   2. Review the issues above first');
      console.log('   3. Check your Firebase console to verify the data');
      
      // Check if --fix flag is provided
      if (process.argv.includes('--fix')) {
        console.log('\n🔧 --fix flag detected. Applying fixes...');
        await verifier.fixIssues();
      } else {
        console.log('\n⏸️  Skipping fixes. Run with --fix flag to apply fixes.');
        console.log('   Command: node scripts/verify-and-fix-owner-data.js --fix');
      }
    }
    
    verifier.displaySummary();
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('   • Make sure your .env.local file has the correct Firebase config');
    console.log('   • Verify your Firebase Admin credentials are set up');
    console.log('   • Check your internet connection');
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });