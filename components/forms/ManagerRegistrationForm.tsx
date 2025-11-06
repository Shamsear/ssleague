'use client';

import { useState, useEffect } from 'react';
import { uploadImage } from '@/lib/imagekit/upload';

interface ManagerRegistrationFormProps {
  teamId: string;
  seasonId: string;
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Player {
  id: string;
  player_id: string;
  name: string;
  photo_url?: string;
}

interface ManagerFormData {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  place: string;
  nationality: string;
  jerseyNumber: string;
}

export default function ManagerRegistrationForm({
  teamId,
  seasonId,
  userId,
  onSuccess,
  onCancel,
}: ManagerRegistrationFormProps) {
  const [mode, setMode] = useState<'select' | 'player' | 'new'>('select');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [formData, setFormData] = useState<ManagerFormData>({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    place: '',
    nationality: '',
    jerseyNumber: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch team players when component mounts
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch(`/api/team/${teamId}/players?seasonId=${seasonId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setPlayers(result.data);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };

    if (mode === 'player') {
      fetchPlayers();
    }
  }, [mode, teamId, seasonId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmitPlayerManager = async () => {
    if (!selectedPlayer) {
      setError('Please select a player');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          seasonId,
          playerId: selectedPlayer.id,
          isPlayer: true,
          name: selectedPlayer.name,
          photoUrl: selectedPlayer.photo_url || null,
          createdBy: userId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to register manager');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error registering player manager:', err);
      setError(err.message || 'Failed to register manager. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitNonPlayingManager = async () => {
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Manager name is required');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    if (!photoFile) {
      setError('Manager photo is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photo to ImageKit
      const timestamp = Date.now();
      const fileName = `manager_${teamId}_${timestamp}_${photoFile.name}`;

      const uploadResult = await uploadImage({
        file: photoFile,
        fileName,
        folder: '/manager-photos',
        tags: ['manager', teamId, seasonId],
        useUniqueFileName: true,
      });

      // Create manager via API
      const response = await fetch('/api/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          seasonId,
          playerId: null,
          isPlayer: false,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth || null,
          place: formData.place || null,
          nationality: formData.nationality || null,
          jerseyNumber: formData.jerseyNumber ? parseInt(formData.jerseyNumber) : null,
          photoUrl: uploadResult.url,
          photoFileId: uploadResult.fileId,
          createdBy: userId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to register manager');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error registering non-playing manager:', err);
      setError(err.message || 'Failed to register manager. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'select') {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Select Manager Type</h3>
          <p className="text-gray-600">Choose how you want to register your team manager</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMode('player')}
            className="p-6 rounded-2xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Playing Manager</h4>
              <p className="text-sm text-gray-600">Select from your team's players</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('new')}
            className="p-6 rounded-2xl border-2 border-green-200 hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Non-Playing Manager</h4>
              <p className="text-sm text-gray-600">Register new manager with details</p>
            </div>
          </button>
        </div>

        {onCancel && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'player') {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setMode('select')}
          className="mb-4 text-gray-600 hover:text-gray-900 flex items-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h3 className="text-2xl font-bold text-gray-900 mb-4">Select Playing Manager</h3>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {loadingPlayers ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading players...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <p className="text-gray-600">No players assigned to your team yet.</p>
            <p className="text-sm text-gray-500 mt-2">Players will be assigned after the auction.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedPlayer(player)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPlayer?.id === player.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt={player.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center">
                      <span className="text-2xl text-gray-500">
                        {player.name[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{player.name}</p>
                    <p className="text-sm text-gray-500">{player.player_id}</p>
                  </div>
                  {selectedPlayer?.id === player.id && (
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-4 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmitPlayerManager}
            disabled={isSubmitting || !selectedPlayer}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting ? 'Registering...' : 'Confirm Manager'}
          </button>
        </div>
      </div>
    );
  }

  // mode === 'new' - Non-playing manager form
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmitNonPlayingManager(); }} className="space-y-6">
      <button
        type="button"
        onClick={() => setMode('select')}
        className="mb-4 text-gray-600 hover:text-gray-900 flex items-center transition-colors"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h3 className="text-2xl font-bold text-gray-900 mb-4">Register Non-Playing Manager</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Manager Photo *
        </label>
        <div className="flex items-center space-x-4">
          {photoPreview && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gray-200">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max size: 5MB. Formats: JPG, PNG
            </p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
          Full Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          placeholder="Enter manager's full name"
        />
      </div>

      {/* Email and Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="manager@example.com"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Enter phone number"
          />
        </div>
      </div>

      {/* Date of Birth, Place, Nationality */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-gray-700 mb-2">
            Date of Birth
          </label>
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label htmlFor="place" className="block text-sm font-semibold text-gray-700 mb-2">
            Place
          </label>
          <input
            type="text"
            id="place"
            name="place"
            value={formData.place}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="City/Town"
          />
        </div>
        <div>
          <label htmlFor="nationality" className="block text-sm font-semibold text-gray-700 mb-2">
            Nationality
          </label>
          <input
            type="text"
            id="nationality"
            name="nationality"
            value={formData.nationality}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Nationality"
          />
        </div>
      </div>

      {/* Jersey Number */}
      <div>
        <label htmlFor="jerseyNumber" className="block text-sm font-semibold text-gray-700 mb-2">
          Jersey Number (Optional)
        </label>
        <input
          type="number"
          id="jerseyNumber"
          name="jerseyNumber"
          value={formData.jerseyNumber}
          onChange={handleInputChange}
          min="1"
          max="99"
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          placeholder="Enter jersey number"
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isSubmitting ? 'Registering...' : 'Register Manager'}
        </button>
      </div>
    </form>
  );
}
