'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs, doc, updateDoc, limit, where, orderBy } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';

interface Player {
  id: string;
  player_id: string;
  name: string;
  photo_url?: string;
  photo_file_id?: string;
  email?: string;
}

export default function PlayerPhotosManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'with-photo' | 'without-photo'>('all');
  const [previewShape, setPreviewShape] = useState<'circle' | 'square'>('circle');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!user || user.role !== 'super_admin') return;

      try {
        setLoadingData(true);
        const playersQuery = query(collection(db, 'realplayers'), orderBy('name'));
        const snapshot = await getDocs(playersQuery);
        
        const playersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Player));
        
        setPlayers(playersList);
        setFilteredPlayers(playersList);
      } catch (err) {
        console.error('Error fetching players:', err);
        setError('Failed to load players');
      } finally {
        setLoadingData(false);
      }
    };

    fetchPlayers();
  }, [user]);

  useEffect(() => {
    let filtered = players;

    // Apply photo filter
    if (filterType === 'with-photo') {
      filtered = filtered.filter(p => p.photo_url);
    } else if (filterType === 'without-photo') {
      filtered = filtered.filter(p => !p.photo_url);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.player_id.toLowerCase().includes(term) ||
        (p.email && p.email.toLowerCase().includes(term))
      );
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm, filterType]);

  const handlePhotoUpload = async (playerId: string, file: File) => {
    setUploadingPlayerId(playerId);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('playerId', playerId);

      const response = await fetch('/api/players/photos/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update Firestore
      const playerDoc = players.find(p => p.player_id === playerId);
      if (playerDoc) {
        await updateDoc(doc(db, 'realplayers', playerDoc.id), {
          photo_url: result.url,
          photo_file_id: result.fileId,
          updated_at: new Date(),
        });

        // Update local state
        setPlayers(players.map(p => 
          p.player_id === playerId 
            ? { ...p, photo_url: result.url, photo_file_id: result.fileId }
            : p
        ));

        setSuccess(`Photo uploaded successfully for ${playerDoc.name}`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload photo');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploadingPlayerId(null);
    }
  };

  const handleBulkUpload = async (files: FileList) => {
    setBulkUploading(true);
    setError(null);
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Extract player ID from filename (e.g., "sspslpsl0001.jpg" -> "sspslpsl0001")
      const fileName = file.name.toLowerCase();
      const playerId = fileName.split('.')[0];

      const player = players.find(p => p.player_id.toLowerCase() === playerId);
      
      if (!player) {
        results.failed++;
        results.errors.push(`${file.name}: Player not found`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('playerId', player.player_id);

        const response = await fetch('/api/players/photos/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error);
        }

        // Update Firestore
        await updateDoc(doc(db, 'realplayers', player.id), {
          photo_url: result.url,
          photo_file_id: result.fileId,
          updated_at: new Date(),
        });

        // Update local state
        setPlayers(prev => prev.map(p => 
          p.id === player.id 
            ? { ...p, photo_url: result.url, photo_file_id: result.fileId }
            : p
        ));

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${file.name}: ${err.message}`);
      }
    }

    setBulkUploading(false);
    
    if (results.success > 0) {
      setSuccess(`Uploaded ${results.success} photo(s) successfully`);
    }
    if (results.failed > 0) {
      setError(`Failed: ${results.failed}. ${results.errors.slice(0, 3).join(', ')}`);
    }
  };

  const stats = {
    total: players.length,
    withPhoto: players.filter(p => p.photo_url).length,
    withoutPhoto: players.filter(p => !p.photo_url).length,
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading players...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">Player Photos Management</h1>
              <p className="text-gray-600">Upload and manage player profile photos</p>
            </div>
            <Link 
              href="/dashboard/superadmin"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-5 border border-blue-200">
            <div className="text-sm text-gray-600 mb-1">Total Players</div>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          </div>
          <div className="glass rounded-xl p-5 border border-green-200">
            <div className="text-sm text-gray-600 mb-1">With Photo</div>
            <div className="text-3xl font-bold text-green-600">{stats.withPhoto}</div>
          </div>
          <div className="glass rounded-xl p-5 border border-amber-200">
            <div className="text-sm text-gray-600 mb-1">Without Photo</div>
            <div className="text-3xl font-bold text-amber-600">{stats.withoutPhoto}</div>
          </div>
        </div>

        {/* Bulk Upload Section */}
        <div className="glass rounded-xl p-6 mb-6 border border-purple-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Bulk Upload Photos
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload multiple photos at once. Filename must match player ID (e.g., <code className="bg-gray-100 px-2 py-1 rounded">sspslpsl0001.jpg</code>)
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={bulkUploading}
            onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          />
          {bulkUploading && (
            <div className="mt-3 text-sm text-purple-600 flex items-center">
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading photos...
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="glass rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 mb-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('with-photo')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'with-photo'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                With Photo
              </button>
              <button
                onClick={() => setFilterType('without-photo')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'without-photo'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                No Photo
              </button>
            </div>
          </div>
          
          {/* Shape Preview Toggle */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">Preview Shape:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewShape('circle')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  previewShape === 'circle'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white/30 border-2 border-current"></div>
                Circle
              </button>
              <button
                onClick={() => setPreviewShape('square')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  previewShape === 'square'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="w-4 h-4 rounded bg-white/30 border-2 border-current"></div>
                Square
              </button>
            </div>
            <span className="text-xs text-gray-500 ml-auto">Photos are displayed as they will appear on the site</span>
          </div>
          
          <p className="text-sm text-gray-600 mt-2">
            Showing {filteredPlayers.length} of {players.length} players
          </p>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map(player => (
            <div key={player.id} className="glass rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all">
              {/* Photo */}
              <div className={`relative w-full aspect-square mb-3 overflow-hidden bg-gray-100 ${
                previewShape === 'circle' ? 'rounded-full' : 'rounded-lg'
              }`}>
                {player.photo_url ? (
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Player Info */}
              <div className="mb-3">
                <h3 className="font-bold text-gray-900 truncate">{player.name}</h3>
                <p className="text-sm text-gray-600 font-mono">{player.player_id}</p>
              </div>

              {/* Upload Button */}
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPlayerId === player.player_id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePhotoUpload(player.player_id, file);
                    }
                  }}
                  className="hidden"
                />
                <div className={`px-4 py-2 rounded-lg text-center cursor-pointer transition-colors ${
                  uploadingPlayerId === player.player_id
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : player.photo_url
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}>
                  {uploadingPlayerId === player.player_id ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </span>
                  ) : player.photo_url ? (
                    'Change Photo'
                  ) : (
                    'Upload Photo'
                  )}
                </div>
              </label>
            </div>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No players found</p>
          </div>
        )}
      </div>
    </div>
  );
}
