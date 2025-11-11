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
  // Circle shape settings
  photo_position_circle?: string; // Quick presets or custom 'X% Y%'
  photo_scale_circle?: number;
  photo_position_x_circle?: number; // 0-100 percentage for fine control
  photo_position_y_circle?: number; // 0-100 percentage for fine control
  // Square shape settings
  photo_position_square?: string;
  photo_scale_square?: number;
  photo_position_x_square?: number;
  photo_position_y_square?: number;
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
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [modalShape, setModalShape] = useState<'circle' | 'square'>('circle');
  const [isDragging, setIsDragging] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState({ x: 50, y: 50 });
  const [overlayScale, setOverlayScale] = useState(1);

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

  const openAdjustmentModal = (player: Player, shape: 'circle' | 'square') => {
    setEditingPlayer(player);
    setModalShape(shape);
    
    // Load existing position
    const posX = shape === 'circle' ? (player.photo_position_x_circle ?? 50) : (player.photo_position_x_square ?? 50);
    const posY = shape === 'circle' ? (player.photo_position_y_circle ?? 50) : (player.photo_position_y_square ?? 50);
    const scale = shape === 'circle' ? (player.photo_scale_circle || 1) : (player.photo_scale_square || 1);
    
    console.log('Opening modal - Loading saved settings:', {
      player: player.player_id,
      shape,
      savedData: {
        posX: shape === 'circle' ? player.photo_position_x_circle : player.photo_position_x_square,
        posY: shape === 'circle' ? player.photo_position_y_circle : player.photo_position_y_square,
        scale: shape === 'circle' ? player.photo_scale_circle : player.photo_scale_square
      },
      loading: { posX, posY, scale }
    });
    
    setOverlayPosition({ x: posX, y: posY });
    setOverlayScale(scale);
  };

  const closeModal = () => {
    setEditingPlayer(null);
    setIsDragging(false);
  };

  const handlePhotoSettings = async (playerId: string, shape: 'circle' | 'square', position: string, scale: number, posX?: number, posY?: number) => {
    try {
      const playerDoc = players.find(p => p.player_id === playerId);
      if (!playerDoc) return;

      const fieldPosition = shape === 'circle' ? 'photo_position_circle' : 'photo_position_square';
      const fieldScale = shape === 'circle' ? 'photo_scale_circle' : 'photo_scale_square';
      const fieldPosX = shape === 'circle' ? 'photo_position_x_circle' : 'photo_position_x_square';
      const fieldPosY = shape === 'circle' ? 'photo_position_y_circle' : 'photo_position_y_square';

      // Update Firestore
      const updateData: any = {
        [fieldPosition]: position,
        [fieldScale]: scale,
        updated_at: new Date(),
      };
      
      if (posX !== undefined) updateData[fieldPosX] = posX;
      if (posY !== undefined) updateData[fieldPosY] = posY;

      console.log('Saving to Firestore:', { playerId, shape, updateData });

      await updateDoc(doc(db, 'realplayers', playerDoc.id), updateData);

      // Update local state
      setPlayers(players.map(p => {
        if (p.player_id === playerId) {
          const updated: any = { ...p, [fieldPosition]: position, [fieldScale]: scale };
          if (posX !== undefined) updated[fieldPosX] = posX;
          if (posY !== undefined) updated[fieldPosY] = posY;
          return updated;
        }
        return p;
      }));

      setSuccess(`${shape === 'circle' ? 'Circle' : 'Square'} photo settings updated`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update photo settings');
      setTimeout(() => setError(null), 3000);
    }
  };

  const saveModalSettings = async () => {
    if (!editingPlayer) return;
    
    console.log('Saving modal settings:', {
      player: editingPlayer.player_id,
      shape: modalShape,
      scale: overlayScale,
      position: overlayPosition
    });
    
    await handlePhotoSettings(
      editingPlayer.player_id,
      modalShape,
      'custom',
      overlayScale,
      overlayPosition.x,
      overlayPosition.y
    );
    
    closeModal();
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
          {filteredPlayers.map(player => {
            // Get settings based on current preview shape
            const currentPosition = previewShape === 'circle' 
              ? (player.photo_position_circle || 'center')
              : (player.photo_position_square || 'center');
            const currentScale = previewShape === 'circle'
              ? (player.photo_scale_circle || 1)
              : (player.photo_scale_square || 1);
            const currentPosX = previewShape === 'circle'
              ? (player.photo_position_x_circle ?? 50)
              : (player.photo_position_x_square ?? 50);
            const currentPosY = previewShape === 'circle'
              ? (player.photo_position_y_circle ?? 50)
              : (player.photo_position_y_square ?? 50);
            
            // Use custom position if available, otherwise use preset
            const displayPosition = currentPosition === 'custom' 
              ? `${currentPosX}% ${currentPosY}%`
              : currentPosition;
            
            return (
            <div key={player.id} className="glass rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all">
              {/* Photo */}
              <div 
                className={`relative w-full aspect-square mb-3 overflow-hidden bg-gray-100 ${
                  previewShape === 'circle' ? 'rounded-full' : 'rounded-lg'
                }`}
              >
                {player.photo_url ? (
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    fill
                    className="object-cover"
                    style={{
                      objectPosition: `${currentPosX}% ${currentPosY}%`,
                      transform: `scale(${currentScale})`,
                      transformOrigin: `${currentPosX}% ${currentPosY}%`
                    }}
                    unoptimized
                    draggable={false}
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

              {/* Photo Adjustment Controls (only show if photo exists) */}
              {player.photo_url && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openAdjustmentModal(player, 'circle')}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <div className="w-3 h-3 rounded-full border-2 border-current"></div>
                    Circle
                  </button>
                  <button
                    onClick={() => openAdjustmentModal(player, 'square')}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <div className="w-3 h-3 rounded border-2 border-current"></div>
                    Square
                  </button>
                </div>
              )}

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
          );})}
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

      {/* Adjustment Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{editingPlayer.name}</h2>
                  <p className="text-sm opacity-90">
                    Adjust Photo Position - {modalShape === 'circle' ? '⭕ Circle View' : '⬜ Square View'}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Image with Draggable Overlay */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Preview & Adjust</h3>
                  <div 
                    className="relative w-full aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-move border-2 border-gray-200"
                    onMouseDown={(e) => {
                      setIsDragging(true);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setOverlayPosition({ x, y });
                    }}
                    onMouseMove={(e) => {
                      if (!isDragging) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                      setOverlayPosition({ x, y });
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                  >
                    {/* Full Image */}
                    {editingPlayer.photo_url && (
                      <Image
                        src={editingPlayer.photo_url}
                        alt={editingPlayer.name}
                        fill
                        className="object-cover"
                        unoptimized
                        draggable={false}
                      />
                    )}
                    
                    {/* Draggable Overlay */}
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at ${overlayPosition.x}% ${overlayPosition.y}%, transparent 0%, transparent ${(modalShape === 'circle' ? 150 : 200) / overlayScale}px, rgba(0,0,0,0.7) ${(modalShape === 'circle' ? 150 : 200) / overlayScale}px)`
                      }}
                    >
                      {/* Visible Frame */}
                      <div
                        className={`absolute border-4 border-purple-500 shadow-2xl ${
                          modalShape === 'circle' ? 'rounded-full' : 'rounded-lg'
                        }`}
                        style={{
                          width: `${300 / overlayScale}px`,
                          height: `${300 / overlayScale}px`,
                          left: `calc(${overlayPosition.x}% - ${150 / overlayScale}px)`,
                          top: `calc(${overlayPosition.y}% - ${150 / overlayScale}px)`,
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-1 h-8 bg-purple-500"></div>
                          <div className="w-8 h-1 bg-purple-500 absolute"></div>
                        </div>
                      </div>
                      
                      {/* Instruction Overlay */}
                      {!isDragging && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium pointer-events-auto">
                          🖱️ Click and drag to position
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Position Info */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Position:</span>
                      <span className="font-mono text-purple-600">
                        X: {overlayPosition.x.toFixed(1)}%, Y: {overlayPosition.y.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Preview & Controls */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Final Preview</h3>
                  
                  {/* Preview */}
                  <div 
                    className={`relative w-64 h-64 mx-auto bg-gray-100 overflow-hidden ${
                      modalShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                    }`}
                  >
                    {editingPlayer.photo_url && (
                      <Image
                        src={editingPlayer.photo_url}
                        alt={editingPlayer.name}
                        fill
                        className="object-cover"
                        style={{
                          objectPosition: `${overlayPosition.x}% ${overlayPosition.y}%`,
                          transform: `scale(${overlayScale})`,
                          transformOrigin: `${overlayPosition.x}% ${overlayPosition.y}%`
                        }}
                        unoptimized
                        draggable={false}
                      />
                    )}
                  </div>

                  {/* Shape Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Adjust for:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setModalShape('circle');
                          // Load circle settings
                          const posX = editingPlayer.photo_position_x_circle ?? 50;
                          const posY = editingPlayer.photo_position_y_circle ?? 50;
                          const scale = editingPlayer.photo_scale_circle || 1;
                          setOverlayPosition({ x: posX, y: posY });
                          setOverlayScale(scale);
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          modalShape === 'circle'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full border-2 border-current"></div>
                        Circle
                      </button>
                      <button
                        onClick={() => {
                          setModalShape('square');
                          // Load square settings
                          const posX = editingPlayer.photo_position_x_square ?? 50;
                          const posY = editingPlayer.photo_position_y_square ?? 50;
                          const scale = editingPlayer.photo_scale_square || 1;
                          setOverlayPosition({ x: posX, y: posY });
                          setOverlayScale(scale);
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          modalShape === 'square'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <div className="w-4 h-4 rounded border-2 border-current"></div>
                        Square
                      </button>
                    </div>
                  </div>

                  {/* Zoom Control */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zoom: {(overlayScale * 100).toFixed(0)}%
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setOverlayScale(Math.max(0.5, overlayScale - 0.1))}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={overlayScale}
                        onChange={(e) => setOverlayScale(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <button
                        onClick={() => setOverlayScale(Math.min(2, overlayScale + 0.1))}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <button
                    onClick={() => {
                      setOverlayPosition({ x: 50, y: 50 });
                      setOverlayScale(1);
                    }}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors"
                  >
                    Reset to Center
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={closeModal}
                className="px-6 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveModalSettings}
                className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
