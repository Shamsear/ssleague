'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface ScoringRule {
  rule_id: number;
  rule_name: string;
  rule_type: string;
  description?: string;
  points_value: number;
  applies_to: string;
  is_active: boolean;
  is_bonus_rule?: boolean;
  bonus_conditions?: any;
  priority?: number;
}

export default function CustomScoringRulesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [newRule, setNewRule] = useState({
    rule_name: '',
    rule_type: '',
    description: '',
    points_value: 0,
    applies_to: 'player',
    is_bonus_rule: false,
    bonus_condition_type: '',
    bonus_params: {} as any,
  });

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
    if (user && leagueId) {
      loadRules();
    }
  }, [user, leagueId]);

  const loadRules = async () => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/scoring-rules?league_id=${leagueId}`);
      if (!response.ok) throw new Error('Failed to load rules');
      
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createRule = async () => {
    if (!newRule.rule_name || !newRule.rule_type || newRule.points_value === null || newRule.points_value === undefined) {
      alert('Please fill in rule name, type, and points value');
      return;
    }
    
    if (newRule.is_bonus_rule && !newRule.bonus_condition_type) {
      alert('Please select a bonus condition type');
      return;
    }

    try {
      const payload: any = {
        league_id: leagueId,
        rule_name: newRule.rule_name,
        rule_type: newRule.rule_type,
        description: newRule.description,
        points_value: newRule.points_value,
        applies_to: newRule.applies_to,
        is_bonus_rule: newRule.is_bonus_rule,
      };
      
      if (newRule.is_bonus_rule) {
        payload.bonus_conditions = {
          condition_type: newRule.bonus_condition_type,
          ...newRule.bonus_params,
        };
      }
      
      const response = await fetchWithTokenRefresh('/api/fantasy/scoring-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rule');
      }

      alert('Rule created successfully!');
      setShowCreateForm(false);
      setNewRule({
        rule_name: '',
        rule_type: '',
        description: '',
        points_value: 0,
        applies_to: 'player',
        is_bonus_rule: false,
        bonus_condition_type: '',
        bonus_params: {},
      });
      loadRules();
    } catch (error) {
      console.error('Error creating rule:', error);
      alert(error instanceof Error ? error.message : 'Failed to create rule');
    }
  };

  const updateRule = async (ruleId: number) => {
    if (!editingRule) return;

    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/scoring-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: editingRule.rule_name,
          description: editingRule.description,
          points_value: editingRule.points_value,
          is_active: editingRule.is_active,
          applies_to: editingRule.applies_to,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update rule');
      }

      alert('Rule updated successfully!');
      setEditingRule(null);
      loadRules();
    } catch (error) {
      console.error('Error updating rule:', error);
      alert(error instanceof Error ? error.message : 'Failed to update rule');
    }
  };

  const deleteRule = async (ruleId: number, ruleName: string) => {
    if (!confirm(`Delete rule "${ruleName}"?`)) return;

    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/scoring-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete rule');
      }

      alert('Rule deleted successfully!');
      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete rule');
    }
  };

  const getRuleColor = (pointsValue: number) => {
    if (pointsValue > 0) return 'text-green-600 bg-green-50 border-green-200';
    if (pointsValue < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const commonRuleTypes = [
    { value: 'goals_scored', label: 'Goal Scored', icon: '⚽' },
    { value: 'clean_sheet', label: 'Clean Sheet', icon: '🛡️' },
    { value: 'goals_conceded', label: 'Goal Conceded', icon: '🥅' },
    { value: 'motm', label: 'Man of the Match', icon: '⭐' },
    { value: 'win', label: 'Win', icon: '✅' },
    { value: 'draw', label: 'Draw', icon: '🤝' },
    { value: 'loss', label: 'Loss', icon: '❌' },
    { value: 'fine_goals', label: 'Fine Goals', icon: '💸' },
    { value: 'substitution_penalty', label: 'Substitution Penalty', icon: '🔄' },
    { value: 'hat_trick', label: 'Hat-trick (3+ goals)', icon: '🎩' },
    { value: 'brace', label: 'Brace (2 goals)', icon: '⚽⚽' },
    { value: 'golden_boot', label: 'Golden Boot Award', icon: '👢' },
    { value: 'best_attacker', label: 'Best Attacker Award', icon: '⚔️' },
    { value: 'custom', label: 'Custom Rule', icon: '📊' },
  ];

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to League Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Custom Scoring Rules</h1>
            <p className="text-gray-600 mt-1">Define how players earn points</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New Rule
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Scoring Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Name *</label>
                <input
                  type="text"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                  placeholder="e.g., Goal Bonus"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type *</label>
                <select
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select type...</option>
                  {commonRuleTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Points Value *</label>
                <input
                  type="number"
                  value={newRule.points_value}
                  onChange={(e) => setNewRule({ ...newRule, points_value: parseFloat(e.target.value) })}
                  placeholder="e.g., 10"
                  step="0.5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applies To</label>
                <select
                  value={newRule.applies_to}
                  onChange={(e) => setNewRule({ ...newRule, applies_to: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="player">Player</option>
                  <option value="team">Team</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Optional description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Bonus Rule Toggle */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRule.is_bonus_rule}
                    onChange={(e) => setNewRule({ ...newRule, is_bonus_rule: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">🎁 This is a Bonus/Conditional Rule</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">Enable this for special conditions like new player bonus, streak bonus, etc.</p>
              </div>
              
              {/* Conditional Fields for Bonus Rules */}
              {newRule.is_bonus_rule && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bonus Condition Type *</label>
                    <select
                      value={newRule.bonus_condition_type}
                      onChange={(e) => setNewRule({ ...newRule, bonus_condition_type: e.target.value, bonus_params: {} })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select condition...</option>
                      <option value="new_player">🆕 New Player Bonus (first X matches)</option>
                      <option value="streak">🔥 Streak Bonus (consecutive events)</option>
                      <option value="milestone">🎯 Milestone Bonus (reach X goals/assists)</option>
                      <option value="match_result">🏆 Match Result Bonus (win/draw/loss)</option>
                      <option value="comeback">💪 Comeback Bonus (winning after being behind)</option>
                      <option value="clean_sheet_streak">🛡️ Clean Sheet Streak (consecutive clean sheets)</option>
                      <option value="goal_difference">⚡ Goal Difference Bonus (winning by X+ goals)</option>
                      <option value="against_top_team">👑 Top Team Bonus (performance vs top teams)</option>
                      <option value="captain_bonus">©️ Captain/Vice Captain Bonus (multiplier)</option>
                    </select>
                  </div>
                  
                  {/* New Player Bonus Fields */}
                  {newRule.bonus_condition_type === 'new_player' && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First X Matches</label>
                        <input
                          type="number"
                          value={newRule.bonus_params.matches_count || 1}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, matches_count: parseInt(e.target.value) } })}
                          min="1"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Since Gameweek (optional)</label>
                        <input
                          type="number"
                          value={newRule.bonus_params.since_gameweek || ''}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, since_gameweek: e.target.value ? parseInt(e.target.value) : null } })}
                          placeholder="e.g., 5"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Streak Bonus Fields */}
                  {newRule.bonus_condition_type === 'streak' && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                        <select
                          value={newRule.bonus_params.event_type || 'goal'}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, event_type: e.target.value } })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="goal">Goals</option>
                          <option value="assist">Assists</option>
                          <option value="clean_sheet">Clean Sheets</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Consecutive Matches</label>
                        <input
                          type="number"
                          value={newRule.bonus_params.consecutive_matches || 3}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, consecutive_matches: parseInt(e.target.value) } })}
                          min="2"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Milestone Bonus Fields */}
                  {newRule.bonus_condition_type === 'milestone' && (
                    <div className="md:col-span-2 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                        <select
                          value={newRule.bonus_params.event_type || 'goal'}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, event_type: e.target.value } })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="goal">Goals</option>
                          <option value="assist">Assists</option>
                          <option value="clean_sheet">Clean Sheets</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Count</label>
                        <input
                          type="number"
                          value={newRule.bonus_params.count || 10}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, count: parseInt(e.target.value) } })}
                          min="1"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
                        <select
                          value={newRule.bonus_params.scope || 'season'}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, scope: e.target.value } })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="season">Season</option>
                          <option value="tournament">Tournament</option>
                        </select>
                      </div>
                    </div>
                  )}
                  
                  {/* Match Result Bonus Fields */}
                  {newRule.bonus_condition_type === 'match_result' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Result Type</label>
                      <select
                        value={newRule.bonus_params.result_type || 'win'}
                        onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, result_type: e.target.value } })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="win">Team Wins</option>
                        <option value="draw">Team Draws</option>
                        <option value="loss">Team Loses</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">All players get this bonus if their team achieves this result</p>
                    </div>
                  )}
                  
                  {/* Comeback Bonus Fields */}
                  {newRule.bonus_condition_type === 'comeback' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Goals Behind</label>
                      <input
                        type="number"
                        value={newRule.bonus_params.goals_behind || 1}
                        onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, goals_behind: parseInt(e.target.value) } })}
                        min="1"
                        placeholder="e.g., 1 or 2"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Bonus applied when team wins after being this many goals behind</p>
                    </div>
                  )}
                  
                  {/* Clean Sheet Streak Fields */}
                  {newRule.bonus_condition_type === 'clean_sheet_streak' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Consecutive Clean Sheets</label>
                      <input
                        type="number"
                        value={newRule.bonus_params.consecutive_count || 3}
                        onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, consecutive_count: parseInt(e.target.value) } })}
                        min="2"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Bonus for defenders/goalkeeper when team achieves consecutive clean sheets</p>
                    </div>
                  )}
                  
                  {/* Goal Difference Bonus Fields */}
                  {newRule.bonus_condition_type === 'goal_difference' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Goal Difference</label>
                      <input
                        type="number"
                        value={newRule.bonus_params.min_difference || 3}
                        onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, min_difference: parseInt(e.target.value) } })}
                        min="2"
                        placeholder="e.g., 3 for winning 4-1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Bonus when team wins by X or more goals</p>
                    </div>
                  )}
                  
                  {/* Against Top Team Fields */}
                  {newRule.bonus_condition_type === 'against_top_team' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Top Teams (Rankings)</label>
                      <input
                        type="number"
                        value={newRule.bonus_params.top_rank || 3}
                        onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, top_rank: parseInt(e.target.value) } })}
                        min="1"
                        placeholder="e.g., 3 for top 3 teams"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Bonus for scoring/assisting against teams in top X positions</p>
                    </div>
                  )}
                  
                  {/* Captain Bonus Fields */}
                  {newRule.bonus_condition_type === 'captain_bonus' && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Captain Multiplier</label>
                        <input
                          type="number"
                          value={newRule.bonus_params.captain_multiplier || 2}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, captain_multiplier: parseFloat(e.target.value) } })}
                          min="1"
                          step="0.5"
                          placeholder="e.g., 2 for double points"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Vice Captain Multiplier</label>
                        <input
                          type="number"
                          value={newRule.bonus_params.vice_captain_multiplier || 1.5}
                          onChange={(e) => setNewRule({ ...newRule, bonus_params: { ...newRule.bonus_params, vice_captain_multiplier: parseFloat(e.target.value) } })}
                          min="1"
                          step="0.5"
                          placeholder="e.g., 1.5 for 1.5x points"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="md:col-span-2 text-xs text-gray-500">Multiply points for captain and vice-captain</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={createRule}
                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Rule
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Active Rules</h2>
          
          {rules.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No scoring rules yet. Create your first rule!</p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.rule_id}
                  className={`flex items-center justify-between p-4 border-2 rounded-xl transition-all ${
                    editingRule?.rule_id === rule.rule_id
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {editingRule?.rule_id === rule.rule_id ? (
                    // Edit Mode
                    <>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={editingRule.rule_name}
                          onChange={(e) => setEditingRule({ ...editingRule, rule_name: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="number"
                          value={editingRule.points_value}
                          onChange={(e) => setEditingRule({ ...editingRule, points_value: parseFloat(e.target.value) })}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                          step="0.5"
                        />
                        <select
                          value={editingRule.applies_to}
                          onChange={(e) => setEditingRule({ ...editingRule, applies_to: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="player">Player</option>
                          <option value="team">Team</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => updateRule(rule.rule_id)}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingRule(null)}
                          className="p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">{rule.rule_name}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getRuleColor(rule.points_value)}`}>
                            {rule.points_value > 0 ? '+' : ''}{rule.points_value} pts
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {rule.applies_to}
                          </span>
                          {!rule.is_active && (
                            <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-sm text-gray-600">{rule.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Type: {rule.rule_type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingRule(rule)}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.rule_id, rule.rule_name)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How Scoring Rules Work:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Create custom rules to define how players earn points</li>
            <li>• Positive values add points, negative values deduct them</li>
            <li>• Rules can apply to individual players, teams, or both</li>
            <li>• Common types: goals, assists, clean sheets, team wins, cards, etc.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
