'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useModal } from '@/hooks/useModal';
import { useAutoLockLineups } from '@/hooks/useAutoLockLineups';
import { useRoundPhaseMonitor } from '@/hooks/useRoundPhaseMonitor';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import LineupDeadlineMonitor from '@/components/LineupDeadlineMonitor';

interface Matchup {
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  position: number;
  match_duration?: number; // 6, 7, or 8 minutes (eFootball half length)
  home_goals?: number | null;
  away_goals?: number | null;
  result_entered_by?: string | null;
  result_entered_at?: string | null;
  // Substitution tracking
  home_original_player_id?: string;
  home_original_player_name?: string;
  home_substituted?: boolean;
  home_sub_penalty?: number; // Penalty goals awarded to opponent (2 or 3)
  away_original_player_id?: string;
  away_original_player_name?: string;
  away_substituted?: boolean;
  away_sub_penalty?: number; // Penalty goals awarded to opponent (2 or 3)
}

interface Fixture {
  id: string;
  season_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  leg: string;
  status: string;
  scheduled_date?: Date;
  lineup_deadline?: string;
  motm_player_id?: string | null;
  motm_player_name?: string | null;
  // Penalty/Fine goals
  home_penalty_goals?: number;
  away_penalty_goals?: number;
}

interface RoundDeadlines {
  scheduled_date: string;
  round_start_time?: string;
  home_fixture_deadline_time: string;
  away_fixture_deadline_time: string;
  home_substitution_deadline_time?: string;
  away_substitution_deadline_time?: string;
  home_substitution_deadline_day_offset?: number;
  away_substitution_deadline_day_offset?: number;
  result_entry_deadline_day_offset: number;
  result_entry_deadline_time: string;
  status: string;
}

export default function FixturePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [isHomeTeam, setIsHomeTeam] = useState(false);
  const [roundDeadlines, setRoundDeadlines] = useState<RoundDeadlines | null>(null);
  const [phase, setPhase] = useState<'draft' | 'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed'>('closed');
  const [isLoading, setIsLoading] = useState(true);
  
  // Player data
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  const [homeStartingXI, setHomeStartingXI] = useState<any[]>([]);
  const [awayStartingXI, setAwayStartingXI] = useState<any[]>([]);
  
  // Matchup state
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<{[key: number]: string}>({});
  const [matchDurations, setMatchDurations] = useState<{[key: number]: number}>({}); // Duration per matchup
  const [isSaving, setIsSaving] = useState(false);
  const [canCreateMatchups, setCanCreateMatchups] = useState(false);
  const [canEditMatchups, setCanEditMatchups] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Result entry state
  const [matchResults, setMatchResults] = useState<{[key: number]: {home_goals: number, away_goals: number}}>({});
  const [motmPlayerId, setMotmPlayerId] = useState<string | null>(null);
  const [isResultMode, setIsResultMode] = useState(false);
  
  // Substitution state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subMatchupIndex, setSubMatchupIndex] = useState<number | null>(null);
  const [subSide, setSubSide] = useState<'home' | 'away' | null>(null);
  const [subNewPlayerId, setSubNewPlayerId] = useState<string>('');
  const [subPenaltyAmount, setSubPenaltyAmount] = useState(2); // Penalty goals to award opponent
  
  // Swap state
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstIndex, setSwapFirstIndex] = useState<number | null>(null);
  
  // Penalty goals state
  const [homePenaltyGoals, setHomePenaltyGoals] = useState(0);
  const [awayPenaltyGoals, setAwayPenaltyGoals] = useState(0);
  
  // Lineup submission tracking
  const [homeLineupSubmitted, setHomeLineupSubmitted] = useState(false);
  const [awayLineupSubmitted, setAwayLineupSubmitted] = useState(false);
  const [lineupDeadline, setLineupDeadline] = useState<Date | null>(null);
  const [canSubmitLineup, setCanSubmitLineup] = useState(false);
  const [phaseUpdateTrigger, setPhaseUpdateTrigger] = useState(0);
  
  // Substitution deadline tracking
  const [substitutionDeadline, setSubstitutionDeadline] = useState<Date | null>(null);
  const [canMakeSubstitution, setCanMakeSubstitution] = useState(false);

  // Monitor phase changes via WebSocket
  const { isConnected: wsConnected, lastCheck } = useRoundPhaseMonitor({
    seasonId: fixture?.season_id || '',
    enabled: !!fixture?.season_id && !isLoading,
    onPhaseChange: (roundNumber, newPhase) => {
      // Only refresh if this is our round
      if (fixture && roundNumber === fixture.round_number) {
        console.log(`🔄 Phase changed for current fixture: ${newPhase}`);
        setPhaseUpdateTrigger(prev => prev + 1);
      }
    },
  });

  // Auto-recalculate phase every 10 seconds to handle deadline transitions
  useEffect(() => {
    if (!fixture || !roundDeadlines || !roundDeadlines.scheduled_date) return;

    const recalculatePhase = () => {
      const now = new Date();
      
      // Parse all deadlines
      const homeDeadline = new Date(`${roundDeadlines.scheduled_date}T${roundDeadlines.home_fixture_deadline_time}:00+05:30`);
      const awayDeadline = new Date(`${roundDeadlines.scheduled_date}T${roundDeadlines.away_fixture_deadline_time}:00+05:30`);
      
      const resultDate = new Date(roundDeadlines.scheduled_date);
      resultDate.setDate(resultDate.getDate() + (roundDeadlines.result_entry_deadline_day_offset || 2));
      const resultDateStr = resultDate.toISOString().split('T')[0];
      const resultDeadline = new Date(`${resultDateStr}T${roundDeadlines.result_entry_deadline_time}:00+05:30`);

      // Calculate phase based on round status and deadlines
      let currentPhase: typeof phase = 'closed';
      
      // Check round status first
      if (roundDeadlines.status === 'pending' || roundDeadlines.status === 'scheduled') {
        // Round hasn't started yet - stay in draft mode
        currentPhase = 'draft';
      } else if (roundDeadlines.status === 'in_progress' || roundDeadlines.status === 'started' || roundDeadlines.status === 'active') {
        // Round is in progress - determine phase by deadlines
        if (now < homeDeadline) {
          currentPhase = 'home_fixture';     // Home team creates matchups
        } else if (now < awayDeadline) {
          currentPhase = 'fixture_entry';    // Away team reviews, both can finalize
        } else if (now < resultDeadline) {
          currentPhase = 'result_entry';     // Enter results
        } else {
          currentPhase = 'closed';           // Read-only
        }
      } else if (roundDeadlines.status === 'completed' || roundDeadlines.status === 'finalized') {
        // Round is completed
        currentPhase = 'closed';
      } else {
        // Unknown status - default to closed
        currentPhase = 'closed';
      }

      if (currentPhase !== phase) {
        console.log(`⏰ Phase auto-transition: ${phase} → ${currentPhase} (status: ${roundDeadlines.status})`);
        setPhase(currentPhase);
      }
    };

    // Check immediately
    recalculatePhase();
    
    // Then check every 10 seconds
    const interval = setInterval(recalculatePhase, 10000);
    return () => clearInterval(interval);
  }, [fixture, roundDeadlines, phase]);

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
  } = useModal();

  // Auto-lock lineups when deadline passes
  useAutoLockLineups(fixtureId, fixture?.lineup_deadline);

  // Function to generate WhatsApp share text
  const generateWhatsAppText = () => {
    if (!fixture || matchups.length === 0) return '';

    const homePlayerGoals = matchups.reduce((sum, m) => sum + (m.home_goals ?? 0), 0);
    const awayPlayerGoals = matchups.reduce((sum, m) => sum + (m.away_goals ?? 0), 0);
    
    // Calculate substitution penalties (awarded TO opponent)
    const homeSubPenalties = matchups.reduce((sum, m) => sum + (m.home_sub_penalty ?? 0), 0);
    const awaySubPenalties = matchups.reduce((sum, m) => sum + (m.away_sub_penalty ?? 0), 0);
    
    // Total goals including penalties
    const homeTotalGoals = homePlayerGoals + awaySubPenalties + homePenaltyGoals;
    const awayTotalGoals = awayPlayerGoals + homeSubPenalties + awayPenaltyGoals;
    
    const hasResults = matchups.some(m => m.home_goals !== null);
    const winner = hasResults
      ? homeTotalGoals > awayTotalGoals
        ? fixture.home_team_name
        : awayTotalGoals > homeTotalGoals
        ? fixture.away_team_name
        : 'DRAW'
      : '';

    // Get MOTM player name from fixture
    const motmName = fixture.motm_player_name || 'Not selected';
    
    // Extract season number from season_id (e.g., SSPSLS16 -> 16)
    const seasonMatch = fixture.season_id.match(/\d+$/);
    const seasonNumber = seasonMatch ? seasonMatch[0] : '15';

    // Get substitution details
    const substitutions = matchups.filter(m => m.home_substituted || m.away_substituted);
    const hasSubstitutions = substitutions.length > 0;

    // Get substitute players (all players beyond the first 5)
    const homeSubstitutes = homeStartingXI.length > 5 ? homeStartingXI.slice(5) : [];
    const awaySubstitutes = awayStartingXI.length > 5 ? awayStartingXI.slice(5) : [];
    const hasAnySubstitutes = homeSubstitutes.length > 0 || awaySubstitutes.length > 0;

    const text = `*SS PES SUPER LEAGUE - S${seasonNumber}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*MATCHDAY ${fixture.round_number}* - ${fixture.leg === 'first' ? '1st' : '2nd'} Leg

*${fixture.home_team_name}*  vs  *${fixture.away_team_name}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*MATCHUPS:*

${matchups.map((m, idx) => {
  // Format player names with substitution info
  const homePlayerDisplay = m.home_substituted 
    ? `${m.home_original_player_name} (${m.home_player_name})`
    : m.home_player_name;
  const awayPlayerDisplay = m.away_substituted 
    ? `${m.away_original_player_name} (${m.away_player_name})`
    : m.away_player_name;
  
  let line = '';
  if (hasResults && m.home_goals !== null && m.away_goals !== null) {
    line = `${idx + 1}. ${homePlayerDisplay} *${m.home_goals}-${m.away_goals}* ${awayPlayerDisplay}`;
  } else {
    line = `${idx + 1}. ${homePlayerDisplay} vs ${awayPlayerDisplay}`;
  }
  line += ` (${m.match_duration || 6}min)`;
  
  return line;
}).join('\n\n')}

${hasAnySubstitutes ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*SUBSTITUTES:*

${homeSubstitutes.length > 0 ? `*${fixture.home_team_name}:*\n${homeSubstitutes.map((sub, idx) => `   ${idx + 1}. ${sub.player_name}`).join('\n')}` : ''}${homeSubstitutes.length > 0 && awaySubstitutes.length > 0 ? '\n\n' : ''}${awaySubstitutes.length > 0 ? `*${fixture.away_team_name}:*\n${awaySubstitutes.map((sub, idx) => `   ${idx + 1}. ${sub.player_name}`).join('\n')}` : ''}
` : ''}

${hasSubstitutions ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*SUBSTITUTIONS & PENALTIES:*

${substitutions.map(m => {
  let subText = [];
  if (m.home_substituted) {
    subText.push(`WARNING Home: +${m.home_sub_penalty || 0} penalty goals awarded to ${fixture.away_team_name}`);
  }
  if (m.away_substituted) {
    subText.push(`WARNING Away: +${m.away_sub_penalty || 0} penalty goals awarded to ${fixture.home_team_name}`);
  }
  return subText.join('\n');
}).join('\n')}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*SCORE BREAKDOWN:*

*${fixture.home_team_name}*
Total: *${hasResults ? homeTotalGoals : 0}* goals
${hasResults && (homePlayerGoals > 0 || awaySubPenalties > 0 || homePenaltyGoals > 0) ? `   - Player Goals: ${homePlayerGoals}
${awaySubPenalties > 0 ? `   - Opponent Sub Penalties: +${awaySubPenalties}\n` : ''}${homePenaltyGoals > 0 ? `   - Fine/Violation Goals: +${homePenaltyGoals}\n` : ''}` : ''}
*${fixture.away_team_name}*
Total: *${hasResults ? awayTotalGoals : 0}* goals
${hasResults && (awayPlayerGoals > 0 || homeSubPenalties > 0 || awayPenaltyGoals > 0) ? `   - Player Goals: ${awayPlayerGoals}
${homeSubPenalties > 0 ? `   - Opponent Sub Penalties: +${homeSubPenalties}\n` : ''}${awayPenaltyGoals > 0 ? `   - Fine/Violation Goals: +${awayPenaltyGoals}\n` : ''}` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*MAN OF THE MATCH*
${hasResults ? `${motmName}` : 'To be announced'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${hasResults ? `*RESULT*
${winner === 'DRAW' ? '*MATCH DRAWN*' : `*${winner} WON!*`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : `*Match yet to be played*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}

_Powered by SS Super League S${seasonNumber} Committee_`;

    return text;
  };

  const handleWhatsAppShare = () => {
    const text = generateWhatsAppText();
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Poll lineup status AND matchups
  useEffect(() => {
    if (!fixtureId || !fixture) return;
    
    // Don't poll when in edit mode or result mode to avoid overwriting user changes
    if (isEditMode || isResultMode) return;

    const pollStatus = async () => {
      try {
        const [homeLineupResponse, awayLineupResponse, matchupsResponse] = await Promise.all([
          fetch(`/api/lineups?fixture_id=${fixtureId}&team_id=${fixture.home_team_id}`),
          fetch(`/api/lineups?fixture_id=${fixtureId}&team_id=${fixture.away_team_id}`),
          fetch(`/api/fixtures/${fixtureId}/matchups`)
        ]);

        if (homeLineupResponse.ok) {
          const homeLineupData = await homeLineupResponse.json();
          const hasHomeLineup = homeLineupData.success && homeLineupData.lineups && homeLineupData.lineups.starting_xi && homeLineupData.lineups.starting_xi.length > 0;
          setHomeLineupSubmitted(hasHomeLineup);
        }

        if (awayLineupResponse.ok) {
          const awayLineupData = await awayLineupResponse.json();
          const hasAwayLineup = awayLineupData.success && awayLineupData.lineups && awayLineupData.lineups.starting_xi && awayLineupData.lineups.starting_xi.length > 0;
          setAwayLineupSubmitted(hasAwayLineup);
        }

        // Poll matchups - auto-update when created
        if (matchupsResponse.ok) {
          const matchupsData = await matchupsResponse.json();
          if (matchupsData.matchups && matchupsData.matchups.length > 0) {
            // Only update if matchups changed (avoid unnecessary re-renders)
            if (JSON.stringify(matchupsData.matchups) !== JSON.stringify(matchups)) {
              console.log('✨ Matchups updated in real-time');
              setMatchups(matchupsData.matchups);
              
              // Initialize results if needed
              const resultsInit: {[key: number]: {home_goals: number, away_goals: number}} = {};
              matchupsData.matchups.forEach((m: Matchup) => {
                resultsInit[m.position] = {
                  home_goals: m.home_goals ?? 0,
                  away_goals: m.away_goals ?? 0
                };
              });
              setMatchResults(resultsInit);
            }
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    // Poll every 3 seconds for real-time updates
    const interval = setInterval(pollStatus, 3000);
    // Also poll immediately
    pollStatus();
    
    return () => clearInterval(interval);
  }, [fixtureId, fixture, matchups, isEditMode, isResultMode]);

  useEffect(() => {
    const loadFixture = async () => {
      if (!user || !fixtureId) return;

      try {
        setIsLoading(true);

        // Get fixture from Neon
        const fixtureResponse = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}`);
        
        if (!fixtureResponse.ok) {
          showAlert({
            type: 'error',
            title: 'Not Found',
            message: 'Fixture not found'
          });
          router.push('/dashboard/team/matches');
          return;
        }

        const { fixture: fixtureData } = await fixtureResponse.json();
        setFixture(fixtureData as Fixture);
        
        // Initialize penalty goals
        setHomePenaltyGoals(fixtureData.home_penalty_goals || 0);
        setAwayPenaltyGoals(fixtureData.away_penalty_goals || 0);

        // Get team_id from team_seasons
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('user_id', '==', user.uid),
          where('season_id', '==', fixtureData.season_id),
          where('status', '==', 'registered')
        );

        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
        if (teamSeasonsSnapshot.empty) {
          showAlert({
            type: 'error',
            title: 'Not Registered',
            message: 'Team not registered for this season'
          });
          router.push('/dashboard/team/matches');
          return;
        }

        const teamData = teamSeasonsSnapshot.docs[0].data();
        const currentTeamId = teamData.team_id;
        setTeamId(currentTeamId);

        const isHome = fixtureData.home_team_id === currentTeamId;
        const isAway = fixtureData.away_team_id === currentTeamId;
        setIsHomeTeam(isHome);

        if (!isHome && !isAway) {
          showAlert({
            type: 'error',
            title: 'Access Denied',
            message: 'You are not part of this fixture'
          });
          router.push('/dashboard/team/matches');
          return;
        }

        // Fetch round deadlines, players, and matchups in parallel from Neon
        console.log('🔍 Querying players from Neon:', {
          home_team_id: fixtureData.home_team_id,
          away_team_id: fixtureData.away_team_id,
          season_id: fixtureData.season_id
        });

        const [roundResponse, homePlayersResponse, awayPlayersResponse, matchupsResponse, homeLineupResponse, awayLineupResponse] = await Promise.all([
          fetch(`/api/round-deadlines?tournament_id=${fixtureData.tournament_id}&round_number=${fixtureData.round_number}&leg=${fixtureData.leg || 'first'}`),
          fetch(`/api/player-seasons?team_id=${fixtureData.home_team_id}&season_id=${fixtureData.season_id}`),
          fetch(`/api/player-seasons?team_id=${fixtureData.away_team_id}&season_id=${fixtureData.season_id}`),
          fetch(`/api/fixtures/${fixtureId}/matchups`),
          fetch(`/api/lineups?fixture_id=${fixtureId}&team_id=${fixtureData.home_team_id}`),
          fetch(`/api/lineups?fixture_id=${fixtureId}&team_id=${fixtureData.away_team_id}`)
        ]);

        // Parse player responses
        let homePlayersList: any[] = [];
        let awayPlayersList: any[] = [];
        
        // Track actual lineup submission status (used later for matchup permissions)
        let actualHomeLineupSubmitted = false;
        let actualAwayLineupSubmitted = false;

        if (homePlayersResponse.ok) {
          const homePlayersData = await homePlayersResponse.json();
          homePlayersList = homePlayersData.players || [];
        }

        if (awayPlayersResponse.ok) {
          const awayPlayersData = await awayPlayersResponse.json();
          awayPlayersList = awayPlayersData.players || [];
        }
        
        // Debug: Log player data to check category field
        if (homePlayersList.length > 0) {
          console.log('Sample home player data:', homePlayersList[0]);
        }
        if (awayPlayersList.length > 0) {
          console.log('Sample away player data:', awayPlayersList[0]);
        }
        
        setHomePlayers(homePlayersList);
        setAwayPlayers(awayPlayersList);
        
        // Process matchups first to determine if lineups should be visible
        let matchupsList: any[] = [];
        if (matchupsResponse.ok) {
          const matchupsData = await matchupsResponse.json();
          if (matchupsData.matchups && matchupsData.matchups.length > 0) {
            matchupsList = matchupsData.matchups;
            console.log('🎮 Matchups loaded:', matchupsList.length, 'First matchup:', matchupsList[0]);
            setMatchups(matchupsList);
          }
        }

        // Process lineup submissions
        // During fixture entry phase (after home deadline, before away deadline, no matchups),
        // each team's lineup changes should be private until matchups are created
        const matchupsExist = matchupsList.length > 0;
        
        if (homeLineupResponse.ok) {
          const homeLineupData = await homeLineupResponse.json();
          if (homeLineupData.success && homeLineupData.lineups && homeLineupData.lineups.starting_xi && homeLineupData.lineups.starting_xi.length > 0) {
            // Track actual submission status (for matchup creation logic)
            actualHomeLineupSubmitted = true;
            
            // Always load the starting XI data (needed for matchup creation)
            const homeStartingPlayers = homeLineupData.lineups.starting_xi
              .map((playerId: string) => homePlayersList.find((p: any) => p.player_id === playerId))
              .filter(Boolean);
            setHomeStartingXI(homeStartingPlayers);
            
            // Only show submission status if it's own team OR matchups exist
            if (isHome) {
              setHomeLineupSubmitted(true);
            } else if (matchupsExist) {
              setHomeLineupSubmitted(true);
            } else {
              // Don't show submission status (but data is loaded for matchup creation)
              console.log('🔒 Hiding home lineup status from away team (no matchups yet)');
            }
          }
        }
        
        if (awayLineupResponse.ok) {
          const awayLineupData = await awayLineupResponse.json();
          if (awayLineupData.success && awayLineupData.lineups && awayLineupData.lineups.starting_xi && awayLineupData.lineups.starting_xi.length > 0) {
            // Track actual submission status (for matchup creation logic)
            actualAwayLineupSubmitted = true;
            
            // Always load the starting XI data (needed for matchup creation)
            const awayStartingPlayers = awayLineupData.lineups.starting_xi
              .map((playerId: string) => awayPlayersList.find((p: any) => p.player_id === playerId))
              .filter(Boolean);
            setAwayStartingXI(awayStartingPlayers);
            
            // Only show submission status if it's own team OR matchups exist
            if (!isHome) {
              setAwayLineupSubmitted(true);
            } else if (matchupsExist) {
              setAwayLineupSubmitted(true);
            } else {
              // Don't show submission status (but data is loaded for matchup creation)
              console.log('🔒 Hiding away lineup status from home team (no matchups yet)');
            }
          }
        }
        
        console.log('📋 Lineup Status Check:', {
          isHome,
          matchupsExist,
          homeLineupSubmitted: actualHomeLineupSubmitted,
          awayLineupSubmitted: actualAwayLineupSubmitted,
          bothSubmitted: actualHomeLineupSubmitted && actualAwayLineupSubmitted,
          note: matchupsExist ? 'Showing both lineups' : 'Hiding opponent lineup'
        });
        
        // Process round deadlines and calculate phase
        if (roundResponse.ok) {
          const { roundDeadline } = await roundResponse.json();
          
          if (roundDeadline && roundDeadline.home_fixture_deadline_time && roundDeadline.away_fixture_deadline_time) {
            const deadlines = roundDeadline as RoundDeadlines;
            setRoundDeadlines(deadlines);

            // Skip deadline calculation if round hasn't been scheduled yet
            if (!deadlines.scheduled_date) {
              console.log('⏰ Round not scheduled yet - allowing draft lineup creation');
              setPhase('draft'); // Draft state for unscheduled matches
              setCanSubmitLineup(true); // Allow saving drafts
              setCanCreateMatchups(false); // No matchups until scheduled
              setCanEditMatchups(false);
              return; // Skip rest of deadline logic
            }

            // Calculate current phase
            // All times in database are IST (UTC+5:30)
            const now = new Date();
            
            // Parse scheduled_date and times as IST, then convert to Date objects
            const [homeHour, homeMin] = deadlines.home_fixture_deadline_time.split(':').map(Number);
            const homeDeadline = new Date(`${deadlines.scheduled_date}T${deadlines.home_fixture_deadline_time}:00+05:30`);

            const [awayHour, awayMin] = deadlines.away_fixture_deadline_time.split(':').map(Number);
            const awayDeadline = new Date(`${deadlines.scheduled_date}T${deadlines.away_fixture_deadline_time}:00+05:30`);

            // Result deadline is offset by days
            const resultDate = new Date(deadlines.scheduled_date);
            resultDate.setDate(resultDate.getDate() + (deadlines.result_entry_deadline_day_offset || 2));
            const resultDateStr = resultDate.toISOString().split('T')[0];
            const resultDeadline = new Date(`${resultDateStr}T${deadlines.result_entry_deadline_time}:00+05:30`);

            console.log('🕐 Phase Debug:', {
              now: now.toISOString(),
              scheduled_date: deadlines.scheduled_date,
              homeDeadline: homeDeadline.toISOString(),
              awayDeadline: awayDeadline.toISOString(),
              resultDeadline: resultDeadline.toISOString(),
              'now < awayDeadline': now < awayDeadline,
              'now < resultDeadline': now < resultDeadline
            });

            // Calculate phase based on round status and deadlines
            console.log('🔍 Round Status Check:', {
              status: deadlines.status,
              scheduled_date: deadlines.scheduled_date,
              round_start_time: deadlines.round_start_time,
              now: now.toISOString()
            });
            
            let currentPhase: typeof phase = 'closed';
            
            // Check round status first
            if (deadlines.status === 'pending' || deadlines.status === 'scheduled') {
              // Round hasn't started yet - stay in draft mode
              currentPhase = 'draft';
              console.log('📋 Round status is pending/scheduled - Draft mode');
            } else if (deadlines.status === 'in_progress' || deadlines.status === 'started' || deadlines.status === 'active') {
              // Round is in progress - determine phase by deadlines
              console.log('🎮 Round is active/in progress - checking deadlines');
              if (now < homeDeadline) {
                currentPhase = 'home_fixture';     // Home team creates matchups
              } else if (now < awayDeadline) {
                currentPhase = 'fixture_entry';    // Away team reviews, both can finalize
              } else if (now < resultDeadline) {
                currentPhase = 'result_entry';     // Enter results
              } else {
                currentPhase = 'closed';           // Read-only
              }
            } else if (deadlines.status === 'completed' || deadlines.status === 'finalized') {
              // Round is completed
              currentPhase = 'closed';
              console.log('✅ Round status is completed/finalized - Closed');
            } else {
              // Unknown status - default to closed
              currentPhase = 'closed';
              console.warn('⚠️ Unknown round status:', deadlines.status);
            }

            console.log('📊 Final Phase:', currentPhase);
            setPhase(currentPhase);
            
            // Calculate lineup deadline (round start time - no grace period)
            // Use round_start_time if available (actual time round started/restarted)
            // Otherwise fall back to home_fixture_deadline_time (scheduled start time)
            const actualRoundStartTimeStr = deadlines.round_start_time || deadlines.home_fixture_deadline_time;
            const roundStartTime = new Date(`${deadlines.scheduled_date}T${actualRoundStartTimeStr}:00+05:30`);
            const lineupDeadlineTime = roundStartTime; // Lineup deadline is exactly at round start
            setLineupDeadline(lineupDeadlineTime);
            
            console.log('⏰ Lineup Deadline Debug:', {
              scheduled_date: deadlines.scheduled_date,
              round_start_time: deadlines.round_start_time,
              home_fixture_deadline_time: deadlines.home_fixture_deadline_time,
              actualRoundStartTimeStr,
              roundStartTime: roundStartTime.toISOString(),
              roundStartLocal: roundStartTime.toLocaleString(),
              lineupDeadlineTime: lineupDeadlineTime.toISOString(),
              lineupDeadlineLocal: lineupDeadlineTime.toLocaleString(),
              now: now.toISOString(),
              nowLocal: now.toLocaleString(),
              canSubmit: now < lineupDeadlineTime
            });
            
            // Calculate lineup submission permissions
            // 1. Before round start: anyone can submit (if no matchups)
            // 2. Home team: can submit until home deadline (even if matchups exist, they'll be deleted)
            // 3. After home deadline: if no matchups, both teams can submit until away deadline
            
            const homeDeadlineTime = new Date(`${deadlines.scheduled_date}T${deadlines.home_fixture_deadline_time}:00+05:30`);
            const awayDeadlineTime = new Date(`${deadlines.scheduled_date}T${deadlines.away_fixture_deadline_time}:00+05:30`);
            
            let canSubmit = false;
            let submitReason = '';
            
            if (matchupsList.length > 0) {
              // Matchups exist - only home team can edit before home deadline
              if (isHome && now < homeDeadlineTime) {
                canSubmit = true;
                submitReason = 'Home team can edit until home deadline (will delete matchups)';
              } else {
                canSubmit = false;
                submitReason = 'Matchups created - lineups locked';
              }
            } else {
              // No matchups yet
              if (now < homeDeadlineTime) {
                // Before home deadline - anyone can submit
                canSubmit = true;
                submitReason = 'Before home deadline';
              } else if (now < awayDeadlineTime) {
                // After home deadline, before away deadline - both teams can submit
                canSubmit = true;
                submitReason = 'Fixture entry phase - both teams can submit';
              } else {
                // After away deadline
                canSubmit = false;
                submitReason = 'Deadline passed';
              }
            }
            
            setCanSubmitLineup(canSubmit);
            
            console.log('🔒 Lineup Edit Permission:', {
              isHome,
              now: now.toISOString(),
              homeDeadline: homeDeadlineTime.toISOString(),
              awayDeadline: awayDeadlineTime.toISOString(),
              matchupsExist: matchupsList.length > 0,
              canSubmitLineup: canSubmit,
              reason: submitReason
            });

            // Calculate substitution deadline
            // Home team: 21:00 on day after scheduled_date (day_offset = +1)
            // Away team: 21:00 on round start day (day_offset = 0)
            
            // Validate scheduled_date exists and is valid
            if (!deadlines.scheduled_date) {
              console.warn('⚠️ No scheduled_date available for substitution deadline calculation');
              setSubstitutionDeadline(null);
              setCanMakeSubstitution(false);
            } else {
              let subTime = isHome 
                ? (deadlines.home_substitution_deadline_time || '21:00')
                : (deadlines.away_substitution_deadline_time || '21:00');
              
              // Validate and sanitize time format (should be HH:MM)
              const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
              if (!timeRegex.test(subTime)) {
                console.warn(`⚠️ Invalid time format: ${subTime}, using default 21:00`);
                subTime = '21:00';
              }
              
              const subDayOffset = isHome
                ? (deadlines.home_substitution_deadline_day_offset !== undefined ? deadlines.home_substitution_deadline_day_offset : 1)
                : (deadlines.away_substitution_deadline_day_offset !== undefined ? deadlines.away_substitution_deadline_day_offset : 0);
              
              const subDate = new Date(deadlines.scheduled_date);
              
              // Validate the base date
              if (isNaN(subDate.getTime())) {
                console.error('❌ Invalid scheduled_date:', deadlines.scheduled_date);
                setSubstitutionDeadline(null);
                setCanMakeSubstitution(false);
              } else {
                subDate.setDate(subDate.getDate() + subDayOffset);
                const subDateStr = subDate.toISOString().split('T')[0];
                const substitutionDeadlineTime = new Date(`${subDateStr}T${subTime}:00+05:30`);
                
                // Validate the final constructed date
                if (isNaN(substitutionDeadlineTime.getTime())) {
                  console.error('❌ Invalid substitution deadline construction:', {
                    scheduled_date: deadlines.scheduled_date,
                    subTime,
                    subDayOffset,
                    subDateStr,
                    constructedString: `${subDateStr}T${subTime}:00+05:30`,
                    deadlines: deadlines
                  });
                  setSubstitutionDeadline(null);
                  setCanMakeSubstitution(false);
                } else {
                  setSubstitutionDeadline(substitutionDeadlineTime);
                  
                  const canSub = now < substitutionDeadlineTime;
                  setCanMakeSubstitution(canSub);
                  
                  console.log('🔄 Substitution Deadline Debug:', {
                    isHome,
                    subTime,
                    subDayOffset,
                    subDateStr,
                    substitutionDeadline: substitutionDeadlineTime.toISOString(),
                    substitutionDeadlineLocal: substitutionDeadlineTime.toLocaleString(),
                    now: now.toISOString(),
                    canMakeSubstitution: canSub
                  });
                }
              }
            }

            // Determine matchup permissions with separate phases
            const matchupsExist = matchupsList.length > 0;
            const bothLineupsSubmitted = actualHomeLineupSubmitted && actualAwayLineupSubmitted;
            
            // Check if round has actually started based on status
            const roundHasStarted = deadlines.status === 'in_progress' || 
                                   deadlines.status === 'started' || 
                                   deadlines.status === 'active';
            
            console.log('🎮 Matchup Permissions Check:', {
              currentPhase,
              bothLineupsSubmitted,
              matchupsExist,
              isHome,
              roundHasStarted,
              roundStatus: deadlines.status,
              now: now.toISOString()
            });

            let canCreate = false;
            let canEditMatch = false;

            // Matchups can only be created/edited AFTER the round has started
            if (roundHasStarted) {
              if (currentPhase === 'home_fixture' && bothLineupsSubmitted) {
                // Home fixture phase (before home deadline)
                // Only home team can create/edit matchups
                if (!matchupsExist) {
                  canCreate = isHome;
                } else {
                  canEditMatch = isHome;
                }
              } else if (currentPhase === 'fixture_entry' && bothLineupsSubmitted) {
                // Fixture entry phase (after home deadline, before away deadline)
                // Both teams can create if not exist
                // Whichever team creates first gets edit rights
                if (!matchupsExist) {
                  canCreate = true;  // Both teams can create
                } else {
                  // Check who created the matchups
                  const firstMatchup = matchupsList[0];
                  const createdByHome = firstMatchup?.home_player_id && homePlayersList.some(p => p.player_id === firstMatchup.home_player_id);
                  const createdByThisTeam = (isHome && createdByHome) || (!isHome && !createdByHome);
                  canEditMatch = createdByThisTeam;  // Team that created matchups can edit
                }
              }
            } else {
              // Round hasn't started yet - no matchup creation allowed
              console.log('⏰ Round has not started yet - matchup creation disabled');
            }

            setCanCreateMatchups(canCreate);
            setCanEditMatchups(canEditMatch);
          }
        }
      } catch (error: any) {
        console.error('Error loading fixture:', error);
        console.error('Error stack:', error?.stack);
        console.error('Error message:', error?.message);
        showAlert({
          type: 'error',
          title: 'Load Failed',
          message: `Failed to load fixture: ${error?.message || 'Unknown error'}`
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFixture();
  }, [user, fixtureId, router, lastCheck, phaseUpdateTrigger]); // Re-fetch when phase changes

  const handleCreateMatchups = async () => {
    // Validate lineups are submitted
    if (homeStartingXI.length === 0 || awayStartingXI.length === 0) {
      showAlert({
        type: 'error',
        title: 'Lineups Required',
        message: 'Both teams must submit their lineups before creating matchups'
      });
      return;
    }

    // Validate all matchups are selected
    if (Object.keys(selectedAwayPlayers).length !== homeStartingXI.length) {
      showAlert({
        type: 'warning',
        title: 'Incomplete Selection',
        message: 'Please select an away player for each home player'
      });
      return;
    }

    console.log('🏠 Home starting XI:', homeStartingXI.length, 'players');
    console.log('✈️ Away starting XI:', awayStartingXI.length, 'players');
    console.log('🔗 Selected away players:', selectedAwayPlayers);

    setIsSaving(true);
    try {
      // Create matchups from starting XI
      const matchupsToSave: Matchup[] = homeStartingXI.map((homePlayer, idx) => ({
        home_player_id: homePlayer.player_id,
        home_player_name: homePlayer.player_name,
        away_player_id: selectedAwayPlayers[idx],
        away_player_name: awayStartingXI.find(p => p.player_id === selectedAwayPlayers[idx])?.player_name || '',
        position: idx + 1,
        match_duration: matchDurations[idx] || 6, // Use individual match duration (default 6)
      }));

      console.log('📤 Sending matchups:', {
        count: matchupsToSave.length,
        created_by: user!.uid,
        firstMatchup: matchupsToSave[0]
      });

      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: matchupsToSave,
          created_by: user!.uid,
          allow_overwrite: false, // Don't allow overwrite - first come first served
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error:', errorData);
        
        // Handle race condition - opponent created fixture first
        if (response.status === 409 && errorData.error === 'MATCHUPS_ALREADY_EXIST') {
          showAlert({
            type: 'warning',
            title: 'Fixture Already Created',
            message: 'The opponent has already created the fixture. Refreshing to show their matchups...'
          });
          
          // Refresh page after 2 seconds to show the created matchups
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }
        
        throw new Error(errorData.details || errorData.error || 'Failed to create matchups');
      }

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Matchups created successfully from starting XI!'
      });
      window.location.reload();
    } catch (error: any) {
      console.error('Error creating matchups:', error);
      showAlert({
        type: 'error',
        title: 'Creation Failed',
        message: error.message || 'Failed to create matchups'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwapOpponents = async (position1: number, position2: number) => {
    const newMatchups = [...matchups];
    const temp = newMatchups[position1].away_player_id;
    const tempName = newMatchups[position1].away_player_name;
    
    newMatchups[position1].away_player_id = newMatchups[position2].away_player_id;
    newMatchups[position1].away_player_name = newMatchups[position2].away_player_name;
    newMatchups[position2].away_player_id = temp;
    newMatchups[position2].away_player_name = tempName;

    try {
      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: newMatchups,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to swap opponents');
      }

      setMatchups(newMatchups);
      showAlert({
        type: 'success',
        title: 'Swapped',
        message: 'Opponents swapped successfully!'
      });
    } catch (error) {
      console.error('Error swapping opponents:', error);
      showAlert({
        type: 'error',
        title: 'Swap Failed',
        message: 'Failed to swap opponents'
      });
    }
  };
  
  const handleSwapMatchups = async (index1: number, index2: number) => {
    setIsSaving(true);
    try {
      const newMatchups = [...matchups];
      
      // Swap away players
      const tempAwayId = newMatchups[index1].away_player_id;
      const tempAwayName = newMatchups[index1].away_player_name;
      
      newMatchups[index1].away_player_id = newMatchups[index2].away_player_id;
      newMatchups[index1].away_player_name = newMatchups[index2].away_player_name;
      newMatchups[index2].away_player_id = tempAwayId;
      newMatchups[index2].away_player_name = tempAwayName;
      
      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchups: newMatchups }),
      });
      
      if (!response.ok) throw new Error('Failed to swap matchups');
      
      setMatchups(newMatchups);
      setSwapMode(false);
      setSwapFirstIndex(null);
      
      showAlert({
        type: 'success',
        title: 'Swapped!',
        message: 'Matchups swapped successfully!'
      });
    } catch (error) {
      console.error('Error swapping:', error);
      showAlert({
        type: 'error',
        title: 'Swap Failed',
        message: 'Failed to swap matchups'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSubstitution = async () => {
    if (subMatchupIndex === null || !subSide || !subNewPlayerId) return;
    
    const matchup = matchups[subMatchupIndex];
    const isHome = subSide === 'home';
    const currentPlayerId = isHome ? matchup.home_player_id : matchup.away_player_id;
    const currentPlayerName = isHome ? matchup.home_player_name : matchup.away_player_name;
    
    // Get new player details
    const playersList = isHome ? homePlayers : awayPlayers;
    const newPlayer = playersList.find(p => p.player_id === subNewPlayerId);
    if (!newPlayer) {
      showAlert({
        type: 'error',
        title: 'Player Not Found',
        message: 'Selected player not found'
      });
      return;
    }
    
    // Get category as number (1=legend/best, 2=classic/mid, 3=default)
    const getCategoryValue = (player: any): number => {
      // Check category_id first (primary field)
      if (player.category_id === 'legend') return 1;
      if (player.category_id === 'classic') return 2;
      
      // Fallback to category field
      if (typeof player.category === 'number') return player.category;
      if (player.category === 'legend') return 1;
      if (player.category === 'classic') return 2;
      
      // Check category_name as last resort
      if (player.category_name?.toLowerCase().includes('legend')) return 1;
      if (player.category_name?.toLowerCase().includes('classic')) return 2;
      
      return 3; // default
    };
    
    // Use the penalty amount entered by the team (stored in subPenaltyAmount state)
    const totalPenalty = subPenaltyAmount;
    
    // No separate confirm modal - button in main modal handles confirmation
    setIsSaving(true);
    try {
      const newMatchups = [...matchups];
      if (isHome) {
        newMatchups[subMatchupIndex].home_original_player_id = currentPlayerId;
        newMatchups[subMatchupIndex].home_original_player_name = currentPlayerName;
        newMatchups[subMatchupIndex].home_player_id = subNewPlayerId;
        newMatchups[subMatchupIndex].home_player_name = newPlayer.player_name;
        newMatchups[subMatchupIndex].home_substituted = true;
        newMatchups[subMatchupIndex].home_sub_penalty = totalPenalty;
      } else {
        newMatchups[subMatchupIndex].away_original_player_id = currentPlayerId;
        newMatchups[subMatchupIndex].away_original_player_name = currentPlayerName;
        newMatchups[subMatchupIndex].away_player_id = subNewPlayerId;
        newMatchups[subMatchupIndex].away_player_name = newPlayer.player_name;
        newMatchups[subMatchupIndex].away_substituted = true;
        newMatchups[subMatchupIndex].away_sub_penalty = totalPenalty;
      }
      
      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchups: newMatchups }),
      });
      
      if (!response.ok) throw new Error('Failed to substitute');
      
      setMatchups(newMatchups);
      setIsSubModalOpen(false);
      setSubMatchupIndex(null);
      setSubSide(null);
      setSubNewPlayerId('');
      
      showAlert({
        type: 'success',
        title: 'Substitution Complete',
        message: `${newPlayer.player_name} substituted in successfully!\n+${totalPenalty} penalty goals awarded to opponent.`
      });
    } catch (error) {
      console.error('Error substituting:', error);
      showAlert({
        type: 'error',
        title: 'Substitution Failed',
        message: 'Failed to substitute player'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fixture...</p>
        </div>
      </div>
    );
  }

  if (!user || !fixture) {
    return null;
  }

  const getPhaseInfo = () => {
    switch (phase) {
      case 'draft':
        return {
          label: 'Draft Mode',
          color: 'yellow',
          description: 'Match not scheduled yet. You can prepare and save draft lineups.',
        };
      case 'home_fixture':
        return {
          label: 'Home Fixture Phase',
          color: 'blue',
          description: 'Both teams can set their lineup',
        };
      case 'fixture_entry':
        return {
          label: 'Fixture Entry Phase',
          color: 'purple',
          description: 'Both teams can set their lineup until submission',
        };
      case 'result_entry':
        return {
          label: 'Result Entry Phase',
          color: 'green',
          description: 'Lineups locked, enter match results',
        };
      case 'closed':
        return {
          label: 'Closed',
          color: 'gray',
          description: 'This fixture is closed',
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-7xl">
        {/* Lineup Deadline Monitor */}
        {roundDeadlines && roundDeadlines.scheduled_date && roundDeadlines.round_start_time && (
          <div className="mb-6">
            <LineupDeadlineMonitor
              seasonId={fixture.season_id}
              roundNumber={fixture.round_number}
              leg={fixture.leg}
              scheduledDate={roundDeadlines.scheduled_date}
              awayDeadlineTime={roundDeadlines.round_start_time}
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/dashboard/team/matches"
            className="group inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-700 hover:text-indigo-600 mb-4 sm:mb-6 font-medium transition-all rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-indigo-300"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm sm:text-base">Back to Matches</span>
          </Link>

          <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 p-5 sm:p-8 overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-30 -z-10"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-cyan-100 to-blue-100 rounded-full blur-3xl opacity-30 -z-10"></div>
            {/* Title and Phase Badge */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
                      Round {fixture.round_number}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {fixture.leg === 'first' ? '1st' : '2nd'} Leg
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                        Match #{fixture.match_number}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg whitespace-nowrap ${
                  phaseInfo.color === 'yellow' ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white' :
                  phaseInfo.color === 'blue' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
                  phaseInfo.color === 'purple' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
                  phaseInfo.color === 'green' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                  'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                }`}>
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  {phaseInfo.label}
                </span>
              </div>
            </div>

            {/* Teams VS */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-center mb-6 sm:mb-8">
              {/* Home Team */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 sm:p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Home Team</div>
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                        {fixture.home_team_name}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VS Badge */}
              <div className="flex justify-center items-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-xl sm:text-2xl font-black shadow-2xl transform group-hover:scale-110 transition-transform">
                    <span className="animate-pulse">VS</span>
                  </div>
                </div>
              </div>

              {/* Away Team */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-5 sm:p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">Away Team</div>
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                        {fixture.away_team_name}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phase Info & Deadlines */}
            <div className="relative overflow-hidden p-4 sm:p-5 bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-xl sm:rounded-2xl border border-indigo-100 shadow-inner">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full blur-2xl opacity-20"></div>
              <div className="relative flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm sm:text-base text-gray-800 font-semibold mb-2">{phaseInfo.description}</p>
              {roundDeadlines && lineupDeadline && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <span>Match: {roundDeadlines.scheduled_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span>Lineup Deadline: {lineupDeadline.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST</span>
                  </div>
                </div>
              )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lineup Submission Section */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 p-5 sm:p-8 overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-20 -z-10"></div>
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-purple-900 bg-clip-text text-transparent">Team Lineups</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Submit your starting XI and substitutes</p>
              </div>
            </div>
          </div>

          {/* Lineup Deadline Info */}
          {lineupDeadline && (() => {
            const now = new Date();
            const homeDeadline = roundDeadlines && roundDeadlines.scheduled_date 
              ? new Date(`${roundDeadlines.scheduled_date}T${roundDeadlines.home_fixture_deadline_time}:00+05:30`)
              : null;
            const awayDeadline = roundDeadlines && roundDeadlines.scheduled_date 
              ? new Date(`${roundDeadlines.scheduled_date}T${roundDeadlines.away_fixture_deadline_time}:00+05:30`)
              : null;
            
            // Home team can edit until home deadline
            const canHomeEdit = isHomeTeam && homeDeadline && now < homeDeadline;
            
            // After home deadline, if no matchups exist, both teams can edit until away deadline
            const inFixtureEntryPhase = homeDeadline && awayDeadline && now >= homeDeadline && now < awayDeadline;
            const canEditDuringFixtureEntry = inFixtureEntryPhase && matchups.length === 0;
            
            const isOpen = canSubmitLineup || canHomeEdit || canEditDuringFixtureEntry;
            
            return (
              <div className={`mb-4 p-4 rounded-xl border-2 ${
                isOpen 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className={`w-5 h-5 ${
                    isOpen ? 'text-green-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-sm font-semibold ${
                    isOpen ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {isOpen ? '✓ Lineup Submission Open' : '⏰ Lineup Submission Closed'}
                  </span>
                </div>
                <p className="text-xs text-gray-700">
                  {canEditDuringFixtureEntry
                    ? `⚡ Both teams can edit lineup & create fixture until: ${awayDeadline?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' })} IST (First to submit wins!)`
                    : canHomeEdit && !canSubmitLineup
                    ? `🏠 Home team can edit until: ${homeDeadline?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' })} IST`
                    : matchups.length > 0 && !canSubmitLineup
                    ? '🔒 Lineups locked: Matchups have been created'
                    : `Deadline: ${lineupDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' })} IST (Round start time)`
                  }
                </p>
              </div>
            );
          })()}

          {/* Lineup Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Home Team Lineup Status */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              homeLineupSubmitted 
                ? 'bg-green-50 border-green-300' 
                : 'bg-gray-50 border-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-900">🏠 {fixture.home_team_name}</span>
                </div>
                {homeLineupSubmitted && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className={`text-xs font-medium ${
                homeLineupSubmitted ? 'text-green-700' : 'text-gray-600'
              }`}>
                {homeLineupSubmitted 
                  ? '✓ Lineup Submitted' 
                  : '⏳ Waiting for lineup'}
              </p>
            </div>

            {/* Away Team Lineup Status */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              awayLineupSubmitted 
                ? 'bg-green-50 border-green-300' 
                : 'bg-gray-50 border-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-900">✈️ {fixture.away_team_name}</span>
                </div>
                {awayLineupSubmitted && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className={`text-xs font-medium ${
                awayLineupSubmitted ? 'text-green-700' : 'text-gray-600'
              }`}>
                {awayLineupSubmitted 
                  ? '✓ Lineup Submitted' 
                  : '⏳ Waiting for lineup'}
              </p>
            </div>
          </div>

          {/* Submit/Edit Lineup Button */}
          {(() => {
            // Check if home team can edit (before home deadline)
            const now = new Date();
            const homeDeadline = roundDeadlines && roundDeadlines.scheduled_date 
              ? new Date(`${roundDeadlines.scheduled_date}T${roundDeadlines.home_fixture_deadline_time}:00+05:30`)
              : null;
            const awayDeadline = roundDeadlines && roundDeadlines.scheduled_date 
              ? new Date(`${roundDeadlines.scheduled_date}T${roundDeadlines.away_fixture_deadline_time}:00+05:30`)
              : null;
            
            const canHomeEdit = isHomeTeam && homeDeadline && now < homeDeadline;
            
            // After home deadline, if no matchups exist, both teams can edit until away deadline
            const inFixtureEntryPhase = homeDeadline && awayDeadline && now >= homeDeadline && now < awayDeadline;
            const canEditDuringFixtureEntry = inFixtureEntryPhase && matchups.length === 0;
            
            // Show button if: can submit OR home team can edit OR both can edit during fixture entry
            const showButton = canSubmitLineup || canHomeEdit || canEditDuringFixtureEntry;
            
            if (showButton) {
              return (
                <>
                  <Link
                    href={`/dashboard/team/fixture/${fixtureId}/lineup`}
                    className="group relative w-full px-5 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white font-bold rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 group-hover:animate-shimmer"></div>
                    <div className="relative flex items-center gap-3">
                      <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span className="text-base sm:text-lg">
                        {isHomeTeam && homeLineupSubmitted ? '✏️ Edit Your Lineup' : 
                         !isHomeTeam && awayLineupSubmitted ? '✏️ Edit Your Lineup' : 
                         '📝 Submit Your Lineup'}
                      </span>
                    </div>
                  </Link>
                  {canHomeEdit && matchups.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-orange-900">⚠️ Warning</p>
                          <p className="text-xs text-orange-700 mt-1">
                            Editing your lineup will delete the existing matchups. You'll need to recreate them after saving your changes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {canEditDuringFixtureEntry && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-blue-900">ℹ️ Fixture Entry Phase</p>
                          <p className="text-xs text-blue-700 mt-1">
                            Home team didn't create fixture. Both teams can now edit lineup and create matchups. Your changes are private until you submit. First to submit wins!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            }
            
            return (
              <div className="text-center py-4 text-gray-600">
                <p className="text-sm font-medium">
                  {matchups.length > 0 
                    ? '🔒 Lineups locked: Matchups created' 
                    : '⏰ Lineup submission deadline has passed'
                  }
                </p>
                <p className="text-xs mt-1">
                  {matchups.length > 0
                    ? 'Lineups cannot be edited once matchups are created to maintain fair play'
                    : 'Lineups are now locked for this fixture'
                  }
                </p>
              </div>
            );
          })()}
        </div>

        {/* Matchups Section */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 p-5 sm:p-8 overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full blur-3xl opacity-20 -z-10"></div>
          
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-indigo-900 bg-clip-text text-transparent">Player Matchups</h2>
                {matchups.length > 0 && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{matchups.length} matches configured</p>
                )}
              </div>
            </div>
          </div>

          {/* Create Matchups */}
          {canCreateMatchups && matchups.length === 0 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong className="font-semibold">Create Matchups:</strong> Pair each home player with an away player to set up the match
                  </p>
                </div>
              </div>


              <div className="space-y-2 sm:space-y-3">
                {homeStartingXI.map((homePlayer, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">Match #{idx + 1}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
                      {/* Home Player */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Home Player</label>
                        <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {homePlayer.player_name?.charAt(0) || '?'}
                          </div>
                          <div className="font-medium text-sm sm:text-base text-gray-900 truncate">{homePlayer.player_name}</div>
                        </div>
                      </div>

                      {/* VS Badge */}
                      <div className="hidden sm:flex justify-center">
                        <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-full px-3 py-1 text-xs font-bold shadow-md">VS</div>
                      </div>
                      <div className="sm:hidden text-center">
                        <div className="inline-block bg-gray-200 text-gray-700 rounded-full px-4 py-1 text-xs font-bold">VS</div>
                      </div>

                      {/* Away Player */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Away Player</label>
                        <select
                          value={selectedAwayPlayers[idx] || ''}
                          onChange={(e) => setSelectedAwayPlayers({ ...selectedAwayPlayers, [idx]: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                          required
                        >
                          <option value="">Select player...</option>
                          {awayStartingXI
                            .filter(p => !Object.values(selectedAwayPlayers).includes(p.player_id) || selectedAwayPlayers[idx] === p.player_id)
                            .map(player => (
                              <option key={player.player_id} value={player.player_id}>
                                {player.player_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Match Duration for this matchup */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        eFootball Match Duration
                      </label>
                      <select
                        value={matchDurations[idx] || 6}
                        onChange={(e) => setMatchDurations({ ...matchDurations, [idx]: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                      >
                        <option value={6}>6 minutes (3 min per half)</option>
                        <option value={7}>7 minutes (3.5 min per half)</option>
                        <option value={8}>8 minutes (4 min per half)</option>
                        <option value={9}>9 minutes (4.5 min per half)</option>
                        <option value={10}>10 minutes (5 min per half)</option>
                        <option value={11}>11 minutes (5.5 min per half)</option>
                        <option value={12}>12 minutes (6 min per half)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateMatchups}
                disabled={isSaving}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Matchups'
                )}
              </button>
            </div>
          )}

        {/* Display/Edit Existing Matchups */}
        {matchups.length > 0 && (
          <div className="space-y-4">
            
            {/* Share Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WhatsApp Share Button */}
              <button
                onClick={handleWhatsAppShare}
                className="group relative px-5 py-4 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white font-bold rounded-2xl hover:from-green-600 hover:via-green-700 hover:to-emerald-700 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 group-hover:animate-shimmer"></div>
                <div className="relative flex items-center gap-3">
                  <svg className="w-6 h-6 group-hover:rotate-12 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span className="text-base sm:text-lg">Share</span>
                </div>
              </button>

              {/* Copy to Clipboard Button */}
              <button
                onClick={() => {
                  const text = generateWhatsAppText();
                  navigator.clipboard.writeText(text).then(() => {
                    showAlert({
                      type: 'success',
                      title: 'Copied!',
                      message: 'Match details copied to clipboard'
                    });
                  }).catch(() => {
                    showAlert({
                      type: 'error',
                      title: 'Copy Failed',
                      message: 'Failed to copy to clipboard'
                    });
                  });
                }}
                className="group relative px-5 py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 group-hover:animate-shimmer"></div>
                <div className="relative flex items-center gap-3">
                  <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-base sm:text-lg">Copy</span>
                </div>
              </button>
            </div>
            
            {/* Edit Button */}
            {canEditMatchups && !isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="group relative w-full px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 group-hover:animate-shimmer"></div>
                <div className="relative flex items-center gap-3">
                  <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-base sm:text-lg">Edit Matchups</span>
                </div>
              </button>
            )}

            {canEditMatchups && isEditMode ? (
              // Edit Mode
              <>
                <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-300 rounded-2xl p-5 mb-4 shadow-lg">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full blur-2xl opacity-30"></div>
                  <div className="relative flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">📝 Edit Mode Active</p>
                      <p className="text-xs text-blue-700">Change away player assignments and match durations</p>
                    </div>
                  </div>
                </div>

                {matchups.map((matchup, idx) => (
                  <div key={idx} className="group relative p-5 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl space-y-4 hover:shadow-xl hover:border-indigo-300 transition-all">
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                        Match #{matchup.position}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Home Player */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Home Player</label>
                        <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                          <div className="font-medium text-gray-900">{matchup.home_player_name}</div>
                        </div>
                      </div>

                      {/* VS */}
                      <div className="flex justify-center">
                        <div className="bg-gray-300 rounded-full px-3 py-1 text-xs font-medium text-gray-700">vs</div>
                      </div>

                      {/* Away Player Dropdown */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Away Player</label>
                        <select
                          value={matchup.away_player_id || ''}
                          onChange={(e) => {
                            const newMatchups = [...matchups];
                            if (e.target.value === '') {
                              // Deselect player
                              newMatchups[idx].away_player_id = '';
                              newMatchups[idx].away_player_name = '';
                            } else {
                              const selectedPlayer = awayStartingXI.find(p => p.player_id === e.target.value);
                              newMatchups[idx].away_player_id = e.target.value;
                              newMatchups[idx].away_player_name = selectedPlayer?.player_name || '';
                            }
                            setMatchups(newMatchups);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Select Player --</option>
                          {awayStartingXI
                            .filter(player => {
                              // Show this player if:
                              // 1. Not selected in any other matchup, OR
                              // 2. Selected in THIS matchup (current idx)
                              const isSelectedElsewhere = matchups.some((m, i) => 
                                i !== idx && m.away_player_id === player.player_id
                              );
                              return !isSelectedElsewhere;
                            })
                            .map(player => (
                              <option key={player.player_id} value={player.player_id}>
                                {player.player_name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Position */}
                      <div className="text-center">
                        <span className="text-xs text-gray-500">Match #{matchup.position}</span>
                      </div>
                    </div>
                    
                    {/* Match Duration */}
                    <div className="pt-3 border-t border-gray-200">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        eFootball Match Duration
                      </label>
                      <select
                        value={matchup.match_duration ?? 6}
                        onChange={(e) => {
                          const newMatchups = [...matchups];
                          newMatchups[idx].match_duration = Number(e.target.value);
                          setMatchups(newMatchups);
                        }}
                        className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                      >
                        <option value={6}>6 minutes (3 min per half)</option>
                        <option value={7}>7 minutes (3.5 min per half)</option>
                        <option value={8}>8 minutes (4 min per half)</option>
                        <option value={9}>9 minutes (4.5 min per half)</option>
                        <option value={10}>10 minutes (5 min per half)</option>
                        <option value={11}>11 minutes (5.5 min per half)</option>
                        <option value={12}>12 minutes (6 min per half)</option>
                      </select>
                    </div>
                  </div>
                ))}

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditMode(false)}
                    disabled={isSaving}
                    className="flex-1 px-5 py-3.5 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 font-bold rounded-xl hover:from-gray-300 hover:to-gray-400 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </span>
                  </button>
                  <button
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ matchups }),
                        });
                        if (!response.ok) throw new Error('Failed to update matchups');
                        showAlert({
                          type: 'success',
                          title: 'Updated',
                          message: 'Matchups updated successfully!'
                        });
                        setIsEditMode(false);
                        window.location.reload();
                      } catch (error) {
                        console.error('Error updating matchups:', error);
                        showAlert({
                          type: 'error',
                          title: 'Update Failed',
                          message: 'Failed to update matchups'
                        });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="flex-1 px-5 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isSaving ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </>
            ) : phase === 'result_entry' && !isResultMode ? (
              // View Mode with Results + Enter Results Button
              <div className="space-y-4">
                {/* Team Totals & Winner */}
                {matchups.some(m => m.home_goals !== null) && (() => {
                  // Calculate player goals from matchups
                  const homePlayerGoals = matchups.reduce((sum, m) => sum + (m.home_goals ?? 0), 0);
                  const awayPlayerGoals = matchups.reduce((sum, m) => sum + (m.away_goals ?? 0), 0);
                  
                  // Calculate substitution penalties (awarded TO opponent)
                  const homeSubPenalties = matchups.reduce((sum, m) => sum + (m.home_sub_penalty ?? 0), 0);
                  const awaySubPenalties = matchups.reduce((sum, m) => sum + (m.away_sub_penalty ?? 0), 0);
                  
                  // Total goals including all penalties
                  const homeTotalGoals = homePlayerGoals + awaySubPenalties + homePenaltyGoals;
                  const awayTotalGoals = awayPlayerGoals + homeSubPenalties + awayPenaltyGoals;
                  
                  const winner = homeTotalGoals > awayTotalGoals ? 'home' : awayTotalGoals > homeTotalGoals ? 'away' : 'draw';

                  return (
                    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-2 border-blue-300 rounded-2xl p-4 sm:p-6 shadow-xl">
                      <h3 className="text-center text-sm font-semibold text-gray-600 mb-4">Match Result</h3>
                      <div className="grid grid-cols-3 gap-4 items-center mb-4">
                        {/* Home Total */}
                        <div className={`text-center p-4 rounded-xl ${
                          winner === 'home' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-white text-gray-700'
                        } transition-all`}>
                          <div className="text-xs sm:text-sm font-medium mb-1">{fixture.home_team_name}</div>
                          <div className="text-3xl sm:text-4xl font-bold">{homeTotalGoals}</div>
                          {winner === 'home' && <div className="text-xs mt-1 font-semibold">✓ WINNER</div>}
                          {/* Breakdown */}
                          {(awaySubPenalties > 0 || homePenaltyGoals > 0) && (
                            <div className="text-xs mt-2 opacity-90">
                              ({homePlayerGoals}
                              {awaySubPenalties > 0 && ` +${awaySubPenalties}s`}
                              {homePenaltyGoals > 0 && ` +${homePenaltyGoals}f`})
                            </div>
                          )}
                        </div>

                        {/* VS or Draw */}
                        <div className="text-center">
                          {winner === 'draw' ? (
                            <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                              DRAW
                            </div>
                          ) : (
                            <div className="text-2xl font-bold text-gray-400">-</div>
                          )}
                        </div>

                        {/* Away Total */}
                        <div className={`text-center p-4 rounded-xl ${
                          winner === 'away' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-white text-gray-700'
                        } transition-all`}>
                          <div className="text-xs sm:text-sm font-medium mb-1">{fixture.away_team_name}</div>
                          <div className="text-3xl sm:text-4xl font-bold">{awayTotalGoals}</div>
                          {winner === 'away' && <div className="text-xs mt-1 font-semibold">✓ WINNER</div>}
                          {/* Breakdown */}
                          {(homeSubPenalties > 0 || awayPenaltyGoals > 0) && (
                            <div className="text-xs mt-2 opacity-90">
                              ({awayPlayerGoals}
                              {homeSubPenalties > 0 && ` +${homeSubPenalties}s`}
                              {awayPenaltyGoals > 0 && ` +${awayPenaltyGoals}f`})
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Legend */}
                      {(homeSubPenalties > 0 || awaySubPenalties > 0 || homePenaltyGoals > 0 || awayPenaltyGoals > 0) && (
                        <div className="text-center text-xs text-gray-600 pt-2 border-t border-gray-300">
                          s = sub penalty, f = fine
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Man of the Match Display */}
                {fixture.motm_player_name && (
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <div>
                        <div className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Man of the Match</div>
                        <div className="text-lg font-bold text-yellow-900">{fixture.motm_player_name}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {matchups.map((matchup, idx) => {
                    const hasResult = matchup.home_goals !== null && matchup.away_goals !== null;
                    const homeWon = hasResult && matchup.home_goals! > matchup.away_goals!;
                    const awayWon = hasResult && matchup.away_goals! > matchup.home_goals!;
                    const isDraw = hasResult && matchup.home_goals === matchup.away_goals;
                    const isPOTD = fixture.motm_player_id && (fixture.motm_player_id === matchup.home_player_id || fixture.motm_player_id === matchup.away_player_id);
                    const homePOTD = fixture.motm_player_id === matchup.home_player_id;
                    const awayPOTD = fixture.motm_player_id === matchup.away_player_id;
                    
                    return (
                      <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${
                        isPOTD ? 'bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 border-yellow-400 shadow-lg' : 'bg-gradient-to-br from-gray-50 to-white border-gray-200'
                      }`}>
                        {/* Match Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 bg-gray-800 text-white text-xs font-bold rounded-lg">
                              Match #{matchup.position}
                            </span>
                            {matchup.match_duration && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-md">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {matchup.match_duration} min
                              </span>
                            )}
                          </div>
                          {isPOTD && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold shadow-md">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              MOTM
                            </div>
                          )}
                        </div>

                        {/* Substitution Warnings */}
                        {(matchup.home_substituted || matchup.away_substituted) && (
                          <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div className="flex-1 text-xs">
                                <p className="font-semibold text-orange-900 mb-1">⚠️ Substitution Penalties Applied</p>
                                {matchup.home_substituted && (
                                  <p className="text-orange-700 mb-0.5">
                                    🔁 Home: {matchup.home_original_player_name} → {matchup.home_player_name} 
                                    <span className="font-bold ml-1">(+{matchup.home_sub_penalty || 0} goals to {fixture.away_team_name})</span>
                                  </p>
                                )}
                                {matchup.away_substituted && (
                                  <p className="text-orange-700">
                                    🔁 Away: {matchup.away_original_player_name} → {matchup.away_player_name}
                                    <span className="font-bold ml-1">(+{matchup.away_sub_penalty || 0} goals to {fixture.home_team_name})</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Main Matchup Display */}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
                          {/* Home Player */}
                          <div className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all ${
                            homePOTD ? 'bg-gradient-to-br from-yellow-200 to-yellow-300 border-yellow-500 shadow-md' :
                            homeWon ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-400' :
                            isDraw ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300' :
                            awayWon ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' :
                            'bg-white border-gray-200'
                          }`}>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                {homePOTD && (
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                )}
                                <p className="text-xs font-medium text-gray-600">🏠 <span className="hidden sm:inline">{fixture.home_team_name}</span><span className="sm:hidden">Home</span></p>
                              </div>
                              <p className={`font-bold mb-1 sm:mb-2 text-xs sm:text-sm ${
                                homePOTD ? 'text-yellow-900 sm:text-base' : 'text-gray-900'
                              }`}>{matchup.home_player_name}</p>
                              {hasResult && (
                                <div className="space-y-1">
                                  <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full font-bold text-xs sm:text-sm ${
                                    homeWon ? 'bg-green-500 text-white' :
                                    isDraw ? 'bg-gray-400 text-white' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {homeWon ? '✓' : isDraw ? '◆' : '✗'}
                                    <span className="ml-0.5">{matchup.home_goals}<span className="hidden sm:inline"> goal{matchup.home_goals !== 1 ? 's' : ''}</span></span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {homeWon ? '🎉 Won' : isDraw ? '🤝 Draw' : '❌ Lost'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Score Badge */}
                          <div className="flex flex-col items-center gap-1 sm:gap-2 order-first sm:order-none">
                            {hasResult ? (
                              <>
                                <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-base sm:text-lg shadow-md ${
                                  isDraw ? 'bg-yellow-400 text-yellow-900' :
                                  'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                                }`}>
                                  {matchup.home_goals} - {matchup.away_goals}
                                </div>
                                {!isDraw && (
                                  <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-gray-600">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                                    </svg>
                                    {matchup.home_player_name} {homeWon ? 'beat' : 'lost to'} {matchup.away_player_name}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="bg-gray-200 text-gray-600 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium">VS</div>
                            )}
                          </div>

                          {/* Away Player */}
                          <div className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all ${
                            awayPOTD ? 'bg-gradient-to-br from-yellow-200 to-yellow-300 border-yellow-500 shadow-md' :
                            awayWon ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-400' :
                            isDraw ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300' :
                            homeWon ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' :
                            'bg-white border-gray-200'
                          }`}>
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 mb-1">
                                {awayPOTD && (
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                )}
                                <p className="text-xs font-medium text-gray-600">✈️ <span className="hidden sm:inline">{fixture.away_team_name}</span><span className="sm:hidden">Away</span></p>
                              </div>
                              <p className={`font-bold mb-1 sm:mb-2 text-xs sm:text-sm ${
                                awayPOTD ? 'text-yellow-900 sm:text-base' : 'text-gray-900'
                              }`}>{matchup.away_player_name}</p>
                              {hasResult && (
                                <div className="space-y-1">
                                  <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full font-bold text-xs sm:text-sm ${
                                    awayWon ? 'bg-green-500 text-white' :
                                    isDraw ? 'bg-gray-400 text-white' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {awayWon ? '✓' : isDraw ? '◆' : '✗'}
                                    <span className="ml-0.5">{matchup.away_goals}<span className="hidden sm:inline"> goal{matchup.away_goals !== 1 ? 's' : ''}</span></span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {awayWon ? '🎉 Won' : isDraw ? '🤝 Draw' : '❌ Lost'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Match Stats Summary - Hidden on mobile */}
                        {hasResult && (
                          <div className="hidden sm:block mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span><strong>Goal Diff:</strong> {matchup.home_player_name} {matchup.home_goals! > matchup.away_goals! ? '+' : ''}{matchup.home_goals! - matchup.away_goals!}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span><strong>Goal Diff:</strong> {matchup.away_player_name} {matchup.away_goals! > matchup.home_goals! ? '+' : ''}{matchup.away_goals! - matchup.home_goals!}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Enter/Edit Results Button - Only visible during result_entry phase */}
                {phase === 'result_entry' && (
                  <button
                    onClick={() => {
                      // Initialize results from existing data
                      const initialResults: any = {};
                      matchups.forEach((m, idx) => {
                        initialResults[idx] = {
                          home_goals: m.home_goals ?? 0,
                          away_goals: m.away_goals ?? 0
                        };
                      });
                      setMatchResults(initialResults);
                      setMotmPlayerId(fixture.motm_player_id || null);
                      setIsResultMode(true);
                    }}
                    className="group relative w-full px-5 py-4 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white font-bold rounded-2xl hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 group-hover:animate-shimmer"></div>
                    <div className="relative flex items-center gap-3">
                      <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="text-base sm:text-lg">{matchups.some(m => m.home_goals !== null) ? '✏️ Edit Results' : '✅ Enter Results'}</span>
                    </div>
                  </button>
                )}

                {/* Deadline Passed Message */}
                {phase === 'closed' && matchups.some(m => m.home_goals !== null) && (
                  <div className="p-4 bg-gray-100 border-2 border-gray-300 rounded-xl text-center">
                    <p className="text-sm font-semibold text-gray-700">🔒 Result entry period has ended</p>
                    <p className="text-xs text-gray-600 mt-1">Results cannot be modified after the deadline</p>
                  </div>
                )}

                {/* WhatsApp Share Button (with results) */}
                {matchups.some(m => m.home_goals !== null) && (
                  <button
                    onClick={handleWhatsAppShare}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    Share Results on WhatsApp
                  </button>
                )}
              </div>
            ) : phase === 'result_entry' && isResultMode ? (
              // Result Entry Mode
              <div className="space-y-4">
                <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-2 border-green-300 rounded-2xl p-5 shadow-lg">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200 to-teal-200 rounded-full blur-2xl opacity-30"></div>
                  <div className="relative flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-900 mb-1">⚽ Result Entry Mode</p>
                      <p className="text-xs text-green-700">Enter goals scored by each player and select Man of the Match</p>
                    </div>
                  </div>
                </div>

                {/* Live Team Totals Preview */}
                {(() => {
                  const homePlayerGoals = Object.values(matchResults).reduce((sum: number, m: any) => sum + (m?.home_goals ?? 0), 0);
                  const awayPlayerGoals = Object.values(matchResults).reduce((sum: number, m: any) => sum + (m?.away_goals ?? 0), 0);
                  
                  // Calculate sub penalties
                  const homeSubPenalties = matchups.reduce((sum, m) => sum + (m.home_sub_penalty ?? 0), 0);
                  const awaySubPenalties = matchups.reduce((sum, m) => sum + (m.away_sub_penalty ?? 0), 0);
                  
                  // Total including penalties
                  const homeTotalGoals = homePlayerGoals + awaySubPenalties + homePenaltyGoals;
                  const awayTotalGoals = awayPlayerGoals + homeSubPenalties + awayPenaltyGoals;
                  const winner = homeTotalGoals > awayTotalGoals ? 'home' : awayTotalGoals > homeTotalGoals ? 'away' : 'draw';

                  return (
                    <div className="bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300 rounded-xl p-4">
                      <div className="text-center text-xs font-semibold text-gray-600 mb-2">Current Score</div>
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">{fixture.home_team_name}</div>
                          <div className={`text-2xl font-bold ${
                            winner === 'home' ? 'text-green-600' : 'text-gray-700'
                          }`}>{homeTotalGoals}</div>
                          {(awaySubPenalties > 0 || homePenaltyGoals > 0) && (
                            <div className="text-xs text-gray-500 mt-1">
                              ({homePlayerGoals}
                              {awaySubPenalties > 0 && ` +${awaySubPenalties}s`}
                              {homePenaltyGoals > 0 && ` +${homePenaltyGoals}f`})
                            </div>
                          )}
                        </div>
                        <div className="text-center text-gray-400 font-bold">-</div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">{fixture.away_team_name}</div>
                          <div className={`text-2xl font-bold ${
                            winner === 'away' ? 'text-green-600' : 'text-gray-700'
                          }`}>{awayTotalGoals}</div>
                          {(homeSubPenalties > 0 || awayPenaltyGoals > 0) && (
                            <div className="text-xs text-gray-500 mt-1">
                              ({awayPlayerGoals}
                              {homeSubPenalties > 0 && ` +${homeSubPenalties}s`}
                              {awayPenaltyGoals > 0 && ` +${awayPenaltyGoals}f`})
                            </div>
                          )}
                        </div>
                      </div>
                      {winner === 'draw' && (
                        <div className="text-center mt-2">
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full font-semibold">Draw</span>
                        </div>
                      )}
                      <div className="text-center mt-2 text-xs text-gray-500">
                        s = sub penalty, f = fine
                      </div>
                    </div>
                  );
                })()}

                {/* Swap Mode Toggle */}
                <div className="relative overflow-hidden mb-4 p-4 bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-2 border-cyan-300 rounded-2xl shadow-lg">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-200 to-blue-200 rounded-full blur-2xl opacity-20"></div>
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">
                          {swapMode ? '🔄 Swap Mode Active' : 'Swap Matchups'}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {swapMode ? 'Click two matchups to swap away players' : 'Rearrange player matchups'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSwapMode(!swapMode);
                        setSwapFirstIndex(null);
                      }}
                      className={`px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg whitespace-nowrap ${
                        swapMode 
                          ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white' 
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white'
                      }`}
                    >
                      {swapMode ? '❌ Cancel' : '🔄 Enable'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {matchups.map((matchup, idx) => (
                    <div 
                      key={idx} 
                      className={`bg-gradient-to-br from-gray-50 to-white border-2 rounded-xl p-4 transition-all ${
                        swapMode && swapFirstIndex === idx 
                          ? 'border-cyan-500 bg-cyan-50 shadow-lg' 
                          : swapMode 
                          ? 'border-cyan-200 hover:border-cyan-400 cursor-pointer' 
                          : 'border-gray-200'
                      }`}
                      onClick={() => {
                        if (swapMode) {
                          if (swapFirstIndex === null) {
                            setSwapFirstIndex(idx);
                          } else if (swapFirstIndex === idx) {
                            setSwapFirstIndex(null);
                          } else {
                            handleSwapMatchups(swapFirstIndex, idx);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">
                          Match #{matchup.position}
                          {swapMode && swapFirstIndex === idx && <span className="ml-2 text-cyan-600">(Selected)</span>}
                        </span>
                        {!swapMode && (
                          <div className="flex gap-2">
                            {/* Substitute Home Button */}
                            <button
                              onClick={() => {
                                setSubMatchupIndex(idx);
                                setSubSide('home');
                                setSubNewPlayerId('');
                                setSubPenaltyAmount(2); // Reset to default
                                setIsSubModalOpen(true);
                              }}
                              className="group relative px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold rounded-lg transition-all shadow-md hover:shadow-lg overflow-hidden"
                              title="Substitute Home Player"
                            >
                              <span className="relative flex items-center gap-1">
                                <svg className="w-3 h-3 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                H
                              </span>
                            </button>
                            {/* Substitute Away Button */}
                            <button
                              onClick={() => {
                                setSubMatchupIndex(idx);
                                setSubSide('away');
                                setSubNewPlayerId('');
                                setSubPenaltyAmount(2); // Reset to default
                                setIsSubModalOpen(true);
                              }}
                              className="group relative px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-bold rounded-lg transition-all shadow-md hover:shadow-lg overflow-hidden"
                              title="Substitute Away Player"
                            >
                              <span className="relative flex items-center gap-1">
                                <svg className="w-3 h-3 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                A
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Show substitution indicator */}
                      {(matchup.home_substituted || matchup.away_substituted) && (
                        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
                          {matchup.home_substituted && (
                            <div className="text-yellow-800">
                              🔁 Home: {matchup.home_original_player_name} → {matchup.home_player_name} (+{matchup.home_sub_penalty} to away)
                            </div>
                          )}
                          {matchup.away_substituted && (
                            <div className="text-yellow-800">
                              🔁 Away: {matchup.away_original_player_name} → {matchup.away_player_name} (+{matchup.away_sub_penalty} to home)
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                        {/* Home Player Goals */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">{matchup.home_player_name}</label>
                          <input
                            type="number"
                            min="0"
                            value={matchResults[idx]?.home_goals ?? 0}
                            onChange={(e) => setMatchResults({
                              ...matchResults,
                              [idx]: {
                                ...matchResults[idx],
                                home_goals: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-4 py-3 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1 text-center">Goals</p>
                        </div>

                        {/* VS */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-400">VS</div>
                        </div>

                        {/* Away Player Goals */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">{matchup.away_player_name}</label>
                          <input
                            type="number"
                            min="0"
                            value={matchResults[idx]?.away_goals ?? 0}
                            onChange={(e) => setMatchResults({
                              ...matchResults,
                              [idx]: {
                                ...matchResults[idx],
                                away_goals: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-4 py-3 text-center text-lg font-bold border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1 text-center">Goals</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Penalty/Fine Goals Section */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-sm font-bold text-orange-900">Penalty / Fine Goals</h3>
                  </div>
                  <p className="text-xs text-orange-700 mb-3">Add extra goals for rule violations (not counted for player stats or POTM)</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {fixture.home_team_name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={homePenaltyGoals}
                        onChange={(e) => setHomePenaltyGoals(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-center text-lg font-bold border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">Fine Goals</p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {fixture.away_team_name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={awayPenaltyGoals}
                        onChange={(e) => setAwayPenaltyGoals(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-center text-lg font-bold border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">Fine Goals</p>
                    </div>
                  </div>
                </div>

                {/* Man of the Match Selector (Fixture Level) */}
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-yellow-900">
                      <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="uppercase tracking-wide">Man of the Match</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // Calculate best player based on performance
                        let bestPlayer = null;
                        let bestScore = -999;
                        
                        matchups.forEach((m, idx) => {
                          const homeGoals = matchResults[idx]?.home_goals ?? 0;
                          const awayGoals = matchResults[idx]?.away_goals ?? 0;
                          
                          // Score for home player
                          const homeWon = homeGoals > awayGoals;
                          const homeDraw = homeGoals === awayGoals;
                          const homeScore = (homeGoals * 10) + // 10 points per goal
                                          (homeWon ? 5 : 0) +    // 5 points for win
                                          (homeDraw ? 2 : 0) -   // 2 points for draw
                                          (awayGoals * 2);       // -2 per goal conceded
                          
                          // Score for away player
                          const awayWon = awayGoals > homeGoals;
                          const awayDraw = homeGoals === awayGoals;
                          const awayScore = (awayGoals * 10) +
                                          (awayWon ? 5 : 0) +
                                          (awayDraw ? 2 : 0) -
                                          (homeGoals * 2);
                          
                          if (homeScore > bestScore) {
                            bestScore = homeScore;
                            bestPlayer = {
                              id: m.home_player_id,
                              name: m.home_player_name,
                              goals: homeGoals,
                              conceded: awayGoals,
                              result: homeWon ? 'W' : homeDraw ? 'D' : 'L'
                            };
                          }
                          
                          if (awayScore > bestScore) {
                            bestScore = awayScore;
                            bestPlayer = {
                              id: m.away_player_id,
                              name: m.away_player_name,
                              goals: awayGoals,
                              conceded: homeGoals,
                              result: awayWon ? 'W' : awayDraw ? 'D' : 'L'
                            };
                          }
                        });
                        
                        if (bestPlayer) {
                          setMotmPlayerId(bestPlayer.id);
                          showAlert({
                            type: 'info',
                            title: '✨ MOTM Suggested',
                            message: `${bestPlayer.name}\n${bestPlayer.goals} goals, ${bestPlayer.conceded} conceded, Result: ${bestPlayer.result}`
                          });
                        }
                      }}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Auto-Suggest
                    </button>
                  </div>
                  
                  <select
                    value={motmPlayerId || ''}
                    onChange={(e) => setMotmPlayerId(e.target.value || null)}
                    className="w-full px-4 py-3 text-lg font-medium border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white"
                  >
                    <option value="">-- Select Player --</option>
                    <optgroup label="🏠 Home Team ({fixture.home_team_name})">
                      {matchups.map((m, idx) => {
                        const goals = matchResults[idx]?.home_goals ?? 0;
                        const conceded = matchResults[idx]?.away_goals ?? 0;
                        return (
                          <option key={`home-${idx}-${m.home_player_id}`} value={m.home_player_id}>
                            {m.home_player_name} ({goals}G, {conceded}C)
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="✈️ Away Team ({fixture.away_team_name})">
                      {matchups.map((m, idx) => {
                        const goals = matchResults[idx]?.away_goals ?? 0;
                        const conceded = matchResults[idx]?.home_goals ?? 0;
                        return (
                          <option key={`away-${idx}-${m.away_player_id}`} value={m.away_player_id}>
                            {m.away_player_name} ({goals}G, {conceded}C)
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                  
                  {motmPlayerId && (() => {
                    const selectedPlayer = matchups.find(m => m.home_player_id === motmPlayerId || m.away_player_id === motmPlayerId);
                    const idx = matchups.indexOf(selectedPlayer!);
                    const isHome = selectedPlayer?.home_player_id === motmPlayerId;
                    const goals = isHome ? (matchResults[idx]?.home_goals ?? 0) : (matchResults[idx]?.away_goals ?? 0);
                    const conceded = isHome ? (matchResults[idx]?.away_goals ?? 0) : (matchResults[idx]?.home_goals ?? 0);
                    const won = goals > conceded;
                    const draw = goals === conceded;
                    
                    return (
                      <div className="mt-3 p-3 bg-yellow-100 border border-yellow-400 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-yellow-900">
                              {isHome ? selectedPlayer?.home_player_name : selectedPlayer?.away_player_name}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              {goals} goals scored • {conceded} conceded • {won ? '✓ Won' : draw ? '◆ Draw' : '✗ Lost'}
                            </p>
                          </div>
                          <span className="text-2xl">⭐</span>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <p className="text-xs text-yellow-700 mt-2">Select or auto-suggest the best player from the entire fixture</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsResultMode(false)}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      // Validate MOTM is selected
                      if (!motmPlayerId) {
                        showAlert({
                          type: 'warning',
                          title: 'MOTM Required',
                          message: '⚠️ Please select Man of the Match before saving results!'
                        });
                        return;
                      }
                      
                      setIsSaving(true);
                      try {
                        // Save matchup results (goals only)
                        const results = matchups.map((m, idx) => ({
                          position: m.position,
                          home_goals: matchResults[idx]?.home_goals ?? 0,
                          away_goals: matchResults[idx]?.away_goals ?? 0,
                        }));

                        const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            results,
                            entered_by: user!.uid,
                          }),
                        });

                        if (!response.ok) {
                          const errorData = await response.json();
                          if (response.status === 403) {
                            // Deadline passed
                            showAlert({
                              type: 'error',
                              title: 'Deadline Passed',
                              message: `❌ ${errorData.error}. Results can no longer be submitted.`
                            });
                            setIsSaving(false);
                            setIsResultMode(false);
                            return;
                          }
                          throw new Error(errorData.error || 'Failed to save results');
                        }

                        const resultData = await response.json();
                        console.log('Result submission response:', resultData);

                        // Save MOTM and penalty goals at fixture level
                        const motmPlayerName = motmPlayerId ? 
                          matchups.find(m => m.home_player_id === motmPlayerId)?.home_player_name ||
                          matchups.find(m => m.away_player_id === motmPlayerId)?.away_player_name || null
                          : null;

                        console.log('Saving MOTM and penalty goals:', { motmPlayerId, motmPlayerName, homePenaltyGoals, awayPenaltyGoals });

                        const motmResponse = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            motm_player_id: motmPlayerId,
                            motm_player_name: motmPlayerName,
                            home_penalty_goals: homePenaltyGoals,
                            away_penalty_goals: awayPenaltyGoals,
                          }),
                        });

                        if (!motmResponse.ok) {
                          const errorData = await motmResponse.json();
                          if (motmResponse.status === 403) {
                            // Deadline passed for MOTM as well
                            console.error('MOTM deadline passed:', errorData);
                            showAlert({
                              type: 'error',
                              title: 'Deadline Passed',
                              message: `❌ ${errorData.error}. MOTM can no longer be saved.`
                            });
                            setIsSaving(false);
                            setIsResultMode(false);
                            return;
                          }
                          console.error('Failed to save MOTM:', errorData);
                          showAlert({
                            type: 'warning',
                            title: 'MOTM Warning',
                            message: `Warning: MOTM not saved - ${errorData.error || 'Unknown error'}`
                          });
                        } else {
                          console.log('MOTM saved successfully:', motmPlayerName);
                        }

                        // Update player points and star ratings
                        const pointsPayload = matchups.map((m, idx) => ({
                          position: m.position,
                          home_player_id: m.home_player_id,
                          away_player_id: m.away_player_id,
                          home_goals: matchResults[idx]?.home_goals ?? 0,
                          away_goals: matchResults[idx]?.away_goals ?? 0,
                        }));
                        
                        const pointsResponse = await fetchWithTokenRefresh('/api/realplayers/update-points', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fixture_id: fixtureId,
                            season_id: fixture.season_id,
                            matchups: pointsPayload,
                          }),
                        });

                        if (pointsResponse.ok) {
                          const pointsData = await pointsResponse.json();
                          console.log('Player points updated:', pointsData.updates);
                          if (pointsData.categoryUpdate) {
                            console.log(`✅ Categories recalculated: ${pointsData.categoryUpdate.legendCount} Legend / ${pointsData.categoryUpdate.totalPlayers - pointsData.categoryUpdate.legendCount} Classic`);
                          }
                        } else {
                          const errorData = await pointsResponse.json();
                          console.error('Failed to update player points:', errorData);
                          showAlert({
                            type: 'warning',
                            title: 'Points Warning',
                            message: `Warning: Player points not updated - ${errorData.error || 'Unknown error'}`
                          });
                        }

                        // Update player stats (goals, wins/draws/losses, MOTM)
                        const statsPayload = matchups.map((m, idx) => ({
                          position: m.position,
                          home_player_id: m.home_player_id,
                          home_player_name: m.home_player_name,
                          away_player_id: m.away_player_id,
                          away_player_name: m.away_player_name,
                          home_goals: matchResults[idx]?.home_goals ?? 0,
                          away_goals: matchResults[idx]?.away_goals ?? 0,
                        }));

                        const statsResponse = await fetchWithTokenRefresh('/api/realplayers/update-stats', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            season_id: fixture.season_id,
                            fixture_id: fixtureId,
                            matchups: statsPayload,
                            motm_player_id: motmPlayerId, // Pass fixture-level MOTM
                          }),
                        });

                        if (statsResponse.ok) {
                          const statsData = await statsResponse.json();
                          console.log('Player stats updated:', statsData.updates);
                        }

                        // Update team stats (wins, draws, losses, goals)
                        const teamStatsResponse = await fetchWithTokenRefresh('/api/teamstats/update-stats', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            season_id: fixture.season_id,
                            fixture_id: fixtureId,
                            home_team_id: fixture.home_team_id,
                            away_team_id: fixture.away_team_id,
                            matchups: statsPayload,
                          }),
                        });

                        if (teamStatsResponse.ok) {
                          const teamStatsData = await teamStatsResponse.json();
                          console.log('✓ Team stats updated:', teamStatsData.updates);
                        } else {
                          const errorData = await teamStatsResponse.json();
                          console.error('❌ Team stats update failed:', errorData);
                          showAlert({
                            type: 'warning',
                            title: 'Team Stats Warning',
                            message: `⚠️ Warning: Team stats may not have been updated. Error: ${errorData.error || 'Unknown error'}`
                          });
                        }

                        // Calculate fantasy points (auto-trigger)
                        try {
                          console.log('🏆 Calculating fantasy points...');
                          const fantasyResponse = await fetchWithTokenRefresh('/api/fantasy/calculate-points', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              fixture_id: fixtureId,
                              season_id: fixture.season_id,
                              round_number: fixture.round_number,
                            }),
                          });

                          if (fantasyResponse.ok) {
                            const fantasyData = await fantasyResponse.json();
                            console.log('✅ Fantasy points calculated:', fantasyData);
                          } else {
                            console.log('ℹ️ No fantasy league active or fantasy calculation skipped');
                          }
                        } catch (fantasyError) {
                          console.error('Fantasy points calculation error (non-critical):', fantasyError);
                          // Don't show error to user - fantasy is optional
                        }

                        // Generate match result news (auto-trigger)
                        try {
                          console.log('📰 Generating match result news...');
                          const newsResponse = await fetchWithTokenRefresh('/api/news/trigger', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              event_type: 'match_result',
                              event_data: {
                                season_id: fixture.season_id,
                                fixture_id: fixtureId,
                                home_team_name: fixture.home_team_name,
                                away_team_name: fixture.away_team_name,
                                home_score: resultData.fixture.home_score,
                                away_score: resultData.fixture.away_score,
                                result: resultData.fixture.result,
                                motm_player_name: motmPlayerName,
                              }
                            }),
                          });

                          if (newsResponse.ok) {
                            const newsData = await newsResponse.json();
                            console.log('✅ Match result news generated:', newsData);
                          } else {
                            console.log('ℹ️ News generation skipped or failed');
                          }
                        } catch (newsError) {
                          console.error('News generation error (non-critical):', newsError);
                          // Don't show error to user - news is optional
                        }

                        // Record player participation from lineups (auto-trigger)
                        try {
                          console.log('📋 Recording player participation...');
                          const participationResponse = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/record-participation`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          });

                          if (participationResponse.ok) {
                            const participationData = await participationResponse.json();
                            console.log('✅ Player participation recorded:', participationData.message);
                          } else {
                            console.log('ℹ️ Player participation recording skipped');
                          }
                        } catch (participationError) {
                          console.error('Participation recording error (non-critical):', participationError);
                          // Don't show error to user - participation is optional
                        }

                        showAlert({
                          type: 'success',
                          title: 'Success!',
                          message: '✓ Results submitted successfully!\n\nFixture marked as COMPLETED.\nPlayer and team stats have been updated.'
                        });
                        
                        setIsResultMode(false);
                        window.location.reload();
                      } catch (error) {
                        console.error('Error saving results:', error);
                        showAlert({
                          type: 'error',
                          title: 'Save Failed',
                          message: 'Failed to save results'
                        });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                  >
                    {isSaving ? 'Saving...' : 'Save Results'}
                  </button>
                </div>
              </div>
            ) : (
              // View Only Mode (non result_entry phase)
              <div className="space-y-3">
                {matchups.map((matchup, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Home Player</p>
                        <p className="font-medium text-gray-900">{matchup.home_player_name}</p>
                      </div>

                      <div className="flex justify-center">
                        <div className="bg-green-100 text-green-700 rounded-full px-4 py-2 text-sm font-medium">VS</div>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Away Player</p>
                        <p className="font-medium text-gray-900">{matchup.away_player_name}</p>
                      </div>
                    </div>
                    
                    {/* Match info */}
                    <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-200">
                      <span>Match #{matchup.position}</span>
                      {matchup.match_duration && (
                        <span className="ml-2 text-green-600 font-medium">
                          ({matchup.match_duration} min)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Waiting Message */}
        {!canCreateMatchups && matchups.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-700 mb-2">Waiting for Matchups</p>
            <p className="text-xs text-gray-600">
              {!homeLineupSubmitted || !awayLineupSubmitted 
                ? '⌛ Both teams must submit their lineups before matchups can be created.'
                : phase === 'home_fixture' && 'Home team will create player matchups during this phase.'
              }
              {phase === 'fixture_entry' && homeLineupSubmitted && awayLineupSubmitted && 'First team to create matchups gets edit rights'}
              {phase === 'result_entry' && 'Matchups are finalized'}
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Substitution Modal */}
      {isSubModalOpen && subMatchupIndex !== null && subSide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">🔁 Substitute Player</h3>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Current Player:</strong> {subSide === 'home' 
                  ? matchups[subMatchupIndex].home_player_name 
                  : matchups[subMatchupIndex].away_player_name}
              </p>
              
              {/* Manual penalty input */}
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="block text-sm font-semibold text-orange-900 mb-2">
                  ⚠️ Penalty Goals (awarded to opponent)
                </label>
                <input
                  type="number"
                  min="0"
                  value={subPenaltyAmount}
                  onChange={(e) => setSubPenaltyAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-center text-lg font-bold border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter penalty amount"
                />
                <p className="text-xs text-orange-600 mt-2">
                  Enter the number of penalty goals to award to the opponent for this substitution
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Replacement Player
              </label>
              <select
                value={subNewPlayerId}
                onChange={(e) => setSubNewPlayerId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Choose Player --</option>
                {(subSide === 'home' ? homePlayers : awayPlayers)
                  .filter(player => {
                    // Filter out the current player being substituted
                    if (subMatchupIndex === null) return true;
                    const currentMatchup = matchups[subMatchupIndex];
                    const currentPlayerId = subSide === 'home' 
                      ? currentMatchup.home_player_id 
                      : currentMatchup.away_player_id;
                    return player.player_id !== currentPlayerId;
                  })
                  .map((player) => {
                  // Display category properly
                  let catDisplay = 'N/A';
                  
                  // Check various category field formats
                  if (player.category_id === 'legend' || player.category === 'legend') {
                    catDisplay = 'Legend';
                  } else if (player.category_id === 'classic' || player.category === 'classic') {
                    catDisplay = 'Classic';
                  } else if (player.category_name?.toLowerCase().includes('legend')) {
                    catDisplay = 'Legend';
                  } else if (player.category_name?.toLowerCase().includes('classic')) {
                    catDisplay = 'Classic';
                  } else if (player.category_name) {
                    catDisplay = player.category_name;
                  } else if (typeof player.category === 'number') {
                    // Map numeric categories: 1 = Legend, 2 = Classic
                    catDisplay = player.category === 1 ? 'Legend' : player.category === 2 ? 'Classic' : `Cat ${player.category}`;
                  }
                  
                  return (
                    <option key={player.player_id} value={player.player_id}>
                      {player.name || player.player_name} ({catDisplay})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubstitution}
                disabled={!subNewPlayerId || isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Substituting...' : subNewPlayerId ? 'Confirm Substitution' : 'Select Player First'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Components */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  );
}
