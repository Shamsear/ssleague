import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Load environment variables
config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function migrateLogo() {
  console.log('🚀 Starting logo field migration...\n');

  try {
    // Fetch all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.size} users\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      try {
        // Determine the best logo URL to keep
        const logoUrl = userData.logoUrl || userData.teamLogoUrl || userData.team_logo_url || null;
        
        if (!logoUrl) {
          console.log(`⏭️  Skipping ${userData.username || userId} - No logo URL found`);
          skippedCount++;
          continue;
        }

        // Prepare update: set logoUrl and remove other fields
        const updateData: any = {
          logoUrl: logoUrl,
        };

        // Remove old fields if they exist
        const fieldsToRemove: string[] = [];
        if (userData.teamLogoUrl && userData.teamLogoUrl !== logoUrl) {
          fieldsToRemove.push('teamLogoUrl');
        }
        if (userData.team_logo_url && userData.team_logo_url !== logoUrl) {
          fieldsToRemove.push('team_logo_url');
        }
        if (userData.teamLogo) {
          fieldsToRemove.push('teamLogo');
        }
        if (userData.teamLogoFileId) {
          // Keep logoFileId if it exists, rename if needed
          if (userData.logoFileId) {
            fieldsToRemove.push('teamLogoFileId');
          } else {
            updateData.logoFileId = userData.teamLogoFileId;
            fieldsToRemove.push('teamLogoFileId');
          }
        }

        // Add fields to be deleted
        fieldsToRemove.forEach(field => {
          updateData[field] = FieldValue.delete();
        });

        // Only update if there are changes to make
        if (fieldsToRemove.length > 0 || !userData.logoUrl) {
          await db.collection('users').doc(userId).update(updateData);
          console.log(`✅ Migrated ${userData.username || userId}`);
          console.log(`   Logo URL: ${logoUrl}`);
          if (fieldsToRemove.length > 0) {
            console.log(`   Removed fields: ${fieldsToRemove.join(', ')}`);
          }
          console.log('');
          migratedCount++;
        } else {
          console.log(`✓  ${userData.username || userId} - Already using logoUrl only`);
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${userId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (no logo): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateLogo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
