/**
 * Fantasy Achievements Page
 * Displays all achievements with unlock status and progress
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Achievement, AchievementCategory } from '@/lib/fantasy/achievements';

interface AchievementWithStatus extends Achievement {
  is_unlocked: boolean;
  unlocked_at?: Date;
}

interface AchievementProgress {
  total: number;
  unlocked: number;
  percentage: number;
  points_earned: number;
}

export default function AchievementsPage() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [progress, setProgress] = useState<AchievementProgress | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
  const [selectedRarity, setSelectedRarity] = useState<'all' | 'common' | 'rare' | 'epic' | 'legendary'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    loadTeamAndAchievements();
  }, [user]);

  const loadTeamAndAchievements = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // First get the team ID from the API
      const teamResponse = await fetch(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
      
      if (!teamResponse.ok) {
        if (teamResponse.status === 404) {
          setError('You are not registered in a fantasy league yet');
          return;
        }
        throw new Error('Failed to load fantasy team');
      }

      const teamData = await teamResponse.json();
      const fetchedTeamId = teamData.team.id;
      setTeamId(fetchedTeamId);

      // Now load achievements from API
      const [achievementsResponse, progressResponse] = await Promise.all([
        fetch(`/api/fantasy/achievements?team_id=${fetchedTeamId}`),
        fetch(`/api/fantasy/achievements?team_id=${fetchedTeamId}&action=progress`)
      ]);

      if (!achievementsResponse.ok || !progressResponse.ok) {
        throw new Error('Failed to load achievements data');
      }

      const achievementsData = await achievementsResponse.json();
      const progressData = await progressResponse.json();

      setAchievements(achievementsData.achievements);
      setProgress(progressData.progress);
    } catch (err) {
      console.error('Error loading achievements:', err);
      setError('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const filteredAchievements = achievements.filter(a => {
    if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
    if (selectedRarity !== 'all' && a.rarity !== selectedRarity) return false;
    return true;
  });

  const categories: { value: AchievementCategory | 'all'; label: string; emoji: string }[] = [
    { value: 'all', label: 'All', emoji: '🎯' },
    { value: 'scoring', label: 'Scoring', emoji: '⚽' },
    { value: 'lineup', label: 'Lineup', emoji: '📋' },
    { value: 'trading', label: 'Trading', emoji: '🤝' },
    { value: 'consistency', label: 'Consistency', emoji: '📈' },
    { value: 'special', label: 'Special', emoji: '✨' },
    { value: 'season', label: 'Season', emoji: '🏆' }
  ];

  const rarities = [
    { value: 'all', label: 'All Rarities', color: 'gray' },
    { value: 'common', label: 'Common', color: 'slate' },
    { value: 'rare', label: 'Rare', color: 'blue' },
    { value: 'epic', label: 'Epic', color: 'purple' },
    { value: 'legendary', label: 'Legendary', color: 'amber' }
  ];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-slate-400 bg-slate-50';
      case 'rare': return 'border-blue-400 bg-blue-50';
      case 'epic': return 'border-purple-400 bg-purple-50';
      case 'legendary': return 'border-amber-400 bg-amber-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadTeamAndAchievements}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🏆 Achievements</h1>
        <p className="text-gray-600">
          Unlock achievements to earn bonus points and showcase your fantasy prowess
        </p>
      </div>

      {/* Progress Overview */}
      {progress && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {progress.unlocked} / {progress.total}
              </h2>
              <p className="text-blue-100">Achievements Unlocked</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">+{progress.points_earned}</h2>
              <p className="text-blue-100">Bonus Points Earned</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="bg-white/20 rounded-full h-4 overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-center mt-2 text-sm text-blue-100">
            {progress.percentage}% Complete
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rarity
            </label>
            <div className="flex flex-wrap gap-2">
              {rarities.map(rar => (
                <button
                  key={rar.value}
                  onClick={() => setSelectedRarity(rar.value as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedRarity === rar.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {rar.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.achievement_id}
            className={`relative rounded-lg border-2 p-4 transition-all ${
              achievement.is_unlocked
                ? `${getRarityColor(achievement.rarity)} shadow-md`
                : 'border-gray-300 bg-gray-50 opacity-60'
            }`}
          >
            {/* Unlocked Badge */}
            {achievement.is_unlocked && (
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Unlocked
                </span>
              </div>
            )}

            {/* Achievement Icon */}
            <div className="text-5xl mb-3 text-center">
              {achievement.is_unlocked ? achievement.badge_emoji : '🔒'}
            </div>

            {/* Achievement Info */}
            <div className="text-center mb-3">
              <h3 className="font-bold text-lg text-gray-900 mb-1">
                {achievement.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {achievement.description}
              </p>
              
              {/* Rarity Badge */}
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium capitalize ${
                achievement.rarity === 'legendary' ? 'bg-amber-100 text-amber-800' :
                achievement.rarity === 'epic' ? 'bg-purple-100 text-purple-800' :
                achievement.rarity === 'rare' ? 'bg-blue-100 text-blue-800' :
                'bg-slate-100 text-slate-800'
              }`}>
                {achievement.rarity}
              </span>
            </div>

            {/* Points Reward */}
            <div className="text-center pt-3 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                +{achievement.points_reward} points
              </span>
            </div>

            {/* Unlock Date */}
            {achievement.is_unlocked && achievement.unlocked_at && (
              <div className="text-center mt-2">
                <span className="text-xs text-gray-500">
                  Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredAchievements.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            No achievements found with the selected filters
          </p>
        </div>
      )}
    </div>
  );
}
