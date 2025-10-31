import Link from 'next/link';
import HeroSection from './components/HeroSection';
import HallOfFameSelector from './components/HallOfFameSelector';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchData() {
  try {
    // Fetch all data in parallel
    const [
      leagueStatsRes,
      hallOfFameRes,
      recordsRes,
      championsRes,
      awardsRes,
      seasonRes
    ] = await Promise.all([
      fetch(`${baseUrl}/api/public/league-stats`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/public/hall-of-fame`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/public/league-records`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/public/champions`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/public/award-winners`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/public/current-season`, { cache: 'no-store' })
    ]);
    
    const [
      leagueStatsData,
      hallOfFameData,
      recordsData,
      championsData,
      awardsData,
      seasonData
    ] = await Promise.all([
      leagueStatsRes.json(),
      hallOfFameRes.json(),
      recordsRes.json(),
      championsRes.json(),
      awardsRes.json(),
      seasonRes.json()
    ]);

    // Extract data
    const leagueStats = leagueStatsData.success ? leagueStatsData.data : null;
    const hallOfFame = hallOfFameData.success ? hallOfFameData.data : null;
    const records = recordsData.success ? recordsData.data : null;
    const champions = championsData.success ? championsData.data.champions : [];
    const cupWinners = championsData.success ? championsData.data.cupWinners : [];
    const totalChampions = championsData.success ? championsData.data.totalChampions : 0;
    const awardWinners = awardsData.success ? awardsData.data.awardWinners : {};
    const currentSeason = seasonData.success ? seasonData.data : null;

    // Fetch current season standings if season exists
    let topTeams: any[] = [];
    if (currentSeason) {
      const teamsRes = await fetch(`${baseUrl}/api/team/all?season_id=${currentSeason.id}`, { cache: 'no-store' });
      const teamsData = await teamsRes.json();
      if (teamsData.success && teamsData.data?.teamStats) {
        topTeams = teamsData.data.teamStats.sort((a: any, b: any) => a.rank - b.rank).slice(0, 3);
      }
    }

    return {
      leagueStats,
      hallOfFame,
      records,
      champions,
      cupWinners,
      totalChampions,
      awardWinners,
      currentSeason,
      topTeams
    };
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    return {
      leagueStats: null,
      hallOfFame: null,
      records: null,
      champions: [],
      cupWinners: [],
      totalChampions: 0,
      awardWinners: {},
      currentSeason: null,
      topTeams: []
    };
  }
}

export default async function Home() {
  const {
    leagueStats,
    hallOfFame,
    records,
    champions,
    cupWinners,
    totalChampions,
    awardWinners,
    currentSeason,
    topTeams
  } = await fetchData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero Section */}
      <HeroSection />

      {/* League Stats Overview */}
      {leagueStats && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 sm:p-10 mb-8 border border-blue-200/50 shadow-xl">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-200/20 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2 text-center">
              📊 League Legacy
            </h2>
            <p className="text-center text-gray-600 mb-8">Our journey in numbers</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-blue-100">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="text-5xl font-black bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">
                    {leagueStats.league.total_seasons}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Seasons</div>
                </div>
              </div>
              
              <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-green-100">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="text-5xl font-black bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent mb-2">
                    {leagueStats.league.total_goals.toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Goals</div>
                </div>
              </div>
              
              <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-amber-100">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="text-5xl font-black bg-gradient-to-r from-amber-600 to-amber-700 bg-clip-text text-transparent mb-2">
                    {leagueStats.players.total_players}+
                  </div>
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Players</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Season Standings */}
      {currentSeason && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-8 sm:p-10 mb-8 border border-emerald-200/50 shadow-xl">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-200/20 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
                  {currentSeason.name}
                </h2>
                <div className="flex items-center gap-2">
                  {currentSeason.status === 'active' ? (
                    <>
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      <span className="text-emerald-700 font-semibold">Currently Active</span>
                    </>
                  ) : (
                    <span className="text-gray-600">📅 Season Info</span>
                  )}
                </div>
              </div>
              <Link
                href="/season/current"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                View Full Details
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {topTeams.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  🏆 <span>Current Standings - Top 3</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {topTeams.map((team, index) => (
                    <Link
                      key={team.team_id}
                      href={`/teams/${team.team_id}`}
                      className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-emerald-100"
                    >
                      {/* Position Badge */}
                      <div className={`absolute -top-3 -left-3 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-lg ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        'bg-gradient-to-br from-amber-500 to-amber-700'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="mt-2">
                        <h4 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                          {team.team_name}
                        </h4>
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            {team.points}
                          </span>
                          <span className="text-sm font-semibold text-gray-600">points</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="font-semibold text-gray-700">{team.wins}W</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                            <span className="font-semibold text-gray-700">{team.draws}D</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span className="font-semibold text-gray-700">{team.losses}L</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hall of Fame */}
      {hallOfFame && <HallOfFameSelector hallOfFame={hallOfFame} />}

      {/* League Records */}
      {records && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center">
            📈 League Records
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Records */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                🏆 Team Records
              </h3>
              <div className="space-y-3">
                {records.team.highestPoints && (
                  <div className="glass rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Highest Points in a Season</div>
                    <div className="font-bold text-gray-900">{records.team.highestPoints.team_name}</div>
                    <div className="text-lg font-bold text-blue-600">
                      {records.team.highestPoints.points} points
                    </div>
                    <div className="text-xs text-gray-500">{records.team.highestPoints.season_id}</div>
                  </div>
                )}
                {records.team.mostGoals && (
                  <div className="glass rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Most Goals in a Season</div>
                    <div className="font-bold text-gray-900">{records.team.mostGoals.team_name}</div>
                    <div className="text-lg font-bold text-green-600">
                      {records.team.mostGoals.goals} goals
                    </div>
                    <div className="text-xs text-gray-500">{records.team.mostGoals.season_id}</div>
                  </div>
                )}
                {records.team.longestWinStreak && (
                  <div className="glass rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Longest Win Streak</div>
                    <div className="font-bold text-gray-900">{records.team.longestWinStreak.team_name}</div>
                    <div className="text-lg font-bold text-purple-600">
                      {records.team.longestWinStreak.win_streak} wins
                    </div>
                    <div className="text-xs text-gray-500">{records.team.longestWinStreak.season_id}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Player Records */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                ⭐ Player Records
              </h3>
              <div className="space-y-3">
                {records.player.mostGoals && (
                  <div className="glass rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Most Goals in a Season</div>
                    <div className="font-bold text-gray-900">{records.player.mostGoals.player_name}</div>
                    <div className="text-lg font-bold text-green-600">
                      {records.player.mostGoals.goals_scored} goals
                    </div>
                    <div className="text-xs text-gray-500">
                      {records.player.mostGoals.team} • {records.player.mostGoals.season_id}
                    </div>
                  </div>
                )}
                {records.player.mostCleanSheets && (
                  <div className="glass rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Most Clean Sheets in a Season</div>
                    <div className="font-bold text-gray-900">{records.player.mostCleanSheets.player_name}</div>
                    <div className="text-lg font-bold text-purple-600">
                      {records.player.mostCleanSheets.clean_sheets} clean sheets
                    </div>
                    <div className="text-xs text-gray-500">
                      {records.player.mostCleanSheets.team} • {records.player.mostCleanSheets.season_id}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trophy Cabinet - Champions */}
      {champions.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-8 sm:p-10 mb-8 border border-yellow-200/50 shadow-xl">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-200/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-amber-200/20 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">
                  🏆 Trophy Cabinet
                </h2>
                <p className="text-gray-600">Celebrating our league champions</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-yellow-600">{totalChampions}</div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Unique Champions</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {champions.slice(0, 6).map((champion: any, index: number) => (
                <div
                  key={champion.team_id}
                  className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-yellow-100 hover:border-yellow-300"
                >
                  {/* Rank Badge */}
                  {index < 3 && (
                    <div className={`absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                      'bg-gradient-to-br from-amber-500 to-amber-700'
                    }`}>
                      {index + 1}
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-xl text-gray-900 flex-1 group-hover:text-yellow-700 transition-colors">
                      {champion.team_name}
                    </h3>
                    <div className="text-3xl transform group-hover:scale-110 transition-transform">
                      {'🏆'.repeat(Math.min(parseInt(champion.championship_count), 3))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                        {champion.championship_count}
                      </span>
                      <span className="text-sm font-semibold text-gray-600">Championships</span>
                    </div>
                    
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-3 border border-yellow-100">
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">Winning Seasons</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {champion.seasons_won.join(', ')}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{champion.best_points}</div>
                        <div className="text-xs text-gray-500">Best Points</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{champion.total_wins}</div>
                        <div className="text-xs text-gray-500">Total Wins</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalChampions > 6 && (
              <div className="mt-8 text-center">
                <Link 
                  href="/seasons" 
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
                >
                  View All {totalChampions} Champions
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cup Winners */}
      {cupWinners && cupWinners.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center">
            🏆 Cup Winners
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cupWinners.slice(0, 6).map((team: any) => (
              <div
                key={team.team_id}
                className="glass rounded-xl p-4 hover:shadow-lg transition-all border-2 border-blue-300"
              >
                <h3 className="font-bold text-gray-900 mb-2">{team.team_name}</h3>
                <p className="text-xl font-bold text-blue-600 mb-2">
                  {team.cup_count}× Cup Winner
                </p>
                <p className="text-xs text-gray-500">
                  Seasons: {team.seasons.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Awards */}
      {Object.keys(awardWinners).length > 0 && (
        <div className="space-y-8 mb-8">
          {Object.entries(awardWinners).slice(0, 3).map(([awardName, winners]) => (
            <div key={awardName} className="glass rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="text-3xl mr-3">🏅</span>
                {awardName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {winners.slice(0, 6).map((winner: any) => (
                  <div
                    key={winner.player_id}
                    className="glass rounded-xl p-4 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 flex-1">{winner.player_name}</h3>
                      <span className="text-2xl font-bold text-blue-600">×{winner.times_won}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Won {winner.times_won} time{winner.times_won > 1 ? 's' : ''}
                    </p>
                    {winner.total_value > 0 && (
                      <div className="text-sm font-semibold text-green-600">
                        Total: {winner.total_value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link href="/players" className="glass rounded-2xl p-6 hover:shadow-lg transition-all hover:scale-105 group">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Browse Players</h3>
          <p className="text-gray-600 text-sm">Explore all players and stats</p>
        </Link>

        <Link href="/teams" className="glass rounded-2xl p-6 hover:shadow-lg transition-all hover:scale-105 group">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">View Teams</h3>
          <p className="text-gray-600 text-sm">Check team rosters and standings</p>
        </Link>

        <Link href="/seasons" className="glass rounded-2xl p-6 hover:shadow-lg transition-all hover:scale-105 group">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Season Archive</h3>
          <p className="text-gray-600 text-sm">Explore past seasons and history</p>
        </Link>
      </div>
    </div>
  );
}
