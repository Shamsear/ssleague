'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamRegistration } from '@/contexts/TeamRegistrationContext';
import { useFirebaseAuth } from '@/hooks/useFirebase';
import { useRouter } from 'next/navigation';

export default function MobileNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const { user } = useAuth();
  const { isRegistered, teamLogo } = useTeamRegistration();
  const { signOut } = useFirebaseAuth();
  const router = useRouter();
  
  // Get the appropriate dashboard URL based on user role
  const getDashboardUrl = () => {
    if (!user) return '/';
    
    switch (user.role) {
      case 'super_admin':
        return '/dashboard/superadmin';
      case 'committee_admin':
        return '/dashboard/committee';
      case 'team':
        return '/dashboard/team';
      default:
        return '/dashboard';
    }
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      toggleMenu(false);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  const toggleMenu = (open: boolean) => {
    setIsMenuOpen(open);
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      setExpandedMenu(null);
    }
  };
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        toggleMenu(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      document.body.style.position = '';
    };
  }, [isMenuOpen]);
  
  const toggleSubmenu = (menuName: string) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName);
  };
  
  return (
    <>
      {/* Mobile Navigation Bar - Hidden on desktop (md:hidden means hide when >= 768px) */}
      <nav 
        className={`md:hidden fixed top-0 left-0 right-0 z-[1001] transition-all duration-300 ${
          isMenuOpen 
            ? 'bg-green-400/98 backdrop-blur-lg border-b-0 shadow-lg shadow-green-400/30' 
            : 'bg-white/95 backdrop-blur-lg border-b border-gray-200'
        }`}
        style={isMenuOpen ? {background: 'rgba(195, 221, 74, 0.98)'} : {}}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-2 flex-shrink-0 z-10">
            <Link href={getDashboardUrl()} className="flex items-center gap-2" onClick={() => toggleMenu(false)}>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white transition-transform hover:scale-110 shadow-md">
                <Image
                  src="/logo.png"
                  alt="SS League Logo"
                  width={40}
                  height={40}
                  className="object-contain p-0.5"
                  priority
                />
              </div>
              <span className="text-base font-bold text-gray-900">League</span>
            </Link>
          </div>
          
          {/* CENTER: Menu Button / Close Button */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center z-10">
            {!isMenuOpen ? (
              <button
                onClick={() => toggleMenu(true)}
                className="flex items-center gap-2 px-0 py-1 hover:opacity-80 transition-opacity"
                aria-label="Open menu"
              >
                <span className="text-sm font-semibold text-gray-900">Menu</span>
                <div className="flex flex-col gap-1 w-6">
                  <span className="block h-0.5 w-full bg-gray-900 rounded transition-all"></span>
                  <span className="block h-0.5 w-4 bg-gray-900 rounded transition-all"></span>
                  <span className="block h-0.5 w-full bg-gray-900 rounded transition-all"></span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => toggleMenu(false)}
                className="flex items-center gap-2 px-5 py-2 bg-white rounded-full border-2 border-black font-semibold text-sm hover:bg-gray-50 transition-colors"
                aria-label="Close menu"
              >
                <span>Close</span>
              </button>
            )}
          </div>
          
          {/* RIGHT: User Avatar / Team Logo */}
          <div className="flex items-center flex-shrink-0 z-10">
            {!user ? (
              <Link 
                href="/login" 
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${
                  isMenuOpen 
                    ? 'bg-green-500/40 hover:bg-green-500/60' 
                    : 'hover:bg-gray-100'
                }`}
                style={isMenuOpen ? {background: 'linear-gradient(135deg, #c3dd4a 0%, #a3d034 100%)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.3)'} : {}}
                title="Login"
              >
                <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L9 7V9C9 10.1 9.9 11 11 11V14.5C11 15.6 11.4 16.6 12 17.4C12.6 16.6 13 15.6 13 14.5V11C14.1 11 15 10.1 15 9Z"/>
                </svg>
              </Link>
            ) : user.role === 'team' && teamLogo ? (
              <Link 
                href={getDashboardUrl()} 
                className="w-11 h-11 rounded-full overflow-hidden bg-white shadow-md transition-transform hover:scale-110"
                title="Dashboard"
              >
                <Image
                  src={teamLogo}
                  alt="Team Logo"
                  width={44}
                  height={44}
                  className="object-cover w-full h-full"
                />
              </Link>
            ) : (
              <Link 
                href={getDashboardUrl()} 
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${
                  isMenuOpen 
                    ? 'bg-green-500/40 hover:bg-green-500/60' 
                    : 'hover:bg-gray-100'
                }`}
                style={isMenuOpen ? {background: 'linear-gradient(135deg, #c3dd4a 0%, #a3d034 100%)', boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.3)'} : {}}
                title="Dashboard"
              >
                <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </Link>
            )}
          </div>
        </div>
      </nav>
      
      {/* Full Screen Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-[1000] overflow-y-auto transition-opacity duration-300"
          style={{background: 'linear-gradient(135deg, #c3dd4a 0%, #a3d034 50%, #7bc62d 100%)'}}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              toggleMenu(false);
            }
          }}
        >
          {/* Menu Content */}
          <div className="pt-20 pb-8 px-6 opacity-100 transform translate-y-0 transition-all duration-400">
            {/* Welcome Section */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">SS League</h2>
              <p className="text-gray-800">Fantasy Football Auction Platform</p>
            </div>
            
            {/* Navigation Menu */}
            <nav className="max-w-2xl mx-auto">
              {/* Home / Dashboard */}
              {!user ? (
                <div className="border-b border-black/10">
                  <Link 
                    href="/" 
                    className="block py-4"
                    onClick={() => toggleMenu(false)}
                  >
                    <div className="flex flex-col">
                      <span className="text-2xl font-normal text-gray-900">Home</span>
                      <span className="text-sm text-gray-700 mt-1">Welcome page</span>
                    </div>
                  </Link>
                </div>
              ) : (
                <div className="border-b border-black/10">
                  <Link 
                    href={getDashboardUrl()} 
                    className="block py-4"
                    onClick={() => toggleMenu(false)}
                  >
                    <div className="flex flex-col">
                      <span className="text-2xl font-normal text-gray-900">Dashboard</span>
                      <span className="text-sm text-gray-700 mt-1">Your team overview</span>
                    </div>
                  </Link>
                </div>
              )}
              
              {/* Public Pages - Show for everyone */}
              {!user && (
                <>
                  {/* Current Season */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/season/current" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Season</span>
                        <span className="text-sm text-gray-700 mt-1">Current season</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* Players */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/players" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Players</span>
                        <span className="text-sm text-gray-700 mt-1">Player database</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* Teams */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/teams" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Teams</span>
                        <span className="text-sm text-gray-700 mt-1">All teams</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* Fixtures */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/fixtures" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Fixtures</span>
                        <span className="text-sm text-gray-700 mt-1">Upcoming matches</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* Results */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/results" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Results</span>
                        <span className="text-sm text-gray-700 mt-1">Match results</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* Archive */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/seasons" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Archive</span>
                        <span className="text-sm text-gray-700 mt-1">Past seasons</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* Awards */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/awards" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">🏆 Awards</span>
                        <span className="text-sm text-gray-700 mt-1">Trophy cabinet</span>
                      </div>
                    </Link>
                  </div>
                  
                  {/* News */}
                  <div className="border-b border-black/10">
                    <Link 
                      href="/news" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">📰 News</span>
                        <span className="text-sm text-gray-700 mt-1">Latest updates</span>
                      </div>
                    </Link>
                  </div>
                </>
              )}
              
              {/* Super Admin Navigation */}
              {user && user.role === 'super_admin' && (
                <>
                  {/* Seasons */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('seasons')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Seasons</span>
                          <span className="text-sm text-gray-700 mt-1">Season management</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'seasons' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'seasons' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/superadmin/seasons" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>All Seasons</Link>
                        <Link href="/dashboard/superadmin/seasons/create" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Create Season</Link>
                        <Link href="/dashboard/superadmin/historical-seasons" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Historical Seasons</Link>
                        <Link href="/dashboard/superadmin/season-player-stats" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Season Stats</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Management */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('management')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Management</span>
                          <span className="text-sm text-gray-700 mt-1">Users & teams</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'management' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'management' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/superadmin/users" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Users</Link>
                        <Link href="/dashboard/superadmin/teams" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Teams</Link>
                        <Link href="/dashboard/superadmin/players" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Players</Link>
                        <Link href="/dashboard/superadmin/invites" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Invites</Link>
                        <Link href="/dashboard/superadmin/password-requests" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Password Requests</Link>
                        <Link href="/dashboard/superadmin/monitoring" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Monitoring</Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Committee Admin Navigation */}
              {user && user.role === 'committee_admin' && (
                <>
                  {/* Teams & Players */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('teams')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Teams & Players</span>
                          <span className="text-sm text-gray-700 mt-1">Manage participants</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'teams' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'teams' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/committee/teams" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>All Teams</Link>
                        <Link href="/dashboard/committee/players" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>All Players</Link>
                        <Link href="/dashboard/committee/registration" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Registration</Link>
                        <Link href="/dashboard/committee/database" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Database</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Rounds & Matches */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('rounds')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Rounds & Matches</span>
                          <span className="text-sm text-gray-700 mt-1">Auction management</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'rounds' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'rounds' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/committee/rounds" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>All Rounds</Link>
                        <Link href="/dashboard/committee/bulk-rounds" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Bulk Rounds</Link>
                        <Link href="/dashboard/committee/tiebreakers" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Tiebreakers</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Tournament */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('tournament')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Tournament</span>
                          <span className="text-sm text-gray-700 mt-1">Competition setup</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'tournament' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'tournament' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/committee/team-management" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Team Management</Link>
                        <Link href="/dashboard/committee/team-management/categories" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Categories</Link>
                        <Link href="/dashboard/committee/team-management/match-days" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Match Days</Link>
                        <Link href="/dashboard/committee/team-management/team-standings" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Team Standings</Link>
                        <Link href="/dashboard/committee/team-management/player-stats" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Player Statistics</Link>
                        <Link href="/dashboard/committee/team-management/team-members" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Team Members</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Settings */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('settings')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Settings</span>
                          <span className="text-sm text-gray-700 mt-1">Configuration</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'settings' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'settings' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/committee/auction-settings" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Auction Settings</Link>
                        <Link href="/dashboard/committee/position-groups" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Position Groups</Link>
                        <Link href="/dashboard/committee/player-selection" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Player Selection</Link>
                        <Link href="/dashboard/committee/awards" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>🏆 Awards Management</Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Team Navigation - Only show if registered */}
              {user && user.role === 'team' && isRegistered && (
                <>
                  {/* My Team */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('myteam')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">My Team</span>
                          <span className="text-sm text-gray-700 mt-1">Team management</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'myteam' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'myteam' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/team/profile" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Team Profile</Link>
                        <Link href="/dashboard/team/players" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>My Players</Link>
                        <Link href="/dashboard/team/budget-planner" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Budget Planner</Link>
                        <Link href="/dashboard/team/players-database" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Player Database</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Matches */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('matches')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Matches</span>
                          <span className="text-sm text-gray-700 mt-1">Fixtures & results</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'matches' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'matches' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/team/matches" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>All Matches</Link>
                        <Link href="/dashboard/team/fixtures" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Fixtures</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Leaderboards */}
                  <div className="border-b border-black/10">
                    <button 
                      className="w-full py-4 text-left"
                      onClick={() => toggleSubmenu('leaderboards')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-normal text-gray-900">Leaderboards</span>
                          <span className="text-sm text-gray-700 mt-1">Stats & rankings</span>
                        </div>
                        <svg className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'leaderboards' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    {expandedMenu === 'leaderboards' && (
                      <div className="pl-6 pb-4 space-y-2">
                        <Link href="/dashboard/team/team-leaderboard" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Team Leaderboard</Link>
                        <Link href="/dashboard/team/player-leaderboard" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Player Leaderboard</Link>
                        <Link href="/dashboard/team/all-teams" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>All Teams</Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Auth Links */}
              {!user && (
                <>
                  <div className="border-b border-black/10">
                    <Link 
                      href="/login" 
                      className="block py-4"
                      onClick={() => toggleMenu(false)}
                    >
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">Sign In</span>
                        <span className="text-sm text-gray-700 mt-1">Access your account</span>
                      </div>
                    </Link>
                  </div>
                </>
              )}
              
              
              {/* Logout for authenticated users */}
              {user && (
                <div className="border-b border-black/10">
                  <button 
                    className="w-full py-4 text-left"
                    onClick={() => toggleSubmenu('account')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-2xl font-normal text-gray-900">My Account</span>
                        <span className="text-sm text-gray-700 mt-1">Settings & help</span>
                      </div>
                      <svg 
                        className={`w-5 h-5 text-gray-900 transition-transform ${expandedMenu === 'account' ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </button>
                  {expandedMenu === 'account' && (
                    <div className="pl-6 pb-4 space-y-2">
                      <Link href="/profile" className="block text-base text-gray-800 hover:text-gray-900 py-1" onClick={() => toggleMenu(false)}>Edit Profile</Link>
                      <button onClick={handleSignOut} className="block text-base text-gray-800 hover:text-gray-900 py-1 text-left w-full">Logout</button>
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
      
      {/* Add padding to body when mobile nav is present */}
      <style jsx global>{`
        @media (max-width: 768px) {
          body {
            padding-top: 64px;
          }
        }
      `}</style>
    </>
  );
}

