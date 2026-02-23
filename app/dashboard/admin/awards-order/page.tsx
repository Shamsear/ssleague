'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AwardItem {
  id: string;
  type: 'award' | 'player_award' | 'trophy';
  title: string;
  subtitle: string;
  season_id: string;
  display_order: number;
  date: string;
  round_number?: number;
  week_number?: number;
  instagram_link?: string;
  meta?: string;
}

export default function AwardsOrderPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AwardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user, selectedSeason]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSeason !== 'all') {
        params.append('season_id', selectedSeason);
      }
      
      const res = await fetch(`/api/admin/awards-order?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setItems(data.items || []);
        setSeasons(data.seasons || []);
        // Auto-expand the selected season
        if (selectedSeason !== 'all') {
          setExpandedSeasons(new Set([selectedSeason]));
        } else {
          // Expand first season by default
          if (data.seasons && data.seasons.length > 0) {
            setExpandedSeasons(new Set([data.seasons[0]]));
          }
        }
      } else {
        setError(data.error || 'Failed to load items');
      }
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeason = (season: string) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(season)) {
      newExpanded.delete(season);
    } else {
      newExpanded.add(season);
    }
    setExpandedSeasons(newExpanded);
  };

  const expandAll = () => {
    setExpandedSeasons(new Set(seasons));
  };

  const collapseAll = () => {
    setExpandedSeasons(new Set());
  };

  // Group items by season
  const itemsBySeason = items.reduce((acc, item) => {
    if (!acc[item.season_id]) {
      acc[item.season_id] = [];
    }
    acc[item.season_id].push(item);
    return acc;
  }, {} as Record<string, AwardItem[]>);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    
    // Only allow reordering within the same season
    if (draggedItem.season_id !== newItems[index].season_id) {
      return;
    }

    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const updates = items.map((item, index) => ({
        id: item.id,
        type: item.type,
        display_order: index
      }));

      const res = await fetch('/api/admin/awards-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      const data = await res.json();
      
      if (data.success) {
        setSuccess('✅ Order saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save order');
      }
    } catch (err) {
      console.error('Error saving order:', err);
      setError('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const item = items[index];
    const seasonItems = items.filter(i => i.season_id === item.season_id);
    const seasonStartIndex = items.findIndex(i => i.season_id === item.season_id);
    const relativeIndex = index - seasonStartIndex;
    
    if (direction === 'up' && relativeIndex === 0) return;
    if (direction === 'down' && relativeIndex === seasonItems.length - 1) return;

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Only swap if target is in same season
    if (newItems[targetIndex].season_id !== item.season_id) return;
    
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  const moveToPosition = (absoluteIndex: number, newPosition: number) => {
    const item = items[absoluteIndex];
    const seasonItems = items.filter(i => i.season_id === item.season_id);
    const seasonStartIndex = items.findIndex(i => i.season_id === item.season_id);
    
    // Validate position (1-based, convert to 0-based)
    const targetRelativeIndex = newPosition - 1;
    if (targetRelativeIndex < 0 || targetRelativeIndex >= seasonItems.length) {
      setError(`Position must be between 1 and ${seasonItems.length}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Calculate absolute target index
    const targetAbsoluteIndex = seasonStartIndex + targetRelativeIndex;
    
    if (targetAbsoluteIndex === absoluteIndex) return; // Already in position

    // Remove item from current position and insert at new position
    const newItems = [...items];
    const [movedItem] = newItems.splice(absoluteIndex, 1);
    newItems.splice(targetAbsoluteIndex, 0, movedItem);
    
    setItems(newItems);
    setSuccess(`Moved to position ${newPosition}`);
    setTimeout(() => setSuccess(null), 2000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'award': return '⭐';
      case 'player_award': return '🏅';
      case 'trophy': return '🏆';
      default: return '🎖️';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'award': return 'bg-blue-100 text-blue-700';
      case 'player_award': return 'bg-purple-100 text-purple-700';
      case 'trophy': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            🎯 Manage Awards Display Order
          </h1>
          <p className="text-gray-600">
            Drag and drop to reorder how awards and trophies appear on the public awards page
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Season Filter */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Filter by Season</h3>
              <p className="text-sm text-gray-600">Select a season to manage its awards order</p>
            </div>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            >
              <option value="all">All Seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Save Button */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {items.length} items across {seasons.length} seasons
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all"
              >
                Collapse All
              </button>
              <button
                onClick={handleSaveOrder}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : '💾 Save Order'}
              </button>
            </div>
          </div>
        </div>

        {/* Items List - Grouped by Season */}
        {!loading && items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-lg text-center">
            <p className="text-gray-500 text-lg">No items found for this season</p>
          </div>
        ) : !loading && (
          <div className="space-y-4">
            {seasons.map((season) => {
              const seasonItems = itemsBySeason[season] || [];
              const isExpanded = expandedSeasons.has(season);
              const seasonStartIndex = items.findIndex(i => i.season_id === season);
              
              return (
                <div key={season} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  {/* Season Header */}
                  <button
                    onClick={() => toggleSeason(season)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg 
                        className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="text-xl font-bold text-gray-900">{season}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                        {seasonItems.length} items
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {isExpanded ? 'Click to collapse' : 'Click to expand'}
                    </div>
                  </button>

                  {/* Season Items */}
                  {isExpanded && (
                    <div className="p-4 space-y-3 bg-gray-50">
                      {seasonItems.map((item, relativeIndex) => {
                        const absoluteIndex = seasonStartIndex + relativeIndex;
                        const isFirst = relativeIndex === 0;
                        const isLast = relativeIndex === seasonItems.length - 1;
                        
                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            draggable
                            onDragStart={() => handleDragStart(absoluteIndex)}
                            onDragOver={(e) => handleDragOver(e, absoluteIndex)}
                            onDragEnd={handleDragEnd}
                            className={`bg-white rounded-lg p-4 shadow border-2 transition-all cursor-move hover:shadow-md ${
                              draggedIndex === absoluteIndex ? 'opacity-50 border-blue-500' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              {/* Drag Handle & Position Controls */}
                              <div className="flex flex-col gap-1 items-center">
                                <button
                                  onClick={() => moveItem(absoluteIndex, 'up')}
                                  disabled={isFirst}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                  title="Move up"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                
                                {/* Position Input */}
                                <input
                                  type="number"
                                  min="1"
                                  max={seasonItems.length}
                                  value={relativeIndex + 1}
                                  onChange={(e) => {
                                    const newPos = parseInt(e.target.value);
                                    if (!isNaN(newPos)) {
                                      moveToPosition(absoluteIndex, newPos);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-12 text-center text-xs font-bold text-gray-700 border-2 border-gray-300 rounded px-1 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                  title={`Enter position (1-${seasonItems.length})`}
                                />
                                
                                <button
                                  onClick={() => moveItem(absoluteIndex, 'down')}
                                  disabled={isLast}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                  title="Move down"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              {/* Image Preview */}
                              {item.instagram_link ? (
                                <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                                  <img 
                                    src={item.instagram_link}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      console.error('Image failed to load:', item.instagram_link);
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-red-200 text-xs text-red-600 font-semibold">Failed</div>';
                                      }
                                    }}
                                    onLoad={() => {
                                      console.log('Image loaded successfully:', item.instagram_link);
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 flex items-center justify-center">
                                  <span className="text-xs text-gray-500 font-semibold">No Image</span>
                                </div>
                              )}

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-bold text-gray-900 truncate">{item.title}</h3>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getTypeBadge(item.type)}`}>
                                    {item.type.replace('_', ' ')}
                                  </span>
                                  {item.round_number && (
                                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">
                                      Round {item.round_number}
                                    </span>
                                  )}
                                  {item.week_number && (
                                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">
                                      Week {item.week_number}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString()}</span>
                                  {item.meta && (
                                    <>
                                      <span className="text-xs text-gray-400">•</span>
                                      <span className="text-xs text-gray-500">{item.meta}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Drag Icon */}
                              <div className="text-gray-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
