'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';

interface PlayerData {
  player_id: string;
  name: string;
  display_name?: string;
  team?: string;
  category?: string;
  star_rating?: number;
  photo_url?: string;
  photo_position_x_circle?: number;
  photo_position_y_circle?: number;
  photo_scale_circle?: number;
  is_active?: boolean;
  created_at?: any;
  updated_at?: any;
  // Additional fields that might exist
  [key: string]: any;
}

export default function PlayerProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const playerId = params?.playerId as string;

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPlayer = async () => {
      if (!user || user.role !== 'super_admin' || !playerId) return;

      try {
        setLoadingData(true);
        setError(null);

        const playersRef = collection(db, 'realplayers');
        const q = query(playersRef, where('player_id', '==', playerId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError('Player not found');
          return;
        }

        const playerDoc = querySnapshot.docs[0];
        setPlayer({
          ...playerDoc.data(),
          player_id: playerDoc.data().player_id || playerDoc.id,
        } as PlayerData);
      } catch (error) {
        console.error('Error fetching player:', error);
        setError('Failed to load player data');
      } finally {
        setLoadingData(false);
      }
    };

    fetchPlayer();
  }, [user, playerId]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateOnly = (date: any) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getPhotoStyle = (x?: number, y?: number, scale?: number) => {
    const posX = x ?? 50;
    const posY = y ?? 50;
    const scaleValue = scale ?? 1;

    return {
      objectPosition: `${posX}% ${posY}%`,
      transform: `scale(${scaleValue})`,
      transformOrigin: `${posX}% ${posY}%`,
    };
  };

  if (loading || loadingData) {
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

  if (error || !player) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-900">{error || 'Player not found'}</h3>
                <p className="text-sm text-red-700 mt-1">The player you're looking for doesn't exist or couldn't be loaded.</p>
              </div>
            </div>
            <Link
              href="/dashboard/superadmin/realplayers"
              className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Players
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard/superadmin/realplayers"
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Profile</h1>
              <p className="text-gray-600 text-sm md:text-base mt-1">Complete player information from Firebase</p>
            </div>
          </div>
        </header>

        {/* Player Header Card */}
        <div className="glass rounded-3xl p-6 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Photo */}
            <div className="flex-shrink-0">
              {player.photo_url ? (
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  <img
                    src={player.photo_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                    style={getPhotoStyle(
                      player.photo_position_x_circle,
                      player.photo_position_y_circle,
                      player.photo_scale_circle
                    )}
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-4xl font-bold text-blue-600">{player.name[0]}</span>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{player.name}</h2>
              {player.display_name && player.display_name !== player.name && (
                <p className="text-lg text-gray-600 mb-3">Display Name: {player.display_name}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mb-3">
                {player.team && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-medium">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {player.team}
                  </span>
                )}
                {player.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-purple-100 text-purple-800 text-sm font-medium">
                    {player.category}
                  </span>
                )}
                {player.star_rating && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-yellow-100 text-yellow-800 text-sm font-medium">
                    {player.star_rating}⭐
                  </span>
                )}
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${
                  player.is_active !== false 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {player.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-sm text-gray-500 font-mono">ID: {player.player_id}</p>
            </div>
          </div>
        </div>

        {/* Player Details */}
        <div className="glass rounded-3xl p-6 mb-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">Player ID</div>
              <div className="text-sm font-mono font-semibold text-[#0066FF]">{player.player_id}</div>
            </div>
            <div className="bg-white/50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">Full Name</div>
              <div className="text-sm font-semibold text-gray-900">{player.name}</div>
            </div>
            {player.display_name && player.display_name !== player.name && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Display Name</div>
                <div className="text-sm font-semibold text-gray-900">{player.display_name}</div>
              </div>
            )}
            {player.team && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Team</div>
                <div className="text-sm font-semibold text-gray-900">{player.team}</div>
              </div>
            )}
            {player.category && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Category</div>
                <div className="text-sm font-semibold text-gray-900">{player.category}</div>
              </div>
            )}
            {player.star_rating && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Star Rating</div>
                <div className="text-lg font-bold text-yellow-600">{player.star_rating}⭐</div>
              </div>
            )}
            <div className="bg-white/50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div className="text-sm font-semibold">
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                  player.is_active !== false 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {player.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            {player.photo_url && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Photo</div>
                <div className="text-sm font-semibold text-green-600">Available</div>
              </div>
            )}
          </div>
        </div>

        {/* Personal Details */}
        <div className="glass rounded-3xl p-6 mb-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Personal Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(player.dob || player.date_of_birth || player.dateOfBirth || player.birth_date) && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1 flex items-center">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date of Birth
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatDateOnly(player.dob || player.date_of_birth || player.dateOfBirth || player.birth_date)}
                </div>
              </div>
            )}
            {player.place && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1 flex items-center">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Place
                </div>
                <div className="text-sm font-semibold text-gray-900">{player.place}</div>
              </div>
            )}
            {player.phone && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1 flex items-center">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone
                </div>
                <div className="text-sm font-semibold text-gray-900">{player.phone}</div>
              </div>
            )}
            {player.email && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1 flex items-center">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </div>
                <div className="text-sm font-semibold text-gray-900 break-all">{player.email}</div>
              </div>
            )}
            {player.address && (
              <div className="bg-white/50 rounded-xl p-4 md:col-span-2">
                <div className="text-sm text-gray-600 mb-1 flex items-center">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Address
                </div>
                <div className="text-sm font-semibold text-gray-900">{player.address}</div>
              </div>
            )}
            {!player.dob && !player.date_of_birth && !player.dateOfBirth && !player.birth_date && !player.place && !player.phone && !player.email && !player.address && (
              <div className="md:col-span-2 text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-500">No personal details available</p>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="glass rounded-3xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Record Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">Created At</div>
              <div className="text-sm font-medium text-gray-900">{formatDate(player.created_at)}</div>
            </div>
            {player.updated_at && (
              <div className="bg-white/50 rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">Last Updated</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(player.updated_at)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
