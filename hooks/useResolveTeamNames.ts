import { useState, useEffect } from 'react';

/**
 * React hook to resolve current team names from Firebase UIDs
 * Fetches the current team name from Neon database
 * 
 * @param firebaseUid - Single Firebase UID or array of UIDs
 * @returns Current team name(s)
 */
export function useResolveTeamName(firebaseUid: string | null | undefined): string {
  const [teamName, setTeamName] = useState<string>('Loading...');

  useEffect(() => {
    if (!firebaseUid) {
      setTeamName('Unknown Team');
      return;
    }

    const fetchName = async () => {
      try {
        const response = await fetch(`/api/teams/resolve-names?uid=${firebaseUid}`);
        const data = await response.json();
        
        if (data.success && data.name) {
          setTeamName(data.name);
        } else {
          setTeamName('Unknown Team');
        }
      } catch (error) {
        console.error('Error fetching team name:', error);
        setTeamName('Unknown Team');
      }
    };

    fetchName();
  }, [firebaseUid]);

  return teamName;
}

/**
 * React hook to resolve multiple team names at once
 * More efficient than calling useResolveTeamName multiple times
 * 
 * @param firebaseUids - Array of Firebase UIDs
 * @returns Map of UID -> current team name
 */
export function useResolveTeamNames(firebaseUids: string[]): Map<string, string> {
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUids || firebaseUids.length === 0) {
      setNameMap(new Map());
      setIsLoading(false);
      return;
    }

    const fetchNames = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/teams/resolve-names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebaseUids })
        });
        
        const data = await response.json();
        
        if (data.success && data.names) {
          const map = new Map<string, string>();
          Object.entries(data.names).forEach(([uid, name]) => {
            map.set(uid, name as string);
          });
          setNameMap(map);
        }
      } catch (error) {
        console.error('Error fetching team names:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNames();
  }, [JSON.stringify(firebaseUids)]); // Use JSON.stringify to properly compare arrays

  return nameMap;
}

/**
 * Higher-order component to wrap data with resolved team names
 * Use this to automatically resolve team names in your data
 * 
 * @example
 * const resolvedData = useResolvedTeamData(historicalMatches, 'team_id', 'team_name');
 */
export function useResolvedTeamData<T extends Record<string, any>>(
  data: T[] | null | undefined,
  teamIdField: string = 'team_id',
  teamNameField: string = 'team_name'
): { data: T[] | null; isLoading: boolean } {
  const [resolvedData, setResolvedData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract unique team UIDs from data
  const teamUids = data 
    ? [...new Set(data.map(item => item[teamIdField]).filter(Boolean))]
    : [];

  const nameMap = useResolveTeamNames(teamUids);

  useEffect(() => {
    if (!data) {
      setResolvedData(null);
      setIsLoading(false);
      return;
    }

    if (teamUids.length === 0) {
      setResolvedData(data);
      setIsLoading(false);
      return;
    }

    // Wait for names to be resolved
    if (nameMap.size === 0) {
      return;
    }

    // Map data with resolved names
    const updated = data.map(item => {
      const teamUid = item[teamIdField];
      if (teamUid && nameMap.has(teamUid)) {
        return {
          ...item,
          [teamNameField]: nameMap.get(teamUid)
        };
      }
      return item;
    });

    setResolvedData(updated);
    setIsLoading(false);
  }, [data, nameMap, teamIdField, teamNameField]);

  return { data: resolvedData, isLoading };
}
