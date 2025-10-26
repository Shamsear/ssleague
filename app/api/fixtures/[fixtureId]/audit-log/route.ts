import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET - Fetch audit log/timeline for a specific fixture
 * Shows complete history: creation, edits, result submissions, WO/NULL declarations, etc.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'fixtureId is required' },
        { status: 400 }
      );
    }

    // Fetch fixture details
    const fixtures = await sql`
      SELECT 
        id,
        season_id,
        round_number,
        match_number,
        home_team_name,
        away_team_name,
        status,
        created_at,
        created_by,
        created_by_name,
        updated_at,
        updated_by,
        updated_by_name,
        result_submitted_at,
        result_submitted_by,
        result_submitted_by_name,
        declared_at,
        declared_by,
        declared_by_name,
        match_status_reason
      FROM fixtures
      WHERE id = ${fixtureId}
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];

    // Fetch complete audit log
    const auditLogs = await sql`
      SELECT 
        id,
        action_type,
        action_by,
        action_by_name,
        action_at,
        changes,
        notes
      FROM fixture_audit_log
      WHERE fixture_id = ${fixtureId}
      ORDER BY action_at ASC
    `;

    // Build comprehensive timeline
    const timeline: any[] = [];

    // 1. Creation event
    if (fixture.created_at) {
      timeline.push({
        id: 'created',
        type: 'created',
        action: 'Fixture Created',
        user: fixture.created_by_name || 'System',
        user_id: fixture.created_by,
        timestamp: fixture.created_at,
        icon: '📅',
        color: 'blue',
        details: `Round ${fixture.round_number}, Match ${fixture.match_number} created`,
      });
    }

    // 2. Add all audit log entries
    auditLogs.forEach((log) => {
      let action = '';
      let icon = '';
      let color = '';
      let details = '';

      switch (log.action_type) {
        case 'updated':
          action = 'Fixture Updated';
          icon = '✏️';
          color = 'yellow';
          details = getUpdateDetails(log.changes);
          break;
        case 'result_submitted':
          action = 'Result Submitted';
          icon = '📊';
          color = 'green';
          details = getResultDetails(log.changes);
          break;
        case 'result_edited':
          action = 'Result Edited';
          icon = '🔄';
          color = 'orange';
          details = getResultEditDetails(log.changes);
          break;
        case 'wo_declared':
          action = 'Walkover Declared';
          icon = '⚠️';
          color = 'red';
          details = getWODetails(log.changes);
          break;
        case 'null_declared':
          action = 'Match Nullified';
          icon = '❌';
          color = 'gray';
          details = 'Both teams absent - match declared null';
          break;
        case 'deleted':
          action = 'Fixture Deleted';
          icon = '🗑️';
          color = 'red';
          details = 'Fixture was deleted';
          break;
        default:
          action = log.action_type;
          icon = '📝';
          color = 'gray';
          details = log.notes || '';
      }

      timeline.push({
        id: log.id,
        type: log.action_type,
        action,
        user: log.action_by_name,
        user_id: log.action_by,
        timestamp: log.action_at,
        icon,
        color,
        details,
        changes: log.changes,
        notes: log.notes,
      });
    });

    // 3. Result submission (if not in audit log)
    if (fixture.result_submitted_at && !auditLogs.find((l) => l.action_type === 'result_submitted')) {
      timeline.push({
        id: 'result_submitted',
        type: 'result_submitted',
        action: 'Result Submitted',
        user: fixture.result_submitted_by_name || 'Unknown',
        user_id: fixture.result_submitted_by,
        timestamp: fixture.result_submitted_at,
        icon: '📊',
        color: 'green',
        details: 'Match result was submitted',
      });
    }

    // 4. WO/NULL declaration (if not in audit log)
    if (fixture.declared_at && !auditLogs.find((l) => ['wo_declared', 'null_declared'].includes(l.action_type))) {
      timeline.push({
        id: 'declared',
        type: fixture.match_status_reason?.includes('wo') ? 'wo_declared' : 'null_declared',
        action: fixture.match_status_reason?.includes('wo') ? 'Walkover Declared' : 'Match Nullified',
        user: fixture.declared_by_name || 'Committee Admin',
        user_id: fixture.declared_by,
        timestamp: fixture.declared_at,
        icon: fixture.match_status_reason?.includes('wo') ? '⚠️' : '❌',
        color: 'red',
        details: getStatusReasonDetails(fixture.match_status_reason),
      });
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({
      success: true,
      fixture: {
        id: fixture.id,
        season_id: fixture.season_id,
        round_number: fixture.round_number,
        match_number: fixture.match_number,
        home_team: fixture.home_team_name,
        away_team: fixture.away_team_name,
        status: fixture.status,
        match_status_reason: fixture.match_status_reason,
      },
      timeline,
      totalEvents: timeline.length,
    });
  } catch (error) {
    console.error('Error fetching fixture audit log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixture audit log' },
      { status: 500 }
    );
  }
}

// Helper functions to extract details from changes
function getUpdateDetails(changes: any): string {
  if (!changes) return 'Fixture details updated';
  
  const changedFields: string[] = [];
  const old = changes.old || {};
  const newData = changes.new || {};

  if (old.home_team_name !== newData.home_team_name) {
    changedFields.push(`Home team: ${old.home_team_name} → ${newData.home_team_name}`);
  }
  if (old.away_team_name !== newData.away_team_name) {
    changedFields.push(`Away team: ${old.away_team_name} → ${newData.away_team_name}`);
  }
  if (old.scheduled_date !== newData.scheduled_date) {
    changedFields.push(`Date changed`);
  }
  if (old.status !== newData.status) {
    changedFields.push(`Status: ${old.status} → ${newData.status}`);
  }

  return changedFields.length > 0 ? changedFields.join(', ') : 'Fixture details updated';
}

function getResultDetails(changes: any): string {
  if (!changes?.new) return 'Result submitted';
  
  const newData = changes.new;
  return `Score: ${newData.home_team_name} ${newData.home_score} - ${newData.away_score} ${newData.away_team_name}`;
}

function getResultEditDetails(changes: any): string {
  if (!changes) return 'Result was edited';
  
  const old = changes.old || {};
  const newData = changes.new || {};
  
  return `Score changed: ${old.home_score}-${old.away_score} → ${newData.home_score}-${newData.away_score}`;
}

function getWODetails(changes: any): string {
  if (!changes?.new) return 'Walkover declared';
  
  const reason = changes.new.match_status_reason;
  if (reason === 'wo_home_absent') {
    return `Home team absent - Walkover to ${changes.new.away_team_name}`;
  } else if (reason === 'wo_away_absent') {
    return `Away team absent - Walkover to ${changes.new.home_team_name}`;
  }
  return 'Walkover declared';
}

function getStatusReasonDetails(reason: string | null): string {
  if (!reason) return '';
  
  switch (reason) {
    case 'wo_home_absent':
      return 'Home team was absent';
    case 'wo_away_absent':
      return 'Away team was absent';
    case 'null_both_absent':
      return 'Both teams were absent';
    default:
      return reason;
  }
}
