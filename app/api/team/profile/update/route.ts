import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { formatId, ID_PREFIXES, ID_PADDING } from '@/lib/id-utils';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        error: auth.error || 'Unauthorized',
      }, { status: 401 });
    }

    const userId = auth.userId!;
    const body = await request.json();
    const { teamName, logoUrl, owner, manager, seasonId } = body;

    // Get team ID from Neon
    const teamResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
    `;
    
    if (teamResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Team not found',
      }, { status: 404 });
    }

    const teamId = teamResult[0].id;

    // Update team name/logo in Neon teams table
    if (teamName || logoUrl) {
      const updates: string[] = [];
      const values: any[] = [];
      
      if (teamName) {
        updates.push(`name = $${values.length + 1}`);
        values.push(teamName);
      }
      if (logoUrl) {
        updates.push(`logo_url = $${values.length + 1}`);
        values.push(logoUrl);
      }
      
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        await sql`UPDATE teams SET ${sql(updates.join(', '))} WHERE id = ${teamId}`;
      }
    }

    // Update team_seasons in Firebase
    if (seasonId && (teamName || logoUrl)) {
      const teamSeasonRef = adminDb.collection('team_seasons').doc(`${teamId}_${seasonId}`);
      const updateData: any = { updated_at: new Date() };
      
      if (teamName) updateData.team_name = teamName;
      if (logoUrl) updateData.team_logo = logoUrl;
      
      await teamSeasonRef.update(updateData);
    }

    const tournamentSql = getTournamentDb();

    // Handle owner updates
    if (owner) {
      const {
        name,
        photo_url,
        email,
        phone,
        date_of_birth,
        place,
        nationality,
        bio,
        instagram_handle,
        twitter_handle
      } = owner;

      // Check if owner exists for this team OR this user
      const existingOwner = await tournamentSql`
        SELECT id, team_id FROM owners 
        WHERE team_id = ${teamId} 
           OR (registered_user_id = ${userId} AND registered_user_id IS NOT NULL)
        LIMIT 1
      `;

      if (existingOwner.length > 0) {
        // Update existing owner
        await tournamentSql`
          UPDATE owners
          SET 
            name = ${name || ''},
            photo_url = ${photo_url || null},
            email = ${email || null},
            phone = ${phone || null},
            date_of_birth = ${date_of_birth || null},
            place = ${place || null},
            nationality = ${nationality || null},
            bio = ${bio || null},
            instagram_handle = ${instagram_handle || null},
            twitter_handle = ${twitter_handle || null},
            updated_at = NOW()
          WHERE id = ${existingOwner[0].id}
        `;
      } else {
        // Generate proper owner ID
        const latestOwner = await tournamentSql`
          SELECT owner_id FROM owners
          ORDER BY id DESC
          LIMIT 1
        `;

        let nextCounter = 1;
        if (latestOwner.length > 0) {
          const lastId = latestOwner[0].owner_id;
          const numericPart = lastId.replace(/\D/g, '');
          if (numericPart) {
            const lastCounter = parseInt(numericPart, 10);
            if (!isNaN(lastCounter)) {
              nextCounter = lastCounter + 1;
            }
          }
        }

        const ownerId = formatId(ID_PREFIXES.OWNER, nextCounter, ID_PADDING.OWNER);

        // Create new owner
        await tournamentSql`
          INSERT INTO owners (
            owner_id,
            team_id,
            season_id,
            name,
            photo_url,
            email,
            phone,
            date_of_birth,
            place,
            nationality,
            bio,
            instagram_handle,
            twitter_handle,
            is_active,
            registered_user_id,
            created_by,
            created_at,
            updated_at
          ) VALUES (
            ${ownerId},
            ${teamId},
            ${seasonId || null},
            ${name || ''},
            ${photo_url || null},
            ${email || null},
            ${phone || null},
            ${date_of_birth || null},
            ${place || null},
            ${nationality || null},
            ${bio || null},
            ${instagram_handle || null},
            ${twitter_handle || null},
            true,
            ${userId},
            ${userId},
            NOW(),
            NOW()
          )
        `;
      }
    }

    // Handle manager updates
    if (manager && seasonId) {
      const {
        name,
        photo_url,
        email,
        phone,
        date_of_birth,
        place,
        nationality,
        jersey_number,
        is_player,
        player_id
      } = manager;

      // Check if manager exists for this season
      const existingManager = await tournamentSql`
        SELECT id FROM managers 
        WHERE team_id = ${teamId} AND season_id = ${seasonId}
        LIMIT 1
      `;

      if (existingManager.length > 0) {
        // Update existing manager
        await tournamentSql`
          UPDATE managers
          SET 
            name = ${name || ''},
            photo_url = ${photo_url || null},
            email = ${email || null},
            phone = ${phone || null},
            date_of_birth = ${date_of_birth || null},
            place = ${place || null},
            nationality = ${nationality || null},
            jersey_number = ${jersey_number || null},
            is_player = ${is_player || false},
            player_id = ${player_id || null},
            updated_at = NOW()
          WHERE id = ${existingManager[0].id}
        `;
      } else {
        // Generate proper manager ID
        const latestManager = await tournamentSql`
          SELECT manager_id FROM managers
          ORDER BY id DESC
          LIMIT 1
        `;

        let nextCounter = 1;
        if (latestManager.length > 0) {
          const lastId = latestManager[0].manager_id;
          const numericPart = lastId.replace(/\D/g, '');
          if (numericPart) {
            const lastCounter = parseInt(numericPart, 10);
            if (!isNaN(lastCounter)) {
              nextCounter = lastCounter + 1;
            }
          }
        }

        const managerId = formatId(ID_PREFIXES.MANAGER, nextCounter, ID_PADDING.MANAGER);

        // Create new manager
        await tournamentSql`
          INSERT INTO managers (
            manager_id,
            team_id,
            season_id,
            name,
            photo_url,
            email,
            phone,
            date_of_birth,
            place,
            nationality,
            jersey_number,
            is_player,
            player_id,
            is_active,
            created_by,
            created_at,
            updated_at
          ) VALUES (
            ${managerId},
            ${teamId},
            ${seasonId},
            ${name || ''},
            ${photo_url || null},
            ${email || null},
            ${phone || null},
            ${date_of_birth || null},
            ${place || null},
            ${nationality || null},
            ${jersey_number || null},
            ${is_player || false},
            ${player_id || null},
            true,
            ${userId},
            NOW(),
            NOW()
          )
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update profile',
    }, { status: 500 });
  }
}
