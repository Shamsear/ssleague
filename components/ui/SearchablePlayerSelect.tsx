'use client';

import { useState, useRef, useEffect } from 'react';

interface Player {
  id: string;
  player_id: string;
  player_name: string;
  team_name?: string;
  auction_value: number;
  star_rating: number;
  type?: 'real' | 'football';
}

interface SearchablePlayerSelectProps {
  players: Player[];
  value: string;
  onChange: (playerId: string) => void;
  placeholder?: string;
  label: string;
  disabled?: boolean;
  color?: 'blue' | 'purple' | 'orange';
  showValueAs?: 'currency' | 'rating';
}

export default function SearchablePlayerSelect({
  players,
  value,
  onChange,
  placeholder = 'Search player...',
  label,
  disabled = false,
  color = 'blue'
}: SearchablePlayerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPlayer = players.find(p => p.id === value);

  const filteredPlayers = players.filter(p => 
    p.player_name.toLowerCase().includes(search.toLowerCase()) ||
    p.team_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside or scrolling outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = (event: Event) => {
      // Only close if scrolling outside the dropdown
      if (isOpen) {
        const target = event.target;
        // Check if target is an HTMLElement and has closest method
        if (target instanceof HTMLElement) {
          // Check if the scroll is happening inside the dropdown
          if (!target.closest('.searchable-dropdown') && !target.closest('.dropdown-scroll-container')) {
            setIsOpen(false);
          }
        } else if (target === window || target === document) {
          // Window or document scroll - close the dropdown
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const colorClasses = {
    blue: {
      border: 'border-blue-500',
      ring: 'ring-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-50'
    },
    purple: {
      border: 'border-purple-500',
      ring: 'ring-purple-500',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      hover: 'hover:bg-purple-50'
    },
    orange: {
      border: 'border-orange-500',
      ring: 'ring-orange-500',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      hover: 'hover:bg-orange-50'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
      </label>

      {/* Selected Player Display / Search Input */}
      <div
        className={`w-full px-4 py-3 rounded-xl border-2 ${
          isOpen ? `${colors.border} ${colors.ring} ring-2` : 'border-gray-300'
        } bg-white cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
      >
        {selectedPlayer ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">{selectedPlayer.player_name}</div>
              <div className="text-xs text-gray-500">
                {selectedPlayer.team_name} • ${selectedPlayer.auction_value} • {selectedPlayer.star_rating > 20 ? `OVR: ${selectedPlayer.star_rating}` : `${selectedPlayer.star_rating}⭐`}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="text-gray-400">{placeholder}</div>
        )}
      </div>

      {/* Dropdown - Fixed positioning to avoid clipping */}
      {isOpen && (
        <div 
          className="searchable-dropdown fixed z-[9999] bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden"
          style={{
            top: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().bottom + 8 : 0,
            left: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().left : 0,
            width: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().width : 'auto',
            maxHeight: '400px'
          }}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-xs text-gray-500 mt-1">
              {search ? `Found ${filteredPlayers.length} of ${players.length}` : `${players.length} players available`}
            </div>
          </div>

          {/* Player List */}
          <div className="dropdown-scroll-container overflow-y-auto" style={{ maxHeight: '320px' }}>
            {filteredPlayers.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No players found
              </div>
            ) : (
              filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  onClick={() => {
                    onChange(player.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`p-3 cursor-pointer transition-colors ${
                    player.id === value ? colors.bg : 'hover:bg-gray-50'
                  } border-b border-gray-100 last:border-b-0`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={`font-semibold ${player.id === value ? colors.text : 'text-gray-900'}`}>
                        {player.player_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {player.team_name}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-sm font-semibold text-gray-700">
                        ${player.auction_value}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.star_rating > 20 ? `OVR: ${player.star_rating}` : `${player.star_rating}⭐`}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
