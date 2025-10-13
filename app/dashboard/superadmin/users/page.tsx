'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAllUsers, updateUserRole, toggleUserStatus, deleteUser, approveUser, rejectUser } from '@/lib/firebase/auth';
import { User, UserRole } from '@/types/user';

export default function UsersManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'super_admin') {
      fetchUsers();
    }
  }, [user]);

  // Handle filter param from URL
  useEffect(() => {
    if (filterParam === 'pending') {
      setFilter('pending');
    }
  }, [filterParam]);

  // Filter users based on selected filter
  useEffect(() => {
    let filtered = users;
    
    if (filter === 'pending') {
      filtered = users.filter(u => !u.isApproved);
    } else if (filter === 'approved') {
      filtered = users.filter(u => u.isApproved);
    }
    
    setFilteredUsers(filtered);
  }, [users, filter]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const allUsers = await getAllUsers();
      // Sort users: pending first, then by role, then by username
      const sortedUsers = allUsers.sort((a, b) => {
        if (!a.isActive && b.isActive) return -1;
        if (a.isActive && !b.isActive) return 1;
        if (a.role !== b.role) {
          const roleOrder = { super_admin: 0, committee_admin: 1, team: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        }
        return a.username.localeCompare(b.username);
      });
      setUsers(sortedUsers);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleApproveUser = async (uid: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to approve this user? They will be able to log in.')) return;
    
    try {
      await approveUser(uid, user.uid);
      alert('User approved successfully!');
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to approve user');
    }
  };

  const handleRejectUser = async (uid: string, username: string) => {
    if (!confirm(`Are you sure you want to reject and delete user "${username}"? This action cannot be undone.`)) return;
    
    try {
      await rejectUser(uid);
      alert('User rejected and removed successfully.');
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to reject user');
    }
  };

  const handlePromoteUser = async (uid: string) => {
    try {
      await updateUserRole(uid, 'committee_admin');
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to promote user');
    }
  };

  const handleDemoteUser = async (uid: string) => {
    try {
      await updateUserRole(uid, 'team');
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to demote user');
    }
  };

  const handleDeleteUser = async (uid: string, username: string) => {
    const confirmed = confirm(
      `⚠️ PERMANENT DELETION WARNING\n\nThis will permanently delete:\n• User account: ${username}\n• Associated team and all data\n• All bids and auction history\n• Player acquisitions\n\nThis action CANNOT be undone!\n\nAre you absolutely sure you want to proceed?`
    );
    
    if (!confirmed) return;
    
    try {
      await deleteUser(uid);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const getRoleBadgeClasses = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800 group-hover:bg-red-200';
      case 'committee_admin':
        return 'bg-orange-100 text-orange-800 group-hover:bg-orange-200';
      default:
        return 'bg-blue-100 text-blue-800 group-hover:bg-blue-200';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === 'super_admin') {
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    } else if (role === 'committee_admin') {
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    );
  };

  if (loading || loadingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => router.push('/dashboard/superadmin')}
                  className="p-2 rounded-xl hover:bg-white/50 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-3xl md:text-4xl font-bold gradient-text">User Management</h1>
              </div>
              <p className="text-gray-600 text-sm md:text-base ml-14">
                Manage user roles and permissions across the system
              </p>
            </div>
            <div className="hidden md:flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Users Table */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-[#9580FF] flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-[#9580FF] text-white shadow-md'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    filter === 'pending'
                      ? 'bg-yellow-500 text-white shadow-md'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  Pending ({users.filter(u => !u.isApproved).length})
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    filter === 'approved'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white/50 text-gray-700 hover:bg-white/80'
                  }`}
                >
                  Approved ({users.filter(u => u.isApproved).length})
                </button>
              </div>
            </div>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="divide-y divide-gray-200/50">
              {filteredUsers.map((u) => (
                <div key={u.uid} className="px-6 py-5 hover:bg-white/30 transition-all duration-200 group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <div className="flex items-center space-x-3">
                          {/* User Avatar */}
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
                            <span className="text-[#9580FF] font-bold text-lg">
                              {u.username[0].toUpperCase()}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#9580FF] transition-colors">
                              {u.username}
                            </h3>
                            <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${getRoleBadgeClasses(u.role)}`}>
                              {getRoleIcon(u.role)}
                              {u.role.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {/* Approval Status */}
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Status: <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {u.isApproved ? 'Approved' : 'Pending Approval'}
                          </span>
                        </div>

                        {/* Email */}
                        {u.email && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {u.email}
                          </div>
                        )}

                        {/* Team Name for team role */}
                        {u.role === 'team' && 'teamName' in u && u.teamName && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Team: <span className="font-medium">{u.teamName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {user.uid !== u.uid && (
                      <div className="flex flex-wrap items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {!u.isApproved ? (
                          // Pending Approval Actions
                          <>
                            <button
                              onClick={() => handleApproveUser(u.uid)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                            >
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectUser(u.uid, u.username)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                            >
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                          </>
                        ) : (
                          // Approved User Actions
                          <>
                            {u.role === 'team' && (
                              <button
                                onClick={() => handlePromoteUser(u.uid)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                              >
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                </svg>
                                Promote
                              </button>
                            )}
                            {u.role === 'committee_admin' && (
                              <button
                                onClick={() => handleDemoteUser(u.uid)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                              >
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                </svg>
                                Demote
                              </button>
                            )}

                            {u.role !== 'super_admin' ? (
                              <button
                                onClick={() => handleDeleteUser(u.uid, u.username)}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-xl text-white bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                              >
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            ) : (
                              <div className="inline-flex items-center px-3 py-2 rounded-xl bg-[#9580FF]/10 text-[#9580FF] text-xs font-medium border border-[#9580FF]/20">
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.602-4.777l1.06 1.06A9 9 0 0121 12a9 9 0 01-9 9 9 9 0 01-9-9 9 9 0 019-9z" />
                                </svg>
                                Protected
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Users Found</h3>
                <p className="text-gray-500 mb-6">There are currently no users in the system. Users will appear here as they register.</p>
                <div className="inline-flex items-center px-4 py-2 rounded-xl bg-[#9580FF]/10 text-[#9580FF] text-sm font-medium">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Check back later
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
