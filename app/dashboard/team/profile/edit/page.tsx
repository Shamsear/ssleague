'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { uploadImage } from '@/lib/imagekit/upload';
import { useCachedSeasons } from '@/hooks/useCachedFirebase';

interface RealPlayer {
  id: string | number;
  player_id: string;
  name: string;
  position?: string | null;
  jersey_number?: number | null;
  overall_rating?: number;
  photo_url?: string | null;
}

export default function EditTeamProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Form state - Team
  const [teamName, setTeamName] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState('');
  
  // Form state - Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerDOB, setOwnerDOB] = useState('');
  const [ownerPlace, setOwnerPlace] = useState('');
  const [ownerNationality, setOwnerNationality] = useState('India');
  const [ownerBio, setOwnerBio] = useState('');
  const [ownerInstagram, setOwnerInstagram] = useState('');
  const [ownerTwitter, setOwnerTwitter] = useState('');
  const [ownerPhoto, setOwnerPhoto] = useState<File | null>(null);
  const [ownerPhotoPreview, setOwnerPhotoPreview] = useState('');
  const [currentOwnerPhoto, setCurrentOwnerPhoto] = useState('');
  
  // Form state - Manager
  const [managerMode, setManagerMode] = useState<'player' | 'non-player'>('player');
  const [selectedPlayer, setSelectedPlayer] = useState<RealPlayer | null>(null);
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerDOB, setManagerDOB] = useState('');
  const [managerPlace, setManagerPlace] = useState('');
  const [managerNationality, setManagerNationality] = useState('India');
  const [managerJerseyNumber, setManagerJerseyNumber] = useState('');
  const [managerPhoto, setManagerPhoto] = useState<File | null>(null);
  const [managerPhotoPreview, setManagerPhotoPreview] = useState('');
  const [currentManagerPhoto, setCurrentManagerPhoto] = useState('');
  
  // Data
  const [realPlayers, setRealPlayers] = useState<RealPlayer[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [teamId, setTeamId] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState<'team' | 'owner' | 'manager'>('team');
  
  const keralaDistricts = [
    'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod',
    'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad',
    'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch active season using the same hook as profile page
  const { data: activeSeasons, isLoading: seasonsLoading } = useCachedSeasons(
    user?.role === 'team' ? { isActive: 'true' } : undefined
  );

  useEffect(() => {
    console.log('🔄 useEffect triggered, user:', user?.uid, 'seasons:', activeSeasons?.length);
    const fetchData = async () => {
      if (!user) {
        console.log('⚠️ No user, skipping fetch');
        return;
      }

      if (!activeSeasons || activeSeasons.length === 0) {
        console.log('⚠️ No active seasons found yet');
        return;
      }

      console.log('✅ User found, fetching data...');
      try {
        const activeSeasonId = activeSeasons[0].id;
        console.log('📅 Active season ID:', activeSeasonId);
        setSeasonId(activeSeasonId);

        // Fetch dashboard data
        console.log('🔍 Fetching dashboard data...');
        const response = await fetch(`/api/team/dashboard?season_id=${activeSeasonId}`);
        const result = await response.json();
        console.log('📦 Full API response:', result);
        const { success, data } = result;

        if (success && data) {
          console.log('✅ Data received successfully');
          console.log('👤 Team data:', data.team);
          console.log('🏆 Owner data:', data.owner);
          console.log('⚽ Manager data:', data.manager);
          console.log('👥 Real players data:', data.realPlayers);
          // Team data
          setTeamId(data.team.id);
          setTeamName(data.team.name);
          setCurrentLogoUrl(data.team.logo_url || '');
          console.log('✅ Team state updated:', { teamId: data.team.id, teamName: data.team.name });
          
          // Owner data
          console.log('🔄 Setting owner data...');
          if (data.owner) {
            console.log('✅ Owner data exists:', data.owner);
            setOwnerName(data.owner.name || '');
            setOwnerEmail(data.owner.email || '');
            setOwnerPhone(data.owner.phone || '');
            setOwnerDOB(data.owner.date_of_birth || '');
            setOwnerPlace(data.owner.place || '');
            setOwnerNationality(data.owner.nationality || 'India');
            setOwnerBio(data.owner.bio || '');
            setOwnerInstagram(data.owner.instagram_handle || '');
            setOwnerTwitter(data.owner.twitter_handle || '');
            setCurrentOwnerPhoto(data.owner.photo_url || '');
            console.log('✅ Owner state updated');
          } else {
            console.log('⚠️ No owner data in response');
          }
          
          // Manager data
          console.log('🔄 Setting manager data...');
          if (data.manager) {
            console.log('✅ Manager data exists:', data.manager);
            if (data.manager.is_player) {
              console.log('👤 Manager is a player, searching for player_id:', data.manager.player_id);
              setManagerMode('player');
              // Find the real player in the squad
              const managerPlayer = data.realPlayers?.find((p: any) => p.player_id === data.manager.player_id);
              console.log('🔍 Manager player found:', managerPlayer);
              if (managerPlayer) {
                setSelectedPlayer(managerPlayer);
                console.log('✅ Selected player set:', managerPlayer.name);
              } else {
                console.log('⚠️ Manager player not found in real players squad');
              }
            } else {
              console.log('👔 Manager is non-playing');
              setManagerMode('non-player');
              setManagerName(data.manager.name || '');
              setManagerEmail(data.manager.email || '');
              setManagerPhone(data.manager.phone || '');
              setManagerDOB(data.manager.date_of_birth || '');
              setManagerPlace(data.manager.place || '');
              setManagerNationality(data.manager.nationality || 'India');
              setManagerJerseyNumber(data.manager.jersey_number?.toString() || '');
              setCurrentManagerPhoto(data.manager.photo_url || '');
              console.log('✅ Non-playing manager state updated');
            }
          } else {
            console.log('⚠️ No manager data in response');
          }
          
          // Real Players list - filter out any players with null/undefined critical fields
          console.log('🔄 Setting real players list...');
          console.log('👥 Real players count:', data.realPlayers?.length || 0);
          console.log('👥 Real players data:', data.realPlayers);
          const validPlayers = (data.realPlayers || []).filter((p: any) => 
            p && p.id && p.player_id && p.name
          );
          setRealPlayers(validPlayers);
          console.log('✅ Real players state updated, valid players:', validPlayers.length);
        } else {
          console.log('❌ API returned error:', result.error);
        }
      } catch (error) {
        console.error('❌ Error fetching data:', error);
      }
    };

    fetchData();
  }, [user, activeSeasons]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setNewLogoFile(file);
    setNewLogoPreview(URL.createObjectURL(file));
  };

  const handleOwnerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setOwnerPhoto(file);
    setOwnerPhotoPreview(URL.createObjectURL(file));
  };

  const handleManagerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setManagerPhoto(file);
    setManagerPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    if (!ownerName.trim()) {
      setError('Owner name is required');
      return;
    }

    if (managerMode === 'non-player' && !managerName.trim()) {
      setError('Manager name is required');
      return;
    }

    if (managerMode === 'player' && !selectedPlayer) {
      setError('Please select a player as manager');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload team logo if changed
      let logoUrl = currentLogoUrl;
      if (newLogoFile) {
        const result = await uploadImage({
          file: newLogoFile,
          fileName: `team_${teamId}_${Date.now()}_${newLogoFile.name}`,
          folder: '/team-logos',
          tags: ['team', teamId],
          useUniqueFileName: true,
        });
        logoUrl = result.url;
      }

      // Upload owner photo if changed
      let ownerPhotoUrl = currentOwnerPhoto;
      if (ownerPhoto) {
        const result = await uploadImage({
          file: ownerPhoto,
          fileName: `owner_${teamId}_${Date.now()}_${ownerPhoto.name}`,
          folder: '/owner-photos',
          tags: ['owner', teamId],
          useUniqueFileName: true,
        });
        ownerPhotoUrl = result.url;
      }

      // Upload manager photo if changed (non-player only)
      let managerPhotoUrl = currentManagerPhoto;
      if (managerMode === 'non-player' && managerPhoto) {
        const result = await uploadImage({
          file: managerPhoto,
          fileName: `manager_${teamId}_${Date.now()}_${managerPhoto.name}`,
          folder: '/manager-photos',
          tags: ['manager', teamId],
          useUniqueFileName: true,
        });
        managerPhotoUrl = result.url;
      }

      // Prepare manager data
      let managerData;
      if (managerMode === 'player' && selectedPlayer) {
        managerData = {
          name: selectedPlayer.name,
          is_player: true,
          player_id: selectedPlayer.player_id,
          photo_url: null, // Use player's photo
        };
      } else {
        managerData = {
          name: managerName,
          email: managerEmail,
          phone: managerPhone,
          date_of_birth: managerDOB || null,
          place: managerPlace || null,
          nationality: managerNationality,
          jersey_number: managerJerseyNumber ? parseInt(managerJerseyNumber) : null,
          is_player: false,
          player_id: null,
          photo_url: managerPhotoUrl,
        };
      }

      // Call API
      const response = await fetch('/api/team/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          logoUrl,
          seasonId,
          owner: {
            name: ownerName,
            email: ownerEmail,
            phone: ownerPhone,
            date_of_birth: ownerDOB || null,
            place: ownerPlace || null,
            nationality: ownerNationality,
            bio: ownerBio || null,
            instagram_handle: ownerInstagram || null,
            twitter_handle: ownerTwitter || null,
            photo_url: ownerPhotoUrl,
          },
          manager: managerData,
        }),
      });

      const result = await response.json();
      console.log('📦 Update response:', result);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to update profile';
        const errorDetails = result.details ? `\n\nDetails: ${result.details}` : '';
        throw new Error(errorMessage + errorDetails);
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        router.push('/dashboard/team/profile');
      }, 2000);
    } catch (err: any) {
      console.error('❌ Error updating profile:', err);
      console.error('❌ Error stack:', err.stack);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || seasonsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Team Profile</h1>
          <p className="text-gray-600">Update your team information, owner, and manager details</p>
        </div>

        {/* Flash Messages */}
        {error && (
          <div className="mb-6 glass rounded-2xl p-4 border-l-4 border-red-500 bg-red-50">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 glass rounded-2xl p-4 border-l-4 border-green-500 bg-green-50">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        )}

        {/* Section Navigation */}
        <div className="glass rounded-2xl p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveSection('team')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeSection === 'team'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Team Info
          </button>
          <button
            onClick={() => setActiveSection('owner')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeSection === 'owner'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Owner
          </button>
          <button
            onClick={() => setActiveSection('manager')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeSection === 'manager'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Manager
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Team Info Section */}
          {activeSection === 'team' && (
            <div className="glass rounded-3xl p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Team Information</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Name *</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Logo</label>
                  <div className="flex items-center gap-4 mb-4">
                    {(newLogoPreview || currentLogoUrl) && (
                      <img
                        src={newLogoPreview || currentLogoUrl}
                        alt="Team logo"
                        className="w-24 h-24 rounded-xl object-contain bg-white p-2 border-2 border-gray-200"
                      />
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Choose Logo</span>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Max size: 5MB</p>
                </div>
              </div>
            </div>
          )}

          {/* Owner Section */}
          {activeSection === 'owner' && (
            <div className="glass rounded-3xl p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Owner Information</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={ownerDOB}
                    onChange={(e) => setOwnerDOB(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Place</label>
                  <select
                    value={ownerPlace}
                    onChange={(e) => setOwnerPlace(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select District</option>
                    {keralaDistricts.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                  <input
                    type="text"
                    value={ownerNationality}
                    onChange={(e) => setOwnerNationality(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea
                    value={ownerBio}
                    onChange={(e) => setOwnerBio(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instagram Handle</label>
                  <input
                    type="text"
                    value={ownerInstagram}
                    onChange={(e) => setOwnerInstagram(e.target.value)}
                    placeholder="@username"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Twitter Handle</label>
                  <input
                    type="text"
                    value={ownerTwitter}
                    onChange={(e) => setOwnerTwitter(e.target.value)}
                    placeholder="@username"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                  <div className="flex items-center gap-4 mb-4">
                    {(ownerPhotoPreview || currentOwnerPhoto) && (
                      <img
                        src={ownerPhotoPreview || currentOwnerPhoto}
                        alt="Owner"
                        className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200"
                      />
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      id="owner-photo-upload"
                      accept="image/*"
                      onChange={handleOwnerPhotoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="owner-photo-upload"
                      className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Choose Photo</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manager Section */}
          {activeSection === 'manager' && (
            <div className="glass rounded-3xl p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Manager Information</h2>
              
              {/* Manager Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Manager Type</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setManagerMode('player')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      managerMode === 'player'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Playing Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setManagerMode('non-player')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      managerMode === 'non-player'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Non-Playing Manager
                  </button>
                </div>
              </div>

              {managerMode === 'player' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Player *</label>
                  
                  {selectedPlayer && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600 font-medium mb-1">Current Manager</p>
                          <p className="font-bold text-gray-900">{selectedPlayer.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{selectedPlayer.position || 'Player'} • {selectedPlayer.overall_rating || 0} OVR</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayer(null)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium text-sm"
                        >
                          Change Manager
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {!selectedPlayer && (
                    <div>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {realPlayers.map(player => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => setSelectedPlayer(player)}
                            className="p-4 rounded-xl border-2 text-left transition-all border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          >
                            <div className="font-bold text-gray-900">{player.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-600">{player.position || 'Player'}</div>
                          </button>
                        ))}
                      </div>
                      {realPlayers.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No real players in squad yet. Add real players first before selecting a playing manager.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      required={managerMode === 'non-player'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={managerDOB}
                      onChange={(e) => setManagerDOB(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Place</label>
                    <select
                      value={managerPlace}
                      onChange={(e) => setManagerPlace(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select District</option>
                      {keralaDistricts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                    <input
                      type="text"
                      value={managerNationality}
                      onChange={(e) => setManagerNationality(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jersey Number</label>
                    <input
                      type="number"
                      value={managerJerseyNumber}
                      onChange={(e) => setManagerJerseyNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
                    <div className="flex items-center gap-4 mb-4">
                      {(managerPhotoPreview || currentManagerPhoto) && (
                        <img
                          src={managerPhotoPreview || currentManagerPhoto}
                          alt="Manager"
                          className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200"
                        />
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="file"
                        id="manager-photo-upload"
                        accept="image/*"
                        onChange={handleManagerPhotoChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="manager-photo-upload"
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Choose Photo</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="glass rounded-3xl p-6 flex justify-between items-center">
            <Link
              href="/dashboard/team/profile"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancel
            </Link>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
