/**
 * EXAMPLE: Historical Season Standings with Team Name Resolution
 * 
 * This shows how to integrate the team name resolver into a page
 * that displays historical season data with old team names.
 */

'use client';

import { useState, useEffect } from 'react';
import { useResolvedTeamData } from '@/hooks/useResolveTeamNames';

// Type for your data
interface StandingRow {
  team_id: string;
  team_name: string;  // This will be the OLD name from Firebase
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function HistoricalSeasonStandingsExample() {
  const [rawData, setRawData] = useState<StandingRow[] | null>(null);
  const [showHistoricalNames, setShowHistoricalNames] = useState(false);

  // Fetch historical standings (with old team names)
  useEffect(() => {
    async function fetchStandings() {
      const response = await fetch('/api/seasons/S15/standings');
      const data = await response.json();
      setRawData(data.standings);
    }
    fetchStandings();
  }, []);

  // Automatically resolve team names to current names
  const { data: resolvedData, isLoading } = useResolvedTeamData(
    rawData,
    'team_id',    // Field containing Firebase UID
    'team_name'   // Field to update with current name
  );

  // Choose which data to display based on toggle
  const displayData = showHistoricalNames ? rawData : resolvedData;

  if (!rawData) return <div>Loading...</div>;
  if (isLoading) return <div>Resolving team names...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Season 15 Standings</h1>
        
        {/* Optional: Toggle between historical and current names */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showHistoricalNames}
            onChange={(e) => setShowHistoricalNames(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Show historical team names</span>
        </label>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 text-left">Pos</th>
            <th className="p-3 text-left">Team</th>
            <th className="p-3 text-center">W</th>
            <th className="p-3 text-center">D</th>
            <th className="p-3 text-center">L</th>
            <th className="p-3 text-center">Points</th>
          </tr>
        </thead>
        <tbody>
          {displayData?.map((row, index) => (
            <tr key={row.team_id} className="border-b hover:bg-gray-50">
              <td className="p-3">{index + 1}</td>
              <td className="p-3 font-semibold">
                {row.team_name} {/* This now shows CURRENT name! */}
              </td>
              <td className="p-3 text-center">{row.wins}</td>
              <td className="p-3 text-center">{row.draws}</td>
              <td className="p-3 text-center">{row.losses}</td>
              <td className="p-3 text-center font-bold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showHistoricalNames && (
        <p className="mt-4 text-sm text-gray-600">
          ℹ️ Showing team names as they were in Season 15
        </p>
      )}
    </div>
  );
}


/**
 * ALTERNATIVE: Server-Side Resolution (Better Performance)
 * 
 * For better performance, resolve names server-side in your API route:
 */

// In your API route: /api/seasons/[id]/standings/route.ts
/*
import { NextRequest, NextResponse } from 'next/server';
import { resolveTeamNames } from '@/lib/team-name-resolver';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch historical standings from Firebase
    const standings = await fetchStandingsFromFirebase(params.id);
    
    // Resolve team names to current names
    const withCurrentNames = await resolveTeamNames(standings);
    
    return NextResponse.json({
      success: true,
      standings: withCurrentNames
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch standings'
    }, { status: 500 });
  }
}
*/


/**
 * ALTERNATIVE: Single Team Name (Simple Component)
 */

/*
import { useResolveTeamName } from '@/hooks/useResolveTeamNames';

function TeamBadge({ firebaseUid }: { firebaseUid: string }) {
  const currentName = useResolveTeamName(firebaseUid);
  
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
      <span className="font-semibold">{currentName}</span>
    </div>
  );
}
*/


/**
 * ALTERNATIVE: Multiple Teams (Batch Resolution)
 */

/*
import { useResolveTeamNames } from '@/hooks/useResolveTeamNames';

function TopScorersTable({ scorers }: { scorers: Array<{ team_id: string, name: string, goals: number }> }) {
  const teamUids = scorers.map(s => s.team_id);
  const teamNames = useResolveTeamNames(teamUids);
  
  return (
    <table>
      <tbody>
        {scorers.map(scorer => (
          <tr key={scorer.name}>
            <td>{scorer.name}</td>
            <td>{teamNames.get(scorer.team_id) || 'Unknown'}</td>
            <td>{scorer.goals}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
*/
