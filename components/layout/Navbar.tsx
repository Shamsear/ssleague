'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamRegistration } from '@/contexts/TeamRegistrationContext';
import { useFirebaseAuth } from '@/hooks/useFirebase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const { isRegistered, teamLogo } = useTeamRegistration();
  const { signOut } = useFirebaseAuth();
  const router = useRouter();
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutside = Object.values(dropdownRefs.current).every(
        (ref) => ref && !ref.contains(target)
      );
      if (isOutside) {
        setOpenDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };
  
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
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  return (
    <nav className="nav-glass sticky top-0 z-50 hidden sm:block border-b border-white/10">
      <div className="container mx-auto px-6 flex justify-between items-center" style={{height: '64px'}}>
        {/* Logo */}
        <Link href={getDashboardUrl()} className="flex items-center group gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 shadow-md group-hover:shadow-lg bg-white">
            <Image
              src="/logo.png"
              alt="SS League Logo"
              width={40}
              height={40}
              className="object-contain p-0.5"
              priority
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold gradient-text leading-none tracking-tight">
              SS League
            </span>
            <span className="text-[10px] text-gray-500 font-medium leading-none mt-0.5">Auction Platform</span>
          </div>
        </Link>
        
        {/* Center Navigation Links */}
        <div className="hidden lg:flex items-center gap-1">
          {!user ? (
            <>
              {/* Public Navigation */}
              <Link href="/" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                Home
              </Link>
              <Link href="/season/current" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                Season
              </Link>
              <Link href="/players" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                Players
              </Link>
              <Link href="/teams" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                Teams
              </Link>
              <Link href="/seasons" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                Archive
              </Link>
              <Link href="/awards" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                🏆 Awards
              </Link>
              <Link href="/news" className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                📰 News
              </Link>
            </>
          ) : (
            <>
              {/* Role-based Navigation */}
              <Link href={getDashboardUrl()} className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 font-medium text-sm">
                Dashboard
              </Link>
              
              {/* Super Admin Navigation */}
              {user.role === 'super_admin' && (
                <>
                  {/* Seasons Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['seasons'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('seasons')}
                      className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 flex items-center gap-1 font-medium text-sm"
                    >
                      Seasons
                      <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'seasons' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'seasons' && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/superadmin/seasons" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all duration-150 rounded-lg mx-1.5 font-medium">
                          All Seasons
                        </Link>
                        <Link href="/dashboard/superadmin/seasons/create" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all duration-150 rounded-lg mx-1.5 font-medium">
                          Create Season
                        </Link>
                        <Link href="/dashboard/superadmin/historical-seasons" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all duration-150 rounded-lg mx-1.5 font-medium">
                          Historical Seasons
                        </Link>
                        <Link href="/dashboard/superadmin/season-player-stats" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all duration-150 rounded-lg mx-1.5 font-medium">
                          Season Stats
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Management Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['management'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('management')}
                      className="px-3 py-2 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50 flex items-center gap-1 font-medium text-sm"
                    >
                      Management
                      <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'management' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'management' && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/superadmin/users" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Users
                          </span>
                        </Link>
                        <Link href="/dashboard/superadmin/teams" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Teams
                          </span>
                        </Link>
                        <Link href="/dashboard/superadmin/players" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Players
                          </span>
                        </Link>
                        <Link href="/dashboard/superadmin/invites" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Invites
                          </span>
                        </Link>
                        <Link href="/dashboard/superadmin/password-requests" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Password Requests
                          </span>
                        </Link>
                        <Link href="/dashboard/superadmin/monitoring" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Monitoring
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Committee Admin Navigation */}
              {user.role === 'committee_admin' && (
                <>
                  {/* Teams & Players Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['teams'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('teams')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      Teams & Players
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'teams' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'teams' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/committee/teams" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            All Teams
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/players" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            All Players
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/registration" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Registration
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/database" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Database
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Rounds & Matches Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['rounds'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('rounds')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      Rounds & Matches
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'rounds' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'rounds' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/committee/rounds" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            All Rounds
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/bulk-rounds" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Bulk Rounds
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/tiebreakers" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Tiebreakers
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Tournament Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['tournament'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('tournament')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      Tournament
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'tournament' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'tournament' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/committee/team-management" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Team Management
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/team-management/categories" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Categories
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/team-management/match-days" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Match Days
                          </span>
                        </Link>
                        <div className="border-t border-white/10 my-2"></div>
                        <Link href="/dashboard/committee/team-management/team-standings" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Team Standings
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/team-management/player-stats" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Player Statistics
                          </span>
                        </Link>
                        <div className="border-t border-white/10 my-2"></div>
                        <Link href="/dashboard/committee/team-management/team-members" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Team Members
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Settings Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['settings'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('settings')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      Settings
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'settings' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'settings' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/committee/auction-settings" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Auction Settings
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/position-groups" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Position Groups
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/player-selection" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Player Selection
                          </span>
                        </Link>
                        <Link href="/dashboard/committee/awards" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            🏆 Awards Management
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Team Navigation - Only show if registered */}
              {user.role === 'team' && isRegistered && (
                <>
                  {/* My Team Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['myteam'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('myteam')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      My Team
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'myteam' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'myteam' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/team/profile" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Team Profile
                          </span>
                        </Link>
                        <Link href="/dashboard/team/players" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            My Players
                          </span>
                        </Link>
                        <Link href="/dashboard/team/budget-planner" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Budget Planner
                          </span>
                        </Link>
                        <Link href="/dashboard/team/players-database" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Player Database
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Matches Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['matches'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('matches')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      Matches
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'matches' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'matches' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/team/matches" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            All Matches
                          </span>
                        </Link>
                        <Link href="/dashboard/team/fixtures" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Fixtures
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Leaderboards Dropdown */}
                  <div className="relative" ref={(el) => { dropdownRefs.current['leaderboards'] = el; }}>
                    <button
                      onClick={() => toggleDropdown('leaderboards')}
                      className="px-4 py-2.5 text-gray-700 hover:text-blue-600 transition-all duration-200 rounded-xl hover:bg-blue-50/80 flex items-center font-medium text-sm group"
                    >
                      Leaderboards
                      <svg className={`w-4 h-4 ml-1.5 transition-transform duration-300 ${openDropdown === 'leaderboards' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openDropdown === 'leaderboards' && (
                      <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                        <Link href="/dashboard/team/team-leaderboard" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Team Leaderboard
                          </span>
                        </Link>
                        <Link href="/dashboard/team/player-leaderboard" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            Player Leaderboard
                          </span>
                        </Link>
                        <Link href="/dashboard/team/all-teams" className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/80 hover:text-blue-600 transition-all duration-200 rounded-xl mx-2 font-medium group">
                          <span className="flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            All Teams
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        
        {/* Right Side Actions */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* User Profile Dropdown */}
              <div className="relative" ref={(el) => { dropdownRefs.current['profile'] = el; }}>
                <button
                  onClick={() => toggleDropdown('profile')}
                  className="flex items-center space-x-3 px-4 py-2.5 rounded-xl hover:bg-white/70 transition-all duration-300 group border border-transparent hover:border-white/50"
                >
                  <div className="flex items-center space-x-2">
                    {user.role === 'team' && teamLogo ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-lg ring-2 ring-white/50 group-hover:ring-white/70 transition-all">
                        <Image
                          src={teamLogo}
                          alt="Team Logo"
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg ring-2 ring-white/50 group-hover:ring-white/70 transition-all">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-left hidden xl:block">
                      <p className="text-sm font-semibold text-gray-800 leading-tight">{user.username}</p>
                      <p className="text-xs text-gray-500">
                        {user.role === 'super_admin' && 'Super Admin'}
                        {user.role === 'committee_admin' && 'Committee Admin'}
                        {user.role === 'team' && 'Team Manager'}
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'profile' && (
                  <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl py-3 z-50 border border-gray-200 animate-fade-in">
                    <div className="px-5 py-4 border-b border-white/20">
                      <p className="text-sm font-semibold text-gray-800">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      {user.role === 'super_admin' && (
                        <span className="inline-block mt-2 px-2.5 py-1 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">Super Admin</span>
                      )}
                      {user.role === 'committee_admin' && (
                        <span className="inline-block mt-2 px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">Committee Admin</span>
                      )}
                      {user.role === 'team' && (
                        <span className="inline-block mt-2 px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">Team Manager</span>
                      )}
                    </div>
                    <Link href={getDashboardUrl()} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all rounded-lg mx-1 mt-1">
                      <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </Link>
                    {user.role === 'team' && (
                      <Link href="/dashboard/team/profile" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all rounded-lg mx-1">
                        <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Profile
                      </Link>
                    )}
                    <div className="border-t border-white/20 mt-1 pt-1">
                      <button 
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all rounded-lg mx-1 mb-1"
                      >
                        <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link 
                href="/login" 
                className="px-6 py-2.5 glass rounded-xl hover:bg-white transition-all duration-300 vision-button font-semibold text-sm shadow-md hover:shadow-lg border border-white/40 text-gray-700 hover:text-blue-600"
              >
                Login
              </Link>
              <Link 
                href="/register" 
                className="px-6 py-2.5 rounded-xl text-white hover:scale-105 transition-all duration-300 vision-button font-semibold text-sm shadow-lg hover:shadow-xl relative overflow-hidden group"
                style={{background: 'linear-gradient(135deg, #0066FF, #9580FF)'}}
              >
                <span className="relative z-10">Register</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
