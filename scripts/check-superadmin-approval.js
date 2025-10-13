#!/usr/bin/env node

/**
 * Check Super Admin Approval Status
 * 
 * This script checks if super admin accounts have the correct approval status
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

async function checkSuperAdminApproval() {
  console.log('\n🔍 CHECKING SUPER ADMIN APPROVAL STATUS');
  console.log('=' .repeat(60));
  
  try {
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('ℹ️  No users found');
      return;
    }
    
    const superAdmins = [];
    const allUsers = [];
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      const user = {
        uid: doc.id,
        username: userData.username || 'N/A',
        email: userData.email || 'N/A',
        role: userData.role || 'N/A',
        isActive: userData.isActive,
        isApproved: userData.isApproved,
        permissions: userData.permissions || [],
        createdAt: userData.createdAt,
        docRef: doc.ref
      };
      
      allUsers.push(user);
      
      if (userData.role === 'super_admin') {
        superAdmins.push(user);
      }
    });
    
    console.log('\n📊 USER SUMMARY');
    console.log('=' .repeat(40));
    console.log(`Total users: ${allUsers.length}`);
    console.log(`Super admins: ${superAdmins.length}`);
    console.log(`Committee admins: ${allUsers.filter(u => u.role === 'committee_admin').length}`);
    console.log(`Teams: ${allUsers.filter(u => u.role === 'team').length}`);
    
    if (superAdmins.length === 0) {
      console.log('\n⚠️  NO SUPER ADMINS FOUND!');
      console.log('This is a problem - you need at least one super admin.');
      return;
    }
    
    console.log('\n👑 SUPER ADMIN DETAILS');
    console.log('=' .repeat(40));
    
    const issuesFound = [];
    
    superAdmins.forEach((admin, index) => {
      console.log(`\n${index + 1}. Super Admin: ${admin.username}`);
      console.log(`   UID: ${admin.uid}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Active: ${admin.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`   Approved: ${admin.isApproved ? '✅ Yes' : '❌ NO (PROBLEM!)'}`);
      console.log(`   Permissions: ${admin.permissions.join(', ')}`);
      
      // Check for issues
      if (!admin.isApproved) {
        issuesFound.push({
          type: 'approval',
          admin: admin,
          message: 'Super admin is not approved - this causes "Pending Approval" status'
        });
      }
      
      if (!admin.isActive) {
        issuesFound.push({
          type: 'active',
          admin: admin,
          message: 'Super admin is not active'
        });
      }
      
      if (!admin.permissions.includes('all') && admin.permissions.length === 0) {
        issuesFound.push({
          type: 'permissions',
          admin: admin,
          message: 'Super admin has no permissions set'
        });
      }
    });
    
    if (issuesFound.length > 0) {
      console.log('\n⚠️  ISSUES FOUND');
      console.log('=' .repeat(40));
      
      issuesFound.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.admin.username} (${issue.admin.email})`);
        console.log(`   Issue: ${issue.message}`);
        console.log(`   Type: ${issue.type}`);
      });
      
      console.log('\n🔧 FIXES AVAILABLE:');
      if (process.argv.includes('--fix')) {
        console.log('Applying fixes...');
        await applyFixes(issuesFound);
      } else {
        console.log('Run with --fix flag to apply fixes automatically');
        console.log('Command: node scripts/check-superadmin-approval.js --fix');
      }
    } else {
      console.log('\n✅ ALL SUPER ADMINS ARE PROPERLY CONFIGURED');
    }
    
    // Show all users approval status
    console.log('\n📋 ALL USERS APPROVAL STATUS');
    console.log('=' .repeat(40));
    
    const pendingUsers = allUsers.filter(u => !u.isApproved);
    const approvedUsers = allUsers.filter(u => u.isApproved);
    
    console.log(`\nApproved users: ${approvedUsers.length}`);
    approvedUsers.forEach(u => {
      console.log(`  ✅ ${u.username} (${u.role}) - ${u.email}`);
    });
    
    if (pendingUsers.length > 0) {
      console.log(`\nPending approval: ${pendingUsers.length}`);
      pendingUsers.forEach(u => {
        console.log(`  ⏳ ${u.username} (${u.role}) - ${u.email}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
}

async function applyFixes(issues) {
  console.log('\n🔧 APPLYING FIXES');
  console.log('=' .repeat(40));
  
  const batch = db.batch();
  let fixCount = 0;
  
  for (const issue of issues) {
    const updates = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
    
    switch (issue.type) {
      case 'approval':
        updates.isApproved = true;
        console.log(`📝 ${issue.admin.username}: Setting isApproved = true`);
        fixCount++;
        break;
        
      case 'active':
        updates.isActive = true;
        console.log(`📝 ${issue.admin.username}: Setting isActive = true`);
        fixCount++;
        break;
        
      case 'permissions':
        updates.permissions = ['all'];
        console.log(`📝 ${issue.admin.username}: Setting permissions = ['all']`);
        fixCount++;
        break;
    }
    
    if (Object.keys(updates).length > 1) { // More than just updated_at
      batch.update(issue.admin.docRef, updates);
    }
  }
  
  if (fixCount > 0) {
    console.log(`\n💾 Committing ${fixCount} fixes...`);
    await batch.commit();
    console.log('✅ All fixes applied successfully!');
    
    console.log('\n🎉 RESULTS:');
    console.log('• Super admins are now properly approved');
    console.log('• "Pending Approval" status should be resolved');
    console.log('• Refresh your browser to see the changes');
  } else {
    console.log('ℹ️  No fixes needed to be applied');
  }
}

// Run the check
checkSuperAdminApproval()
  .then(() => {
    console.log('\n✅ Check completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });