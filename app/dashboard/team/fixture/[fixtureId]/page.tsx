'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';

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
  motm_player_id?: string | null;
  motm_player_name?: string | null;
  // Penalty/Fine goals
  home_penalty_goals?: number;
  away_penalty_goals?: number;
}

interface RoundDeadlines {
  scheduled_date: string;
  home_fixture_deadline_time: string;
  away_fixture_deadline_time: string;
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
  const [phase, setPhase] = useState<'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed'>('closed');
  const [isLoading, setIsLoading] = useState(true);
  
  // Player data
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  
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
  
  // Swap state
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstIndex, setSwapFirstIndex] = useState<number | null>(null);
  
  // Penalty goals state
  const [homePenaltyGoals, setHomePenaltyGoals] = useState(0);
  const [awayPenaltyGoals, setAwayPenaltyGoals] = useState(0);

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

    const text = `*SS PES SUPER LEAGUE - S${seasonNumber}* ⚽

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 *MATCHDAY ${fixture.round_number}* - ${fixture.leg === 'first' ? '1st' : '2nd'} Leg

🔵 *${fixture.home_team_name}*  🆚  🔴 *${fixture.away_team_name}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *MATCHUPS:*

${matchups.map((m, idx) => {
  let line = '';
  if (hasResults && m.home_goals !== null && m.away_goals !== null) {
    line = `${idx + 1}. ${m.home_player_name} *${m.home_goals}-${m.away_goals}* ${m.away_player_name}`;
  } else {
    line = `${idx + 1}. ${m.home_player_name} vs ${m.away_player_name}`;
  }
  line += ` (${m.match_duration || 6}min)`;
  
  // Add substitution indicators
  if (m.home_substituted) {
    line += `\n   🔁 H: ${m.home_original_player_name} ➡️ ${m.home_player_name}`;
  }
  if (m.away_substituted) {
    line += `\n   🔁 A: ${m.away_original_player_name} ➡️ ${m.away_player_name}`;
  }
  
  return line;
}).join('\n\n')}

${hasSubstitutions ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 *SUBSTITUTIONS & PENALTIES:*

${substitutions.map(m => {
  let subText = [];
  if (m.home_substituted) {
    subText.push(`⚠️ Home: +${m.home_sub_penalty || 0} penalty goals awarded to ${fixture.away_team_name}`);
  }
  if (m.away_substituted) {
    subText.push(`⚠️ Away: +${m.away_sub_penalty || 0} penalty goals awarded to ${fixture.home_team_name}`);
  }
  return subText.join('\n');
}).join('\n')}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *SCORE BREAKDOWN:*

🏠 *${fixture.home_team_name}*
Total: *${hasResults ? homeTotalGoals : 0}* goals
${hasResults && (homePlayerGoals > 0 || awaySubPenalties > 0 || homePenaltyGoals > 0) ? `   • Player Goals: ${homePlayerGoals}
${awaySubPenalties > 0 ? `   • Opponent Sub Penalties: +${awaySubPenalties}\n` : ''}${homePenaltyGoals > 0 ? `   • Fine/Violation Goals: +${homePenaltyGoals}\n` : ''}` : ''}
✈️ *${fixture.away_team_name}*
Total: *${hasResults ? awayTotalGoals : 0}* goals
${hasResults && (awayPlayerGoals > 0 || homeSubPenalties > 0 || awayPenaltyGoals > 0) ? `   • Player Goals: ${awayPlayerGoals}
${homeSubPenalties > 0 ? `   • Opponent Sub Penalties: +${homeSubPenalties}\n` : ''}${awayPenaltyGoals > 0 ? `   • Fine/Violation Goals: +${awayPenaltyGoals}\n` : ''}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ *MAN OF THE MATCH*
${hasResults ? `🏅 ${motmName}` : '⏳ To be announced'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${hasResults ? `🎯 *RESULT*
${winner === 'DRAW' ? '🤝 *MATCH DRAWN*' : `🎉 *${winner} WON!*`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : `⏳ *Match yet to be played*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}

_Powered by SS Super League S${seasonNumber} Committee_ 💫`;

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

  useEffect(() => {
    const loadFixture = async () => {
      if (!user || !fixtureId) return;

      try {
        setIsLoading(true);

        // Get fixture from Neon
        const fixtureResponse = await fetch(`/api/fixtures/${fixtureId}`);
        
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

        const [roundResponse, homePlayersResponse, awayPlayersResponse, matchupsResponse] = await Promise.all([
          fetch(`/api/round-deadlines?tournament_id=${fixtureData.tournament_id}&round_number=${fixtureData.round_number}&leg=${fixtureData.leg || 'first'}`),
          fetch(`/api/player-seasons?team_id=${fixtureData.home_team_id}&season_id=${fixtureData.season_id}`),
          fetch(`/api/player-seasons?team_id=${fixtureData.away_team_id}&season_id=${fixtureData.season_id}`),
          fetch(`/api/fixtures/${fixtureId}/matchups`)
        ]);

        // Parse player responses
        let homePlayersList: any[] = [];
        let awayPlayersList: any[] = [];

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

        // Process matchups
        let matchupsList: any[] = [];
        if (matchupsResponse.ok) {
          const matchupsData = await matchupsResponse.json();
          if (matchupsData.matchups && matchupsData.matchups.length > 0) {
            matchupsList = matchupsData.matchups;
            console.log('🎮 Matchups loaded:', matchupsList.length, 'First matchup:', matchupsList[0]);
            setMatchups(matchupsList);
          }
        }
        
        // Process round deadlines and calculate phase
        if (roundResponse.ok) {
          const { roundDeadline } = await roundResponse.json();
          
          if (roundDeadline) {
            const deadlines = roundDeadline as RoundDeadlines;
            setRoundDeadlines(deadlines);

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
            resultDate.setDate(resultDate.getDate() + deadlines.result_entry_deadline_day_offset);
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

            let currentPhase: typeof phase = 'closed';
            if (now < awayDeadline) {
              // Home fixture phase lasts until away deadline
              currentPhase = 'home_fixture';
            } else if (now < resultDeadline) {
              currentPhase = 'result_entry';
            } else {
              currentPhase = 'closed';
            }

            setPhase(currentPhase);

            // Determine matchup permissions
            const matchupsExist = matchupsList.length > 0;
            const isAfterHomeDeadline = now >= homeDeadline;

            let canCreate = false;
            let canEditMatch = false;

            if (currentPhase === 'home_fixture') {
              // Home fixture phase lasts until away deadline
              if (!isAfterHomeDeadline) {
                // Before home deadline: only home can create/edit
                if (!matchupsExist) {
                  canCreate = isHome;
                } else {
                  canEditMatch = isHome;
                }
              } else {
                // After home deadline but before away deadline ("Away phase")
                if (!matchupsExist) {
                  // If no matchups exist, both teams can create
                  canCreate = true;
                } else {
                  // If matchups exist:
                  // - Home team can still edit until away deadline
                  // - Away team CANNOT edit if home created matchups
                  canEditMatch = isHome;
                }
              }
            }

            setCanCreateMatchups(canCreate);
            setCanEditMatchups(canEditMatch);
          }
        }
      } catch (error) {
        console.error('Error loading fixture:', error);
        showAlert({
          type: 'error',
          title: 'Load Failed',
          message: 'Failed to load fixture'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFixture();
  }, [user, fixtureId, router]);

  const handleCreateMatchups = async () => {
    // Check if players are loaded
    if (homePlayers.length === 0) {
      showAlert({
        type: 'error',
        title: 'No Players',
        message: 'No home players found. Please ensure players are registered for this season.'
      });
      return;
    }

    if (awayPlayers.length === 0) {
      showAlert({
        type: 'error',
        title: 'No Players',
        message: 'No away players found. Please ensure players are registered for this season.'
      });
      return;
    }

    // Validate all matchups are selected
    if (Object.keys(selectedAwayPlayers).length !== homePlayers.length) {
      showAlert({
        type: 'warning',
        title: 'Incomplete Selection',
        message: 'Please select an away player for each home player'
      });
      return;
    }

    console.log('🏠 Home players:', homePlayers.length, homePlayers[0]);
    console.log('✈️ Away players:', awayPlayers.length, awayPlayers[0]);
    console.log('🔗 Selected away players:', selectedAwayPlayers);

    setIsSaving(true);
    try {
      const matchupsToSave: Matchup[] = homePlayers.map((homePlayer, idx) => ({
        home_player_id: homePlayer.player_id,
        home_player_name: homePlayer.player_name,
        away_player_id: selectedAwayPlayers[idx],
        away_player_name: awayPlayers.find(p => p.player_id === selectedAwayPlayers[idx])?.player_name || '',
        position: idx + 1,
        match_duration: matchDurations[idx] || 6, // Use individual match duration (default 6)
      }));

      console.log('📤 Sending matchups:', {
        count: matchupsToSave.length,
        created_by: user!.uid,
        firstMatchup: matchupsToSave[0]
      });

      const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: matchupsToSave,
          created_by: user!.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to create matchups');
      }

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Matchups created successfully!'
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
      const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
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
      
      const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
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
    
    // Calculate penalty: +2 base + 1 if higher category
    const currentPlayer = playersList.find(p => p.player_id === currentPlayerId);
    const currentCategory = getCategoryValue(currentPlayer);
    const newCategory = getCategoryValue(newPlayer);
    const categoryPenalty = newCategory < currentCategory ? 1 : 0; // Lower number = higher category
    const totalPenalty = 2 + categoryPenalty;
    
    // No separate confirm modal - button in main modal handles confirmation
    setIsSaving(true);
    try {
      const newMatchups = [...matchups];
      if (isHome) {
        newMatchups[subMatchupIndex].home_original_player_id = currentPlayerId;
        newMatchups[subMatchupIndex].home_original_player_name = currentPlayerName;
        newMatchups[subMatchupIndex].home_player_id = subNewPlayerId;
        newMatchups[subMatchupIndex].home_player_name = newPlayer.name;
        newMatchups[subMatchupIndex].home_substituted = true;
        newMatchups[subMatchupIndex].home_sub_penalty = totalPenalty;
      } else {
        newMatchups[subMatchupIndex].away_original_player_id = currentPlayerId;
        newMatchups[subMatchupIndex].away_original_player_name = currentPlayerName;
        newMatchups[subMatchupIndex].away_player_id = subNewPlayerId;
        newMatchups[subMatchupIndex].away_player_name = newPlayer.name;
        newMatchups[subMatchupIndex].away_substituted = true;
        newMatchups[subMatchupIndex].away_sub_penalty = totalPenalty;
      }
      
      const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
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
        message: `${newPlayer.name} substituted in successfully!\n+${totalPenalty} penalty goals awarded to opponent.`
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
      case 'home_fixture':
        return {
          label: 'Home Fixture Phase',
          color: 'blue',
          description: 'Home team can set their lineup',
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
              {roundDeadlines && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <span>Match: {roundDeadlines.scheduled_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span>Home: {roundDeadlines.home_fixture_deadline_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span>Away: {roundDeadlines.away_fixture_deadline_time}</span>
                  </div>
                </div>
              )}
                </div>
              </div>
            </div>
          </div>
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
                {homePlayers.map((homePlayer, idx) => (
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
                          {awayPlayers
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
            
            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="group relative w-full px-5 py-4 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white font-bold rounded-2xl hover:from-green-600 hover:via-green-700 hover:to-emerald-700 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 group-hover:animate-shimmer"></div>
              <div className="relative flex items-center gap-3">
                <svg className="w-6 h-6 group-hover:rotate-12 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <span className="text-base sm:text-lg">Share on WhatsApp</span>
              </div>
            </button>
            
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
                              const selectedPlayer = awayPlayers.find(p => p.player_id === e.target.value);
                              newMatchups[idx].away_player_id = e.target.value;
                              newMatchups[idx].away_player_name = selectedPlayer?.player_name || '';
                            }
                            setMatchups(newMatchups);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Deselect --</option>
                          {awayPlayers
                            .filter(player => {
                              // Show this player if:
                              // 1. Not selected in any other matchup, OR
                              // 2. Selected in THIS matchup (current idx)
                              const isSelectedElsewhere = matchups.some((m, i) => 
                                i !== idx && m.away_player_id === player.player_id
                              );
                              return !isSelectedElsewhere || player.player_id === matchup.away_player_id;
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
                        const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
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
                  const homeTotalGoals = matchups.reduce((sum, m) => sum + (m.home_goals ?? 0), 0);
                  const awayTotalGoals = matchups.reduce((sum, m) => sum + (m.away_goals ?? 0), 0);
                  const winner = homeTotalGoals > awayTotalGoals ? 'home' : awayTotalGoals > homeTotalGoals ? 'away' : 'draw';

                  return (
                    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-2 border-blue-300 rounded-2xl p-4 sm:p-6 shadow-xl">
                      <h3 className="text-center text-sm font-semibold text-gray-600 mb-4">Match Result</h3>
                      <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Home Total */}
                        <div className={`text-center p-4 rounded-xl ${
                          winner === 'home' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-white text-gray-700'
                        } transition-all`}>
                          <div className="text-xs sm:text-sm font-medium mb-1">{fixture.home_team_name}</div>
                          <div className="text-3xl sm:text-4xl font-bold">{homeTotalGoals}</div>
                          {winner === 'home' && <div className="text-xs mt-1 font-semibold">✓ WINNER</div>}
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
                        </div>
                      </div>
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
                  {matchups.map((matchup, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 sm:gap-4 items-center p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl">
                      {/* Home Player & Goals */}
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-gray-500 mb-1">Home Player</p>
                        <p className="font-medium text-gray-900 mb-1">{matchup.home_player_name}</p>
                        {matchup.home_goals !== null && matchup.home_goals !== undefined ? (
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
                            {matchup.home_goals} {matchup.home_goals === 1 ? 'goal' : 'goals'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No result</span>
                        )}
                      </div>

                      {/* VS Badge with Score */}
                      <div className="flex justify-center">
                        {matchup.home_goals !== null && matchup.away_goals !== null ? (
                          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg px-4 py-2 font-bold text-lg shadow-md">
                            {matchup.home_goals} - {matchup.away_goals}
                          </div>
                        ) : (
                          <div className="bg-gray-200 text-gray-600 rounded-full px-4 py-2 text-sm font-medium">VS</div>
                        )}
                      </div>

                      {/* Away Player & Goals */}
                      <div className="text-center sm:text-left">
                        <p className="text-xs text-gray-500 mb-1">Away Player</p>
                        <p className="font-medium text-gray-900 mb-1">{matchup.away_player_name}</p>
                        {matchup.away_goals !== null && matchup.away_goals !== undefined ? (
                          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-bold">
                            {matchup.away_goals} {matchup.away_goals === 1 ? 'goal' : 'goals'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No result</span>
                        )}
                      </div>

                      {/* Match Number & Duration */}
                      <div className="col-span-full sm:col-span-1 text-center">
                        <span className="text-xs text-gray-500">Match #{matchup.position}</span>
                        {matchup.match_duration && (
                          <span className="ml-2 text-xs text-green-600 font-medium">
                            ({matchup.match_duration} min)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Enter/Edit Results Button */}
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

                        const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            results,
                            entered_by: user!.uid,
                          }),
                        });

                        if (!response.ok) throw new Error('Failed to save results');

                        const resultData = await response.json();
                        console.log('Result submission response:', resultData);

                        // Save MOTM and penalty goals at fixture level
                        const motmPlayerName = motmPlayerId ? 
                          matchups.find(m => m.home_player_id === motmPlayerId)?.home_player_name ||
                          matchups.find(m => m.away_player_id === motmPlayerId)?.away_player_name || null
                          : null;

                        console.log('Saving MOTM and penalty goals:', { motmPlayerId, motmPlayerName, homePenaltyGoals, awayPenaltyGoals });

                        const motmResponse = await fetch(`/api/fixtures/${fixtureId}`, {
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
                        const pointsResponse = await fetch('/api/realplayers/update-points', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fixture_id: fixtureId,
                            season_id: fixture.season_id,
                            matchups: results,
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

                        const statsResponse = await fetch('/api/realplayers/update-stats', {
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
                        const teamStatsResponse = await fetch('/api/teamstats/update-stats', {
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
                          const fantasyResponse = await fetch('/api/fantasy/calculate-points', {
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
              {phase === 'home_fixture' && 'Home team will create player matchups during this phase'}
              {phase === 'fixture_entry' && 'First team to create matchups gets edit rights'}
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
              
              {/* Dynamic penalty calculation */}
              {subNewPlayerId && (() => {
                const playersList = subSide === 'home' ? homePlayers : awayPlayers;
                const currentMatchup = matchups[subMatchupIndex];
                const currentPlayerId = subSide === 'home' ? currentMatchup.home_player_id : currentMatchup.away_player_id;
                
                const getCategoryValue = (player: any): number => {
                  if (player.category_id === 'legend') return 1;
                  if (player.category_id === 'classic') return 2;
                  if (typeof player.category === 'number') return player.category;
                  if (player.category === 'legend') return 1;
                  if (player.category === 'classic') return 2;
                  if (player.category_name?.toLowerCase().includes('legend')) return 1;
                  if (player.category_name?.toLowerCase().includes('classic')) return 2;
                  return 3;
                };
                
                const currentPlayer = playersList.find(p => p.player_id === currentPlayerId);
                const newPlayer = playersList.find(p => p.player_id === subNewPlayerId);
                
                if (!currentPlayer || !newPlayer) return null;
                
                const currentCat = getCategoryValue(currentPlayer);
                const newCat = getCategoryValue(newPlayer);
                const catPenalty = newCat < currentCat ? 1 : 0;
                const totalPenalty = 2 + catPenalty;
                
                return (
                  <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-semibold text-orange-900 mb-1">
                      ⚠️ Substitution Penalty
                    </p>
                    <p className="text-xs text-orange-700">
                      <strong>+{totalPenalty} goals</strong> will be awarded to opponent
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      (+2 base {catPenalty > 0 && '+ 1 category upgrade'})
                    </p>
                  </div>
                );
              })()}
              
              {!subNewPlayerId && (
                <p className="text-xs text-gray-500 mt-2">
                  Select a player to see penalty calculation
                </p>
              )}
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
                  // Display category properly - check category_id first
                  let catDisplay = 'N/A';
                  
                  // Debug: show actual value
                  const debugInfo = `[${player.category_id || 'no id'}]`;
                  
                  if (player.category_id === 'legend') {
                    catDisplay = 'Legend';
                  } else if (player.category_id === 'classic') {
                    catDisplay = 'Classic';
                  } else if (player.category_name) {
                    catDisplay = player.category_name;
                  } else if (typeof player.category === 'number') {
                    catDisplay = player.category.toString();
                  } else if (player.category === 'legend') {
                    catDisplay = 'Legend';
                  } else if (player.category === 'classic') {
                    catDisplay = 'Classic';
                  }
                  
                  return (
                    <option key={player.player_id} value={player.player_id}>
                      {player.name || player.player_name} ({catDisplay}) {debugInfo}
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
