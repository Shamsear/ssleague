'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';

interface TeamAudit {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  expectedECoin: number;
  expectedSSCoin: number;
  actualECoin: number;
  actualSSCoin: number;
  eCoinDifference: number;
  sSCoinDifference: number;
  missingECoinRewards: number;
  missingSSCoinRewards: number;
  status: 'complete' | 'partial' | 'missing';
  missingMatches?: MissingMatch[];
}

interface MissingMatch {
  matchupId: string;
  opponent: string;
  result: string;
  date: string;
  roundNumber: number;
  missingECoin: boolean;
  missingSSCoin: boolean;
  wrongECoinAmount?: number; // Actual amount if wrong
  wrongSSCoinAmount?: number; // Actual amount if wrong
  expectedECoin: number;
  expectedSSCoin: number;
  duplicateECoinTransactions?: string[]; // IDs of duplicate transactions to delete
  duplicateSSCoinTransactions?: string[]; // IDs of duplicate transactions to delete
}

export default function MatchRewardsAuditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { userSeasonId } = usePermissions();

  const [teams, setTeams] = useState<any[]>([]);
  const [auditResults, setAuditResults] = useState<TeamAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'partial' | 'missing'>('all');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [creatingTransaction, setCreatingTransaction] = useState<string | null>(null);
  const [creatingAllMissing, setCreatingAllMissing] = useState(false);
  const [allTransactionsByFixture, setAllTransactionsByFixture] = useState<Record<string, Array<{ id: string; teamId: string; fixtureId: string; currency: string; amount: number; createdAt: any }>>>({});

  // Fixed reward amounts
  const ECOIN_WIN = 30;
  const ECOIN_DRAW = 20;
  const ECOIN_LOSS = 10;
  const SSCOIN_WIN = 6;
  const SSCOIN_DRAW = 4;
  const SSCOIN_LOSS = 2;

  const createAllMissingTransactions = async () => {
    if (!confirm('⚠️ This will fix ALL issues:\n\n• Create missing transactions\n• Create correcting transactions for wrong amounts\n• DELETE duplicate transactions (keeping oldest)\n\nContinue?')) {
      return;
    }

    setCreatingAllMissing(true);
    let successCount = 0;
    let errorCount = 0;
    let deletedCount = 0;

    try {
      // Get all teams with missing or partial rewards
      const teamsWithMissing = auditResults.filter(team => 
        (team.status === 'missing' || team.status === 'partial') && 
        team.missingMatches && 
        team.missingMatches.length > 0
      );

      for (const team of teamsWithMissing) {
        for (const match of team.missingMatches) {
          // First, handle duplicate transactions intelligently
          if (match.duplicateECoinTransactions && match.duplicateECoinTransactions.length > 0) {
            // Get all eCoin transactions for this match
            const txnKey = `${team.teamId}_${match.matchupId}`;
            const eCoinTxns = allTransactionsByFixture[txnKey]?.filter(t => t.currency === 'football') || [];
            
            if (eCoinTxns.length > 0) {
              // Sort by created_at to find oldest
              eCoinTxns.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return aTime - bTime;
              });
              
              const oldestTxn = eCoinTxns[0];
              const duplicatesToDelete = eCoinTxns.slice(1);
              
              // If the oldest transaction has wrong amount, update it to correct amount
              if (match.wrongECoinAmount !== undefined && oldestTxn.amount !== match.expectedECoin) {
                try {
                  await updateDoc(doc(db, 'transactions', oldestTxn.id), {
                    amount: match.expectedECoin,
                    updated_at: new Date()
                  });
                  console.log(`Updated eCoin transaction ${oldestTxn.id} from ${oldestTxn.amount} to ${match.expectedECoin}`);
                  successCount++;
                } catch (error) {
                  errorCount++;
                  console.error(`Failed to update transaction ${oldestTxn.id}:`, error);
                }
              }
              
              // Delete all duplicate transactions
              for (const txn of duplicatesToDelete) {
                try {
                  await deleteDoc(doc(db, 'transactions', txn.id));
                  deletedCount++;
                  console.log(`Deleted duplicate eCoin transaction: ${txn.id}`);
                } catch (error) {
                  errorCount++;
                  console.error(`Failed to delete transaction ${txn.id}:`, error);
                }
              }
            }
          }

          if (match.duplicateSSCoinTransactions && match.duplicateSSCoinTransactions.length > 0) {
            // Get all SSCoin transactions for this match
            const txnKey = `${team.teamId}_${match.matchupId}`;
            const sSCoinTxns = allTransactionsByFixture[txnKey]?.filter(t => t.currency === 'real') || [];
            
            if (sSCoinTxns.length > 0) {
              // Sort by created_at to find oldest
              sSCoinTxns.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return aTime - bTime;
              });
              
              const oldestTxn = sSCoinTxns[0];
              const duplicatesToDelete = sSCoinTxns.slice(1);
              
              // If the oldest transaction has wrong amount, update it to correct amount
              if (match.wrongSSCoinAmount !== undefined && oldestTxn.amount !== match.expectedSSCoin) {
                try {
                  await updateDoc(doc(db, 'transactions', oldestTxn.id), {
                    amount: match.expectedSSCoin,
                    updated_at: new Date()
                  });
                  console.log(`Updated SSCoin transaction ${oldestTxn.id} from ${oldestTxn.amount} to ${match.expectedSSCoin}`);
                  successCount++;
                } catch (error) {
                  errorCount++;
                  console.error(`Failed to update transaction ${oldestTxn.id}:`, error);
                }
              }
              
              // Delete all duplicate transactions
              for (const txn of duplicatesToDelete) {
                try {
                  await deleteDoc(doc(db, 'transactions', txn.id));
                  deletedCount++;
                  console.log(`Deleted duplicate SSCoin transaction: ${txn.id}`);
                } catch (error) {
                  errorCount++;
                  console.error(`Failed to delete transaction ${txn.id}:`, error);
                }
              }
            }
          }

          // Then create/fix missing or wrong transactions
          // Only create NEW transactions if completely missing
          if (match.missingECoin) {
            // Completely missing - create new transaction
            try {
              const response = await fetch('/api/transactions/create-match-reward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  team_id: team.teamId,
                  team_name: team.teamName,
                  season_id: userSeasonId,
                  fixture_id: match.matchupId,
                  currency_type: 'football',
                  amount: match.expectedECoin,
                  result: match.result
                })
              });

              if (response.ok) {
                successCount++;
              } else {
                errorCount++;
                console.error(`Failed to create eCoin for ${team.teamName} - ${match.matchupId}`);
              }
            } catch (error) {
              errorCount++;
              console.error(`Error creating eCoin for ${team.teamName}:`, error);
            }
          } else if (match.wrongECoinAmount !== undefined && !match.duplicateECoinTransactions) {
            // Wrong amount but no duplicates - update the existing transaction
            const txnKey = `${team.teamId}_${match.matchupId}`;
            const eCoinTxns = allTransactionsByFixture[txnKey]?.filter(t => t.currency === 'football') || [];
            
            if (eCoinTxns.length === 1) {
              try {
                await updateDoc(doc(db, 'transactions', eCoinTxns[0].id), {
                  amount: match.expectedECoin,
                  updated_at: new Date()
                });
                console.log(`Updated eCoin transaction ${eCoinTxns[0].id} from ${eCoinTxns[0].amount} to ${match.expectedECoin}`);
                successCount++;
              } catch (error) {
                errorCount++;
                console.error(`Failed to update transaction ${eCoinTxns[0].id}:`, error);
              }
            }
          }

          if (match.missingSSCoin) {
            // Completely missing - create new transaction
            try {
              const response = await fetch('/api/transactions/create-match-reward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  team_id: team.teamId,
                  team_name: team.teamName,
                  season_id: userSeasonId,
                  fixture_id: match.matchupId,
                  currency_type: 'real',
                  amount: match.expectedSSCoin,
                  result: match.result
                })
              });

              if (response.ok) {
                successCount++;
              } else {
                errorCount++;
                console.error(`Failed to create SSCoin for ${team.teamName} - ${match.matchupId}`);
              }
            } catch (error) {
              errorCount++;
              console.error(`Error creating SSCoin for ${team.teamName}:`, error);
            }
          } else if (match.wrongSSCoinAmount !== undefined && !match.duplicateSSCoinTransactions) {
            // Wrong amount but no duplicates - update the existing transaction
            const txnKey = `${team.teamId}_${match.matchupId}`;
            const sSCoinTxns = allTransactionsByFixture[txnKey]?.filter(t => t.currency === 'real') || [];
            
            if (sSCoinTxns.length === 1) {
              try {
                await updateDoc(doc(db, 'transactions', sSCoinTxns[0].id), {
                  amount: match.expectedSSCoin,
                  updated_at: new Date()
                });
                console.log(`Updated SSCoin transaction ${sSCoinTxns[0].id} from ${sSCoinTxns[0].amount} to ${match.expectedSSCoin}`);
                successCount++;
              } catch (error) {
                errorCount++;
                console.error(`Failed to update transaction ${sSCoinTxns[0].id}:`, error);
              }
            }
          }
        }
      }

      alert(`✅ Bulk fix complete!\n\nTransactions created: ${successCount}\nDuplicates deleted: ${deletedCount}\nFailed: ${errorCount}\n\n${deletedCount > 0 ? 'Duplicate transactions have been removed.' : ''}`);
      
      // Reload the audit data
      loadAuditData();
    } catch (error) {
      console.error('Error in bulk fix:', error);
      alert('❌ Error during bulk fix. Check console for details.');
    } finally {
      setCreatingAllMissing(false);
    }
  };

  const createMissingTransaction = async (
    teamId: string,
    teamName: string,
    fixtureId: string,
    currencyType: 'football' | 'real',
    amount: number,
    result: string,
    matchDate: string
  ) => {
    const key = `${teamId}_${fixtureId}_${currencyType}`;
    setCreatingTransaction(key);

    try {
      const response = await fetch('/api/transactions/create-match-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          team_name: teamName,
          season_id: userSeasonId,
          fixture_id: fixtureId,
          currency_type: currencyType,
          amount,
          result,
          match_date: matchDate,
          description: `Match reward - ${result}`
        })
      });

      if (response.ok) {
        alert(`✅ Transaction created successfully!\n${amount} ${currencyType === 'football' ? 'eCoin' : 'SSCoin'} added to ${teamName}`);
        // Reload the audit data
        loadAuditData();
      } else {
        const error = await response.json();
        alert(`❌ Failed to create transaction: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('❌ Error creating transaction. Check console for details.');
    } finally {
      setCreatingTransaction(null);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'committee_admin' && userSeasonId) {
      loadAuditData();
    }
  }, [user, userSeasonId]);

  const loadAuditData = async () => {
    if (!userSeasonId) return;

    try {
      setIsLoading(true);

      // Load teams from team_seasons for current season
      const teamSeasonsQuery = query(
        collection(db, 'team_seasons'),
        where('season_id', '==', userSeasonId)
      );
      
      const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);

      const teamsList: any[] = [];
      teamSeasonsSnapshot.forEach(doc => {
        const data = doc.data();
        teamsList.push({
          id: data.team_id,
          name: data.team_name || data.team_id
        });
      });

      setTeams(teamsList);
      console.log(`Loaded ${teamsList.length} teams for season ${userSeasonId}`);

      // Fetch all match reward transactions FIRST
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('transaction_type', '==', 'match_reward')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      console.log(`Loaded ${transactionsSnapshot.size} total match reward transactions`);

      // Group transactions by team and currency, filtering by season in code
      const teamTransactions: Record<string, { eCoin: number; sSCoin: number }> = {};
      const teamMatchTransactions: Record<string, Map<string, { eCoin: number; sSCoin: number }>> = {}; // Track amounts per match
      const allTransactionsByFixtureTemp: Record<string, Array<{ id: string; teamId: string; fixtureId: string; currency: string; amount: number; createdAt: any }>> = {}; // Track all transactions for duplicate detection
      
      let seasonFilteredCount = 0;
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Filter by season in code
        if (data.season_id !== userSeasonId) {
          return;
        }
        
        seasonFilteredCount++;
        const teamId = data.team_id;
        // fixture_id is stored in metadata (or at top level for old format)
        const fixtureId = data.metadata?.fixture_id || data.fixture_id || data.matchup_id;
        
        if (!teamTransactions[teamId]) {
          teamTransactions[teamId] = { eCoin: 0, sSCoin: 0 };
        }
        
        if (!teamMatchTransactions[teamId]) {
          teamMatchTransactions[teamId] = new Map();
        }
        
        // Track amounts per fixture
        if (fixtureId) {
          if (!teamMatchTransactions[teamId].has(fixtureId)) {
            teamMatchTransactions[teamId].set(fixtureId, { eCoin: 0, sSCoin: 0 });
          }
          
          const matchAmounts = teamMatchTransactions[teamId].get(fixtureId)!;
          
          // Track all transactions for duplicate detection
          const txnKey = `${teamId}_${fixtureId}`;
          if (!allTransactionsByFixtureTemp[txnKey]) {
            allTransactionsByFixtureTemp[txnKey] = [];
          }
          
          // Handle different currency type formats
          if (data.currency_type === 'mixed') {
            // Mixed format: both currencies in one transaction
            const eCoinAmount = Math.abs(data.amount || data.metadata?.ecoin || 0);
            const sSCoinAmount = Math.abs(data.amount_real || data.metadata?.sscoin || 0);
            
            teamTransactions[teamId].eCoin += eCoinAmount;
            teamTransactions[teamId].sSCoin += sSCoinAmount;
            matchAmounts.eCoin += eCoinAmount;
            matchAmounts.sSCoin += sSCoinAmount;
            
            // Track both currencies
            if (eCoinAmount > 0) {
              allTransactionsByFixtureTemp[txnKey].push({
                id: doc.id,
                teamId,
                fixtureId,
                currency: 'football',
                amount: eCoinAmount,
                createdAt: data.created_at
              });
            }
            if (sSCoinAmount > 0) {
              allTransactionsByFixtureTemp[txnKey].push({
                id: doc.id,
                teamId,
                fixtureId,
                currency: 'real',
                amount: sSCoinAmount,
                createdAt: data.created_at
              });
            }
          } else if (data.currency_type === 'football') {
            // Football only - use absolute value for match rewards
            const amount = Math.abs(data.amount || 0);
            teamTransactions[teamId].eCoin += amount;
            matchAmounts.eCoin += amount;
            
            allTransactionsByFixtureTemp[txnKey].push({
              id: doc.id,
              teamId,
              fixtureId,
              currency: 'football',
              amount,
              createdAt: data.created_at
            });
          } else if (data.currency_type === 'real') {
            // Real only - use absolute value for match rewards
            const amount = Math.abs(data.amount || 0);
            teamTransactions[teamId].sSCoin += amount;
            matchAmounts.sSCoin += amount;
            
            allTransactionsByFixtureTemp[txnKey].push({
              id: doc.id,
              teamId,
              fixtureId,
              currency: 'real',
              amount,
              createdAt: data.created_at
            });
          }
        } else {
          // If no fixture_id, still count in team totals (shouldn't happen for match rewards)
          console.warn(`Transaction ${doc.id} for team ${teamId} has no fixture_id`);
        }
      });
      
      console.log(`Filtered to ${seasonFilteredCount} transactions for season ${userSeasonId}`);
      
      // Store allTransactionsByFixture in state for button handlers
      setAllTransactionsByFixture(allTransactionsByFixtureTemp);

      // NOW fetch stats for each team individually using the same API as team detail page
      const results: TeamAudit[] = [];
      
      for (const team of teamsList) {
        try {
          const statsResponse = await fetch(`/api/teams/${team.id}/statistics?seasonId=${userSeasonId}`);
          
          if (!statsResponse.ok) {
            console.warn(`Failed to fetch stats for team ${team.name}`);
            continue;
          }
          
          const statsData = await statsResponse.json();
          
          if (!statsData.success || !statsData.overall) {
            console.warn(`No stats data for team ${team.name}`);
            continue;
          }
          
          const overall = statsData.overall;
          const matchesPlayed = overall.matches_played || 0;
          
          // Skip teams with no matches played
          if (matchesPlayed === 0) {
            console.log(`Skipping ${team.name} - no matches played`);
            continue;
          }
          
          const wins = overall.wins || 0;
          const draws = overall.draws || 0;
          const losses = overall.losses || 0;
          
          // Fetch team's matches to identify which specific matches are missing transactions
          const missingMatches: MissingMatch[] = [];
          try {
            const matchesResponse = await fetch(`/api/teams/${team.id}/matches?seasonId=${userSeasonId}`);
            console.log(`Matches API response for ${team.name}:`, matchesResponse.status);
            
            if (matchesResponse.ok) {
              const matchesData = await matchesResponse.json();
              const matches = matchesData.matches || [];
              
              matches.forEach((match: any) => {
                const fixtureId = match.fixture_id || match.matchup_id || match.id;
                const matchAmounts = teamMatchTransactions[team.id]?.get(fixtureId);
                
                // Calculate expected amounts
                let expectedECoin = 0;
                let expectedSSCoin = 0;
                
                if (match.result === 'Win') {
                  expectedECoin = ECOIN_WIN;
                  expectedSSCoin = SSCOIN_WIN;
                } else if (match.result === 'Draw') {
                  expectedECoin = ECOIN_DRAW;
                  expectedSSCoin = SSCOIN_DRAW;
                } else if (match.result === 'Loss') {
                  expectedECoin = ECOIN_LOSS;
                  expectedSSCoin = SSCOIN_LOSS;
                }
                
                const actualECoin = matchAmounts?.eCoin || 0;
                const actualSSCoin = matchAmounts?.sSCoin || 0;
                
                const eCoinWrong = actualECoin !== expectedECoin;
                const sSCoinWrong = actualSSCoin !== expectedSSCoin;
                
                // Check for duplicate transactions
                const txnKey = `${team.id}_${fixtureId}`;
                const allTxns = allTransactionsByFixtureTemp[txnKey] || [];
                
                // Group by currency and find duplicates
                const eCoinTxns = allTxns.filter(t => t.currency === 'football');
                const sSCoinTxns = allTxns.filter(t => t.currency === 'real');
                
                let duplicateECoinTransactions: string[] | undefined;
                let duplicateSSCoinTransactions: string[] | undefined;
                
                // If multiple transactions for same currency, keep oldest and mark rest as duplicates
                if (eCoinTxns.length > 1) {
                  // Sort by created_at, oldest first
                  eCoinTxns.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return aTime - bTime;
                  });
                  // Keep first (oldest), mark rest as duplicates
                  duplicateECoinTransactions = eCoinTxns.slice(1).map(t => t.id);
                }
                
                if (sSCoinTxns.length > 1) {
                  // Sort by created_at, oldest first
                  sSCoinTxns.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return aTime - bTime;
                  });
                  // Keep first (oldest), mark rest as duplicates
                  duplicateSSCoinTransactions = sSCoinTxns.slice(1).map(t => t.id);
                }
                
                // If either currency is missing, wrong amount, or has duplicates, add to missing matches
                if (eCoinWrong || sSCoinWrong || duplicateECoinTransactions || duplicateSSCoinTransactions) {
                  missingMatches.push({
                    matchupId: fixtureId,
                    opponent: match.opponent_name || 'Unknown',
                    result: match.result || 'Unknown',
                    date: match.match_date || match.created_at || 'Unknown',
                    roundNumber: match.round_number || 0,
                    missingECoin: actualECoin === 0,
                    missingSSCoin: actualSSCoin === 0,
                    wrongECoinAmount: actualECoin > 0 && eCoinWrong ? actualECoin : undefined,
                    wrongSSCoinAmount: actualSSCoin > 0 && sSCoinWrong ? actualSSCoin : undefined,
                    expectedECoin,
                    expectedSSCoin,
                    duplicateECoinTransactions,
                    duplicateSSCoinTransactions
                  });
                }
              });
            } else {
              const errorData = await matchesResponse.json().catch(() => ({}));
              console.error(`Failed to fetch matches for ${team.name}:`, matchesResponse.status, errorData);
            }
          } catch (error) {
            console.error(`Error fetching matches for ${team.name}:`, error);
          }
          
          // Calculate expected rewards
          const expectedECoin = (wins * ECOIN_WIN) + (draws * ECOIN_DRAW) + (losses * ECOIN_LOSS);
          const expectedSSCoin = (wins * SSCOIN_WIN) + (draws * SSCOIN_DRAW) + (losses * SSCOIN_LOSS);
          
          // Get actual rewards from transactions
          const actualECoin = teamTransactions[team.id]?.eCoin || 0;
          const actualSSCoin = teamTransactions[team.id]?.sSCoin || 0;
          
          // Calculate differences
          const eCoinDifference = actualECoin - expectedECoin;
          const sSCoinDifference = actualSSCoin - expectedSSCoin;
          
          // Determine status - check for ANY discrepancy (missing, extra, or wrong amounts)
          let status: 'complete' | 'partial' | 'missing' = 'complete';
          
          // Check if there are any matches with wrong amounts
          const hasWrongAmounts = missingMatches.length > 0;
          
          if (hasWrongAmounts) {
            // If there are any matches with wrong amounts (missing, extra, or incorrect)
            if (actualECoin === 0 && actualSSCoin === 0) {
              status = 'missing';
            } else {
              status = 'partial';
            }
          } else if (eCoinDifference !== 0 || sSCoinDifference !== 0) {
            // Fallback: if totals don't match but no specific matches identified
            status = 'partial';
          }
          
          results.push({
            teamId: team.id,
            teamName: team.name,
            matchesPlayed,
            wins,
            draws,
            losses,
            expectedECoin,
            expectedSSCoin,
            actualECoin,
            actualSSCoin,
            eCoinDifference,
            sSCoinDifference,
            missingECoinRewards: Math.max(0, -eCoinDifference),
            missingSSCoinRewards: Math.max(0, -sSCoinDifference),
            status,
            missingMatches
          });
        } catch (error) {
          console.error(`Error fetching stats for team ${team.name}:`, error);
        }
      }
      
      console.log(`Processed ${results.length} teams with match data`);

      // Sort by status (missing first, then partial, then complete)
      results.sort((a, b) => {
        const statusOrder = { missing: 0, partial: 1, complete: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.teamName.localeCompare(b.teamName);
      });

      console.log(`Audit complete: ${results.length} teams analyzed`);
      console.log(`Missing: ${results.filter(r => r.status === 'missing').length}, Partial: ${results.filter(r => r.status === 'partial').length}, Complete: ${results.filter(r => r.status === 'complete').length}`);
      
      setAuditResults(results);
    } catch (error) {
      console.error('Error loading audit data:', error);
      alert('Error loading audit data. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAuditToWhatsApp = () => {
    try {
      let message = '🔍 *MATCH REWARDS AUDIT*\n\n';
      message += `📅 Season: ${userSeasonId}\n`;
      message += `──────────────────────────────\n\n`;

      const filteredResults = filterStatus === 'all' 
        ? auditResults 
        : auditResults.filter(r => r.status === filterStatus);

      const missingCount = auditResults.filter(r => r.status === 'missing').length;
      const partialCount = auditResults.filter(r => r.status === 'partial').length;
      const completeCount = auditResults.filter(r => r.status === 'complete').length;

      message += `*SUMMARY*\n`;
      message += `✅ Complete: ${completeCount}\n`;
      message += `⚠️ Partial: ${partialCount}\n`;
      message += `❌ Missing: ${missingCount}\n\n`;
      message += `──────────────────────────────\n\n`;

      if (filteredResults.length > 0) {
        message += `*DETAILS*\n\n`;

        filteredResults.forEach((team, index) => {
          const statusEmoji = team.status === 'complete' ? '✅' : team.status === 'partial' ? '⚠️' : '❌';
          
          message += `${index + 1}. ${statusEmoji} *${team.teamName}*\n`;
          message += `   Matches: ${team.matchesPlayed} (W${team.wins} D${team.draws} L${team.losses})\n\n`;
          
          message += `   🔵 eCoin:\n`;
          message += `      Expected: ${team.expectedECoin}\n`;
          message += `      Actual: ${team.actualECoin}\n`;
          if (team.eCoinDifference !== 0) {
            message += `      ${team.eCoinDifference > 0 ? 'Extra' : 'Missing'}: ${Math.abs(team.eCoinDifference)}\n`;
          }
          message += `\n`;
          
          message += `   🟣 SSCoin:\n`;
          message += `      Expected: ${team.expectedSSCoin}\n`;
          message += `      Actual: ${team.actualSSCoin}\n`;
          if (team.sSCoinDifference !== 0) {
            message += `      ${team.sSCoinDifference > 0 ? 'Extra' : 'Missing'}: ${Math.abs(team.sSCoinDifference)}\n`;
          }
          message += `\n`;
        });
      }

      message += `──────────────────────────────\n`;
      message += `📊 ${filteredResults.length} teams\n`;
      message += `🕐 ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}\n`;

      navigator.clipboard.writeText(message).then(() => {
        alert('✅ Audit report copied to clipboard!\nPaste in WhatsApp.');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('❌ Failed to copy. Please try again.');
      });
    } catch (error) {
      console.error('Error generating WhatsApp message:', error);
      alert('❌ Error generating report.');
    }
  };

  const filteredResults = filterStatus === 'all' 
    ? auditResults 
    : auditResults.filter(r => r.status === filterStatus);

  const missingCount = auditResults.filter(r => r.status === 'missing').length;
  const partialCount = auditResults.filter(r => r.status === 'partial').length;
  const completeCount = auditResults.filter(r => r.status === 'complete').length;

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-gray-600 hover:text-orange-600 transition-colors mb-3 sm:mb-4 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-white/30 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text">Match Rewards Audit</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Verify all teams received correct match rewards</p>
                </div>
              </div>
              <button
                onClick={copyAuditToWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                title="Copy audit report to WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <span className="hidden sm:inline">Copy Report</span>
              </button>
              
              {(missingCount > 0 || partialCount > 0) && (
                <button
                  onClick={createAllMissingTransactions}
                  disabled={creatingAllMissing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                  title="Create all missing transactions"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="hidden sm:inline">
                    {creatingAllMissing ? 'Fixing...' : 'Fix All Issues'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-green-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Complete</div>
                <div className="text-3xl font-bold text-green-600">{completeCount}</div>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-yellow-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Partial</div>
                <div className="text-3xl font-bold text-yellow-600">{partialCount}</div>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-600" />
            </div>
          </div>

          <div className="glass rounded-xl p-4 border border-red-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Missing</div>
                <div className="text-3xl font-bold text-red-600">{missingCount}</div>
              </div>
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="glass rounded-xl p-4 mb-6 shadow-lg">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'all'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All ({auditResults.length})
            </button>
            <button
              onClick={() => setFilterStatus('complete')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'complete'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ✅ Complete ({completeCount})
            </button>
            <button
              onClick={() => setFilterStatus('partial')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'partial'
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⚠️ Partial ({partialCount})
            </button>
            <button
              onClick={() => setFilterStatus('missing')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'missing'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ❌ Missing ({missingCount})
            </button>
          </div>
        </div>

        {/* Results Table */}
        {filteredResults.length === 0 && !isLoading && (
          <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border border-white/30 shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4 sm:mb-6">
              <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Results</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
              {auditResults.length === 0 
                ? 'No team data found. Make sure teams have played matches this season.'
                : 'No teams match the selected filter.'}
            </p>
          </div>
        )}

        {filteredResults.length > 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl border border-white/30 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Team</th>
                  <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Matches</th>
                  <th className="px-4 lg:px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">W-D-L</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">eCoin</th>
                  <th className="px-4 lg:px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">SSCoin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredResults.map((team) => (
                  <React.Fragment key={team.teamId}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 lg:px-6 py-4">
                        {team.status === 'complete' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </span>
                        )}
                        {team.status === 'partial' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Partial
                          </span>
                        )}
                        {team.status === 'missing' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2">
                          {(team.status === 'missing' || team.status === 'partial') && (
                            <button
                              onClick={() => setExpandedTeam(expandedTeam === team.teamId ? null : team.teamId)}
                              className="text-indigo-600 hover:text-indigo-800 transition-colors"
                              title="Click to see missing match details"
                            >
                              <svg className={`w-4 h-4 transition-transform ${expandedTeam === team.teamId ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          <div className="font-semibold text-gray-900">{team.teamName}</div>
                          {(team.status === 'missing' || team.status === 'partial') && team.missingMatches && team.missingMatches.length > 0 && (
                            <span className="text-xs text-gray-500">
                              ({team.missingMatches.length} matches)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span className="font-bold text-gray-900">{team.matchesPlayed}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span className="text-sm text-gray-600">
                          {team.wins}-{team.draws}-{team.losses}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right">
                        <div className="text-sm">
                          <div className="font-semibold text-blue-600">
                            {team.actualECoin} / {team.expectedECoin}
                          </div>
                          {team.eCoinDifference !== 0 && (
                            <div className={`text-xs ${team.eCoinDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {team.eCoinDifference > 0 ? '+' : ''}{team.eCoinDifference}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right">
                        <div className="text-sm">
                          <div className="font-semibold text-purple-600">
                            {team.actualSSCoin} / {team.expectedSSCoin}
                          </div>
                          {team.sSCoinDifference !== 0 && (
                            <div className={`text-xs ${team.sSCoinDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {team.sSCoinDifference > 0 ? '+' : ''}{team.sSCoinDifference}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded row showing missing matches */}
                    {expandedTeam === team.teamId && (team.status === 'missing' || team.status === 'partial') && (
                      <tr>
                        <td colSpan={6} className="px-4 lg:px-6 py-4 bg-gray-50">
                          {team.missingMatches && team.missingMatches.length > 0 ? (
                            <div className="text-sm">
                              <div className="font-bold text-gray-900 mb-2">
                                Missing Match Rewards ({team.missingMatches.length} matches):
                              </div>
                              <div className="space-y-2">
                                {team.missingMatches.map((match, idx) => (
                                  <div key={`${team.teamId}-match-${idx}`} className="p-3 bg-white rounded border border-gray-200">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs text-gray-500 font-medium">R{match.roundNumber}</span>
                                          <span className="mx-1 text-gray-400">•</span>
                                          <span className="font-medium">vs {match.opponent}</span>
                                          <span className="mx-1 text-gray-400">•</span>
                                          <span className={`font-semibold ${
                                            match.result === 'Win' ? 'text-green-600' :
                                            match.result === 'Draw' ? 'text-yellow-600' :
                                            'text-red-600'
                                          }`}>{match.result}</span>
                                          <span className="mx-1 text-gray-400">•</span>
                                          <span className="text-gray-500 text-xs">{new Date(match.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex gap-3 mt-2 flex-wrap">
                                          {(match.missingECoin || match.wrongECoinAmount) && (
                                            <div className="flex items-center gap-2">
                                              <span className={`px-2 py-1 text-xs font-bold rounded ${
                                                match.wrongECoinAmount 
                                                  ? 'bg-orange-100 text-orange-700' 
                                                  : 'bg-blue-100 text-blue-700'
                                              }`}>
                                                {match.wrongECoinAmount 
                                                  ? `Wrong: ${match.wrongECoinAmount} eCoin (expected ${match.expectedECoin})`
                                                  : `Missing ${match.expectedECoin} eCoin`
                                                }
                                              </span>
                                              <button
                                                onClick={() => createMissingTransaction(
                                                  team.teamId,
                                                  team.teamName,
                                                  match.matchupId,
                                                  'football',
                                                  match.expectedECoin,
                                                  match.result,
                                                  match.date
                                                )}
                                                disabled={creatingTransaction === `${team.teamId}_${match.matchupId}_football`}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors"
                                              >
                                                {creatingTransaction === `${team.teamId}_${match.matchupId}_football` ? 'Creating...' : match.wrongECoinAmount ? 'Fix' : 'Create'}
                                              </button>
                                            </div>
                                          )}
                                          {match.duplicateECoinTransactions && match.duplicateECoinTransactions.length > 0 && (
                                            <div className="flex items-center gap-2">
                                              <span className="px-2 py-1 text-xs font-bold rounded bg-red-100 text-red-700">
                                                🔄 {match.duplicateECoinTransactions.length} duplicate eCoin transaction{match.duplicateECoinTransactions.length > 1 ? 's' : ''}
                                              </span>
                                              <button
                                                onClick={async () => {
                                                  if (confirm(`Fix ${match.duplicateECoinTransactions!.length} duplicate eCoin transaction(s)?\n\nThe oldest transaction will be ${match.wrongECoinAmount ? 'updated to correct amount' : 'kept'} and duplicates will be deleted.`)) {
                                                    try {
                                                      const txnKey = `${team.teamId}_${match.matchupId}`;
                                                      const eCoinTxns = allTransactionsByFixture[txnKey]?.filter(t => t.currency === 'football') || [];
                                                      
                                                      if (eCoinTxns.length > 0) {
                                                        eCoinTxns.sort((a, b) => {
                                                          const aTime = a.createdAt?.toMillis?.() || 0;
                                                          const bTime = b.createdAt?.toMillis?.() || 0;
                                                          return aTime - bTime;
                                                        });
                                                        
                                                        const oldestTxn = eCoinTxns[0];
                                                        const duplicatesToDelete = eCoinTxns.slice(1);
                                                        
                                                        let updated = 0;
                                                        let deleted = 0;
                                                        
                                                        // Update oldest if wrong amount
                                                        if (match.wrongECoinAmount !== undefined && oldestTxn.amount !== match.expectedECoin) {
                                                          await updateDoc(doc(db, 'transactions', oldestTxn.id), {
                                                            amount: match.expectedECoin,
                                                            updated_at: new Date()
                                                          });
                                                          updated++;
                                                        }
                                                        
                                                        // Delete duplicates
                                                        for (const txn of duplicatesToDelete) {
                                                          await deleteDoc(doc(db, 'transactions', txn.id));
                                                          deleted++;
                                                        }
                                                        
                                                        alert(`✅ Fixed!\n${updated > 0 ? `Updated: ${updated}\n` : ''}Deleted: ${deleted}`);
                                                        loadAuditData();
                                                      }
                                                    } catch (error) {
                                                      console.error('Error fixing duplicates:', error);
                                                      alert('❌ Error fixing duplicates. Check console.');
                                                    }
                                                  }
                                                }}
                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
                                              >
                                                Fix Duplicates
                                              </button>
                                            </div>
                                          )}
                                          {(match.missingSSCoin || match.wrongSSCoinAmount) && (
                                            <div className="flex items-center gap-2">
                                              <span className={`px-2 py-1 text-xs font-bold rounded ${
                                                match.wrongSSCoinAmount 
                                                  ? 'bg-orange-100 text-orange-700' 
                                                  : 'bg-purple-100 text-purple-700'
                                              }`}>
                                                {match.wrongSSCoinAmount 
                                                  ? `Wrong: ${match.wrongSSCoinAmount} SSCoin (expected ${match.expectedSSCoin})`
                                                  : `Missing ${match.expectedSSCoin} SSCoin`
                                                }
                                              </span>
                                              <button
                                                onClick={() => createMissingTransaction(
                                                  team.teamId,
                                                  team.teamName,
                                                  match.matchupId,
                                                  'real',
                                                  match.expectedSSCoin,
                                                  match.result,
                                                  match.date
                                                )}
                                                disabled={creatingTransaction === `${team.teamId}_${match.matchupId}_real`}
                                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors"
                                              >
                                                {creatingTransaction === `${team.teamId}_${match.matchupId}_real` ? 'Creating...' : match.wrongSSCoinAmount ? 'Fix' : 'Create'}
                                              </button>
                                            </div>
                                          )}
                                          {match.duplicateSSCoinTransactions && match.duplicateSSCoinTransactions.length > 0 && (
                                            <div className="flex items-center gap-2">
                                              <span className="px-2 py-1 text-xs font-bold rounded bg-red-100 text-red-700">
                                                🔄 {match.duplicateSSCoinTransactions.length} duplicate SSCoin transaction{match.duplicateSSCoinTransactions.length > 1 ? 's' : ''}
                                              </span>
                                              <button
                                                onClick={async () => {
                                                  if (confirm(`Fix ${match.duplicateSSCoinTransactions!.length} duplicate SSCoin transaction(s)?\n\nThe oldest transaction will be ${match.wrongSSCoinAmount ? 'updated to correct amount' : 'kept'} and duplicates will be deleted.`)) {
                                                    try {
                                                      const txnKey = `${team.teamId}_${match.matchupId}`;
                                                      const sSCoinTxns = allTransactionsByFixture[txnKey]?.filter(t => t.currency === 'real') || [];
                                                      
                                                      if (sSCoinTxns.length > 0) {
                                                        sSCoinTxns.sort((a, b) => {
                                                          const aTime = a.createdAt?.toMillis?.() || 0;
                                                          const bTime = b.createdAt?.toMillis?.() || 0;
                                                          return aTime - bTime;
                                                        });
                                                        
                                                        const oldestTxn = sSCoinTxns[0];
                                                        const duplicatesToDelete = sSCoinTxns.slice(1);
                                                        
                                                        let updated = 0;
                                                        let deleted = 0;
                                                        
                                                        // Update oldest if wrong amount
                                                        if (match.wrongSSCoinAmount !== undefined && oldestTxn.amount !== match.expectedSSCoin) {
                                                          await updateDoc(doc(db, 'transactions', oldestTxn.id), {
                                                            amount: match.expectedSSCoin,
                                                            updated_at: new Date()
                                                          });
                                                          updated++;
                                                        }
                                                        
                                                        // Delete duplicates
                                                        for (const txn of duplicatesToDelete) {
                                                          await deleteDoc(doc(db, 'transactions', txn.id));
                                                          deleted++;
                                                        }
                                                        
                                                        alert(`✅ Fixed!\n${updated > 0 ? `Updated: ${updated}\n` : ''}Deleted: ${deleted}`);
                                                        loadAuditData();
                                                      }
                                                    } catch (error) {
                                                      console.error('Error fixing duplicates:', error);
                                                      alert('❌ Error fixing duplicates. Check console.');
                                                    }
                                                  }
                                                }}
                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
                                              >
                                                Fix Duplicates
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 p-4 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="font-semibold text-yellow-800 mb-2">⚠️ Match details not available</p>
                              <p className="mb-2">Based on team statistics, this team is missing rewards:</p>
                              <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>Expected: {team.expectedECoin} eCoin, {team.expectedSSCoin} SSCoin</li>
                                <li>Received: {team.actualECoin} eCoin, {team.actualSSCoin} SSCoin</li>
                                <li className="font-semibold text-red-600">
                                  Missing: {team.missingECoinRewards} eCoin, {team.missingSSCoinRewards} SSCoin
                                </li>
                              </ul>
                              <p className="mt-3 text-xs text-gray-500">
                                To see which specific matches are missing, check the all-transactions page filtered by this team.
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
