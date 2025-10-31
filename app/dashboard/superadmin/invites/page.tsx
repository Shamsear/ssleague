'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAllSeasons } from '@/lib/firebase/seasons';
import { 
  createAdminInvite, 
  getAllAdminInvites, 
  deleteAdminInvite,
  getCommitteeAdminsBySeason 
} from '@/lib/firebase/invites';
import { AdminInvite } from '@/types/invite';
import { Season } from '@/types/season';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface SeasonAdmin {
  seasonId: string;
  seasonName: string;
  seasonYear: string;
  isActive: boolean;
  activeInvites: number;
  usedInvites: number;
  admins: {
    uid: string;
    username: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
  }[];
}

export default function AdminInvites() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [seasonAdmins, setSeasonAdmins] = useState<SeasonAdmin[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    seasonId: '',
    description: '',
    maxUses: 1,
    expiresInHours: 24,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Load data
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch seasons and invites
      const [seasonsData, invitesData] = await Promise.all([
        getAllSeasons(),
        getAllAdminInvites(),
      ]);
      
      setSeasons(seasonsData);
      setInvites(invitesData);
      
      // Build season admin data
      const seasonAdminData: SeasonAdmin[] = [];
      
      for (const season of seasonsData) {
        const admins = await getCommitteeAdminsBySeason(season.id);
        const seasonInvites = invitesData.filter(inv => inv.seasonId === season.id);
        
        seasonAdminData.push({
          seasonId: season.id,
          seasonName: season.name,
          seasonYear: season.year,
          isActive: season.isActive,
          activeInvites: seasonInvites.filter(inv => inv.isActive && inv.usedCount < inv.maxUses).length,
          usedInvites: seasonInvites.reduce((sum, inv) => sum + inv.usedCount, 0),
          admins: admins.map(admin => ({
            uid: admin.uid,
            username: admin.username,
            email: admin.email,
            isActive: admin.isActive,
            createdAt: admin.createdAt,
          })),
        });
      }
      
      setSeasonAdmins(seasonAdminData);
      
      // Set default season for form
      if (seasonsData.length > 0 && !formData.seasonId) {
        const activeSeason = seasonsData.find(s => s.isActive);
        setFormData(prev => ({
          ...prev,
          seasonId: activeSeason?.id || seasonsData[0].id,
        }));
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    if (!loading && user && user.role === 'super_admin') {
      loadData();
      setupRealTimeListeners();
    }
  }, [user, loading, router]);
  
  // Setup real-time listeners for live updates
  const setupRealTimeListeners = () => {
    let latestInvites: AdminInvite[] = [];
    
    // Listen to invites collection
    const invitesQuery = query(
      collection(db, 'invites'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
      const updatedInvites: AdminInvite[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        updatedInvites.push({
          id: doc.id,
          ...data,
          expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(data.expiresAt),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        } as AdminInvite);
      });
      latestInvites = updatedInvites;
      setInvites(updatedInvites);
      
      // Update season admins data when invites change
      updateSeasonAdminsData(updatedInvites);
    }, (error) => {
      console.error('Error listening to invites:', error);
    });
    
    // Listen to users collection for committee admins
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeUsers = onSnapshot(usersQuery, () => {
      // Reload season admins when users change, using latest invites
      updateSeasonAdminsData(latestInvites);
    }, (error) => {
      console.error('Error listening to users:', error);
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribeInvites();
      unsubscribeUsers();
    };
  };
  
  // Update season admins data
  const updateSeasonAdminsData = async (currentInvites: AdminInvite[]) => {
    if (seasons.length === 0) return;
    
    const seasonAdminData: SeasonAdmin[] = [];
    
    for (const season of seasons) {
      const admins = await getCommitteeAdminsBySeason(season.id);
      const seasonInvites = currentInvites.filter(inv => inv.seasonId === season.id);
      
      seasonAdminData.push({
        seasonId: season.id,
        seasonName: season.name,
        seasonYear: season.year,
        isActive: season.isActive,
        activeInvites: seasonInvites.filter(inv => inv.isActive && inv.usedCount < inv.maxUses).length,
        usedInvites: seasonInvites.reduce((sum, inv) => sum + inv.usedCount, 0),
        admins: admins.map(admin => ({
          uid: admin.uid,
          username: admin.username,
          email: admin.email,
          isActive: admin.isActive,
          createdAt: admin.createdAt,
        })),
      });
    }
    
    setSeasonAdmins(seasonAdminData);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.seasonId) {
      alert('Please select a season');
      return;
    }
    
    if (!user) return;
    
    try {
      setIsCreating(true);
      setError(null);
      
      await createAdminInvite(
        formData,
        user.uid,
        user.username
      );
      
      // Reset form and close form (no reload needed - real-time listeners will update)
      setFormData({
        seasonId: formData.seasonId,
        description: '',
        maxUses: 1,
        expiresInHours: 24,
      });
      setShowCreateForm(false);
      
      alert('Admin invite created successfully!');
    } catch (err: any) {
      console.error('Error creating invite:', err);
      alert(`Failed to create invite: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInvite = async (inviteCode: string, description: string, seasonName: string) => {
    const confirmed = confirm(
      `Are you sure you want to delete the admin invite "${description}" for ${seasonName}?\n\nThis action cannot be undone. Any unused invitation links will stop working immediately.`
    );
    
    if (!confirmed) return;
    
    try {
      setError(null);
      await deleteAdminInvite(inviteCode);
      
      // No reload needed - real-time listeners will update
      alert('Invite deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting invite:', err);
      alert(`Failed to delete invite: ${err.message}`);
    }
  };

  const copyToClipboard = async (text: string, inviteId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(inviteId);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      alert('Could not copy link. Please copy manually.');
    }
  };

  const getInviteUrl = (code: string, seasonId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/register?invite=${code}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/superadmin')}
                className="p-2 rounded-xl hover:bg-white/50 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Admin Invitations</h1>
                <p className="text-gray-600 text-sm md:text-base">Create and manage committee admin invitation codes</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 group w-full md:w-auto justify-center"
            >
              <svg className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {showCreateForm ? 'Cancel' : 'Create Invite'}
            </button>
          </div>
        </div>

        {/* Season-Based Admin Overview */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          <div className="px-6 py-5 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#9580FF] flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Season Administrators
              </h3>
              {seasonAdmins.length > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#9580FF]/20 text-[#9580FF]">
                  {seasonAdmins.length} Seasons
                </span>
              )}
            </div>
          </div>
          
          {seasonAdmins.length > 0 ? (
            <div className="divide-y divide-gray-200/50">
              {seasonAdmins.map((season) => (
                <div key={season.seasonId}>
                  {/* Season Header */}
                  <div className="px-6 py-4 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{season.seasonName} ({season.seasonYear})</h4>
                          <div className="flex items-center space-x-3 text-sm text-gray-500">
                            {season.isActive ? (
                              <span className="flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Active Season
                              </span>
                            ) : (
                              <span className="flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                                Previous Season
                              </span>
                            )}
                            <span>{season.activeInvites} Active Invites</span>
                            <span>{season.usedInvites} Used Invites</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Admins List */}
                  {season.admins.map((admin, idx) => (
                    <div key={idx} className="px-6 py-3 pl-16 border-l-2 border-[#9580FF]/20 ml-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{admin.username}</span>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>{admin.email}</span>
                              {admin.isActive ? (
                                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">Active</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">Inactive</span>
                              )}
                              <span>Joined: {formatDate(admin.createdAt).split(',')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Season Data Found</h3>
                <p className="text-gray-500 mb-6">Create seasons and invite administrators to get started.</p>
              </div>
            </div>
          )}
        </div>

        {/* Active Invites */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#9580FF] flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Active Invitations
              </h3>
              {invites.filter(inv => inv.isActive && inv.usedCount < inv.maxUses).length > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#9580FF]/20 text-[#9580FF]">
                  {invites.filter(inv => inv.isActive && inv.usedCount < inv.maxUses).length} Active
                </span>
              )}
            </div>
          </div>
          
          {/* Create Invite Form */}
          {showCreateForm && (
            <div className="border-b border-gray-200/50 animate-slideDown">
              <form onSubmit={handleCreateInvite} className="p-4 space-y-4 bg-gradient-to-br from-[#9580FF]/5 to-blue-50/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="group">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Season *
                    </label>
                    <select
                      value={formData.seasonId}
                      onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] transition-all"
                      required
                    >
                      <option value="">Select season</option>
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name} ({season.year}) {season.isActive ? '✓' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="group">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] transition-all"
                      placeholder="Brief description"
                    />
                  </div>
                  
                  <div className="group">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] transition-all"
                    />
                  </div>
                  
                  <div className="group">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Expires (Hours)
                    </label>
                    <input
                      type="number"
                      value={formData.expiresInHours}
                      onChange={(e) => setFormData({ ...formData, expiresInHours: parseInt(e.target.value) || 24 })}
                      min="1"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[#9580FF]/20 focus:border-[#9580FF] transition-all"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 col-span-full">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !formData.seasonId}
                    className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {isCreating ? (
                      <>
                        <svg className="animate-spin w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {invites.filter(inv => inv.isActive && inv.usedCount < inv.maxUses).length > 0 || showCreateForm ? (
            <div className="divide-y divide-gray-200/50">
              {invites.filter(inv => inv.isActive && inv.usedCount < inv.maxUses).map((invite) => (
                <div key={invite.id} className="px-6 py-5 hover:bg-white/30 transition-all duration-200 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center mr-3">
                          <svg className="w-5 h-5 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 group-hover:text-[#9580FF] transition-colors">
                            {invite.description || 'Admin Invitation'}
                            {invite.seasonName && <span className="text-sm font-normal text-gray-600 ml-2">for {invite.seasonName}</span>}
                          </h4>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className={`flex items-center px-3 py-1.5 rounded-lg ${seasons.find(s => s.id === invite.seasonId)?.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">{invite.seasonName}</span>
                            {invite.seasonYear && <span className="ml-1 text-xs opacity-75">({invite.seasonYear})</span>}
                            {seasons.find(s => s.id === invite.seasonId)?.isActive && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                                <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Active
                              </span>
                            )}
                          </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Created by: {invite.createdByUsername}
                            </span>
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Expires: {formatDate(invite.expiresAt)}
                            </span>
                            <span className="flex items-center">
                              <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              Uses: {invite.usedCount}/{invite.maxUses}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Invite URL Display */}
                      <div className="bg-gray-50/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50">
                        <label className="block text-xs font-medium text-gray-600 mb-2">Invitation URL</label>
                        <div className="flex items-center space-x-2 flex-wrap gap-2">
                          <input
                            type="text"
                            readOnly
                            value={getInviteUrl(invite.code, invite.seasonId)}
                            onClick={(e) => e.currentTarget.select()}
                            className="flex-1 min-w-0 text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
                          />
                          {invite.usedCount < invite.maxUses && (
                            <button
                              onClick={() => copyToClipboard(getInviteUrl(invite.code, invite.seasonId), invite.id)}
                              className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              {copiedUrl === invite.id ? 'Copied!' : 'Copy'}
                            </button>
                          )}
                          <a
                            href={getInviteUrl(invite.code, invite.seasonId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Test
                          </a>
                          <button
                            onClick={() => handleDeleteInvite(invite.code, invite.description || 'Unnamed invite', invite.seasonName || 'Unknown Season')}
                            className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#9580FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Invitations</h3>
                <p className="text-gray-500 mb-6">Create invitation codes to allow new administrators to join the system.</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-[#9580FF]/10 text-[#9580FF] text-sm font-medium hover:bg-[#9580FF]/20 transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create First Invite
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
