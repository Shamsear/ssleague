'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Team {
  id: string;
  team_name: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function EditTeamMemberPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const playerId = params.id as string;

  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerNotFound, setPlayerNotFound] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    player_id: '',
    team_id: '',
    category_id: '',
    display_name: '',
    email: '',
    phone: '',
    psn_id: '',
    xbox_id: '',
    steam_id: '',
    notes: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playerRes, teamsRes, categoriesRes] = await Promise.all([
          fetch(`/api/real-players/${playerId}`),
          fetch('/api/team/all'),
          fetch('/api/categories'),
        ]);

        const [playerData, teamsData, categoriesData] = await Promise.all([
          playerRes.json(),
          teamsRes.json(),
          categoriesRes.json(),
        ]);

        if (!playerRes.ok || !playerData.success) {
          setPlayerNotFound(true);
          return;
        }

        const player = playerData.data;
        setFormData({
          name: player.name || '',
          player_id: player.player_id || '',
          team_id: player.team_id || '',
          category_id: player.category_id || '',
          display_name: player.display_name || '',
          email: player.email || '',
          phone: player.phone || '',
          psn_id: player.psn_id || '',
          xbox_id: player.xbox_id || '',
          steam_id: player.steam_id || '',
          notes: player.notes || '',
        });

        if (teamsData.success) setTeams(teamsData.data);
        if (categoriesData.success) setCategories(categoriesData.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setPlayerNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (playerId && user?.role === 'committee_admin') {
      fetchData();
    }
  }, [playerId, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetchWithTokenRefresh(`/api/real-players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          team_id: formData.team_id || null,
          category_id: formData.category_id || null,
          display_name: formData.display_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          psn_id: formData.psn_id || null,
          xbox_id: formData.xbox_id || null,
          steam_id: formData.steam_id || null,
          notes: formData.notes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update player');
      }

      router.push('/dashboard/committee/team-management/team-members?success=updated');
    } catch (err: any) {
      console.error('Error updating player:', err);
      setError(err.message || 'Failed to update player');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  if (playerNotFound) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Player Not Found</h2>
          <p className="text-gray-600 mb-6">The player you're looking for doesn't exist or has been removed.</p>
          <Link
            href="/dashboard/committee/team-management/team-members"
            className="inline-block bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300"
          >
            Back to Team Members
          </Link>
        </div>
      </div>
    );
  }

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      red: 'bg-red-600',
      blue: 'bg-blue-600',
      black: 'bg-black',
      white: 'bg-white border-2 border-gray-300',
    };
    return colorMap[color] || 'bg-gray-200';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Edit Team Member: {formData.name}</h1>
          <p className="text-gray-500 mt-1">Update information for this team member</p>
        </div>
        <Link
          href="/dashboard/committee/team-management/team-members"
          className="glass rounded-xl px-4 py-3 text-gray-700 font-medium hover:bg-white/60 transition-all duration-300 shadow-sm flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Team Members
        </Link>
      </div>

      {/* Form Container */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-[#0066FF]/5 to-[#0052CC]/5 px-6 sm:px-8 py-5 border-b border-gray-200/50">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-6 h-6 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Player Information
            </h2>
            <p className="text-sm text-gray-600 mt-1 ml-8">Update player details and team assignment</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="p-2 bg-[#0066FF]/10 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Basic Information
              </h3>

              {/* Player Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Player Name *
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                />
              </div>

              {/* Player ID (read-only) */}
              <div>
                <label htmlFor="player_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Player ID
                </label>
                <input
                  type="text"
                  name="player_id"
                  id="player_id"
                  value={formData.player_id}
                  disabled
                  className="w-full py-2 px-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Player ID cannot be changed</p>
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  name="display_name"
                  id="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  placeholder="Preferred display name"
                />
              </div>
            </div>

            {/* Team Assignment */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="p-2 bg-[#0066FF]/10 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                Team Assignment
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Team Selection */}
                <div>
                  <label htmlFor="team_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Team *
                  </label>
                  <select
                    name="team_id"
                    id="team_id"
                    required
                    value={formData.team_id}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  >
                    <option value="">Select a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Selection */}
                <div>
                  <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    name="category_id"
                    id="category_id"
                    required
                    value={formData.category_id}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  >
                    <option value="">Select a category...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {formData.category_id && (
                    <div className="mt-2 flex items-center">
                      <div
                        className={`h-6 w-6 rounded-full mr-2 ${getColorClass(
                          categories.find((c) => c.id === formData.category_id)?.color || ''
                        )}`}
                      ></div>
                      <span className="text-sm text-gray-600">
                        {categories.find((c) => c.id === formData.category_id)?.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="p-2 bg-[#0066FF]/10 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                Contact Information (Optional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    placeholder="player@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    placeholder="+1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Gaming IDs */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="p-2 bg-[#0066FF]/10 rounded-lg mr-3">
                  <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                Gaming IDs (Optional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PSN ID */}
                <div>
                  <label htmlFor="psn_id" className="block text-sm font-medium text-gray-700 mb-2">
                    PSN ID
                  </label>
                  <input
                    type="text"
                    name="psn_id"
                    id="psn_id"
                    value={formData.psn_id}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    placeholder="PlayStation Network ID"
                  />
                </div>

                {/* Xbox ID */}
                <div>
                  <label htmlFor="xbox_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Xbox ID
                  </label>
                  <input
                    type="text"
                    name="xbox_id"
                    id="xbox_id"
                    value={formData.xbox_id}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    placeholder="Xbox Gamertag"
                  />
                </div>

                {/* Steam ID */}
                <div>
                  <label htmlFor="steam_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Steam ID
                  </label>
                  <input
                    type="text"
                    name="steam_id"
                    id="steam_id"
                    value={formData.steam_id}
                    onChange={handleInputChange}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    placeholder="Steam ID"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-gray-200 pt-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                id="notes"
                rows={4}
                value={formData.notes}
                onChange={handleInputChange}
                className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                placeholder="Additional notes about this player..."
              ></textarea>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Error Updating Player</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button Area */}
          <div className="bg-gray-50 px-6 sm:px-8 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <Link
                href="/dashboard/committee/team-management/team-members"
                className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 focus:ring-offset-2 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
