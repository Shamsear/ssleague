'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';

interface ScoringRule {
  id: string;
  rule_type: string;
  points_value: number;
  description: string;
  is_active: boolean;
}

export default function FantasyScoringPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<any>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadLeagueData = async () => {
      if (!leagueId) return;

      try {
        const response = await fetch(`/api/fantasy/leagues/${leagueId}`);
        if (!response.ok) throw new Error('Failed to load league');

        const data = await response.json();
        setLeague(data.league);
        setScoringRules(data.scoring_rules || []);
      } catch (error) {
        console.error('Error loading league:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy league data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadLeagueData();
    }
  }, [user, leagueId]);

  const handleEditRule = (rule: ScoringRule) => {
    setEditingRule({ ...rule });
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/fantasy/scoring-rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points_value: editingRule.points_value,
          description: editingRule.description,
          is_active: editingRule.is_active,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update rule');
      }

      // Update local state
      setScoringRules(scoringRules.map(rule => 
        rule.id === editingRule.id ? editingRule : rule
      ));

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Scoring rule updated successfully',
      });

      setEditingRule(null);
    } catch (error) {
      console.error('Error updating rule:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update scoring rule',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getRuleIcon = (ruleType: string) => {
    switch (ruleType) {
      case 'goals_scored': return '⚽';
      case 'goals_conceded': return '🥅';
      case 'clean_sheet': return '🛡️';
      case 'motm': return '⭐';
      case 'win': return '✅';
      case 'draw': return '🤝';
      case 'loss': return '❌';
      case 'fine_goals': return '🚫';
      case 'substitution_penalty': return '🔄';
      default: return '📊';
    }
  };

  const getRuleColor = (pointsValue: number) => {
    if (pointsValue > 0) return 'text-green-600 bg-green-50 border-green-200';
    if (pointsValue < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !league) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to League Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Scoring Rules</h1>
              <p className="text-gray-600 mt-1">{league.name} - Point Configuration</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">How Scoring Works</p>
              <p className="text-sm text-blue-800">
                These rules determine how many points fantasy players earn based on real player performance. 
                Positive values add points, negative values deduct them. Click any rule to edit.
              </p>
            </div>
          </div>
        </div>

        {/* Scoring Rules Grid */}
        {scoringRules.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No scoring rules configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scoringRules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-xl shadow-lg border-2 ${
                  editingRule?.id === rule.id ? 'border-indigo-500' : 'border-gray-200'
                } overflow-hidden transition-all hover:shadow-xl`}
              >
                {editingRule?.id === rule.id ? (
                  // Edit Mode
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="text-4xl">{getRuleIcon(rule.rule_type)}</div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {rule.rule_type.replace(/_/g, ' ').toUpperCase()}
                        </h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Points Value
                            </label>
                            <input
                              type="number"
                              value={editingRule.points_value}
                              onChange={(e) => setEditingRule({
                                ...editingRule,
                                points_value: parseFloat(e.target.value) || 0
                              })}
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Description
                            </label>
                            <input
                              type="text"
                              value={editingRule.description}
                              onChange={(e) => setEditingRule({
                                ...editingRule,
                                description: e.target.value
                              })}
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`active-${rule.id}`}
                              checked={editingRule.is_active}
                              onChange={(e) => setEditingRule({
                                ...editingRule,
                                is_active: e.target.checked
                              })}
                              className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor={`active-${rule.id}`} className="text-sm font-medium text-gray-700">
                              Active Rule
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSaveRule}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : '✓ Save Changes'}
                      </button>
                      <button
                        onClick={() => setEditingRule(null)}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-4xl">{getRuleIcon(rule.rule_type)}</div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {rule.rule_type.replace(/_/g, ' ').toUpperCase()}
                          </h3>
                          <p className="text-sm text-gray-600">{rule.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className={`px-6 py-3 rounded-xl border-2 ${getRuleColor(rule.points_value)} font-bold text-2xl min-w-[100px] text-center`}>
                          {rule.points_value > 0 ? '+' : ''}{rule.points_value}
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          {rule.is_active ? (
                            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                              INACTIVE
                            </span>
                          )}
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
