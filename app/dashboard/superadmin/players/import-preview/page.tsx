'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PlayerData {
  player_id?: string;
  name: string;
  oldName?: string; // Current name in database
  isNew?: boolean;
}

interface ValidationError {
  rowType: string;
  rowIndex: number;
  field: string;
  message: string;
}

export default function PlayersImportPreview() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [newPlayers, setNewPlayers] = useState<PlayerData[]>([]);
  const [updatedPlayers, setUpdatedPlayers] = useState<PlayerData[]>([]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    
    // Load player names from sessionStorage
    const storedPlayers = sessionStorage.getItem('importPlayers');
    if (!storedPlayers) {
      alert('No import data found. Please upload a file first.');
      router.push('/dashboard/superadmin/players');
      return;
    }
    
    // Wrap async logic in an async function
    const loadPlayers = async () => {
      try {
        const players: Array<{ player_id?: string; name: string }> = JSON.parse(storedPlayers);
        
        // Separate new players (no player_id) from updates (has player_id)
        const newPlayersList: PlayerData[] = [];
        const updatedPlayersList: PlayerData[] = [];
        
        // Fetch current player data for updates
        const { db } = await import('@/lib/firebase/config');
        const { doc, getDoc } = await import('firebase/firestore');
        
        for (const player of players) {
          if (player.player_id && player.player_id.trim()) {
            // Existing player - this is an update, fetch current name
            try {
              const playerDoc = await getDoc(doc(db, 'realplayers', player.player_id));
              const oldName = playerDoc.exists() ? playerDoc.data().name : 'Unknown';
              
              updatedPlayersList.push({
                player_id: player.player_id,
                name: player.name,
                oldName: oldName,
                isNew: false
              });
            } catch (error) {
              console.error(`Error fetching player ${player.player_id}:`, error);
              updatedPlayersList.push({
                player_id: player.player_id,
                name: player.name,
                oldName: 'Error loading',
                isNew: false
              });
            }
          } else {
            // No player_id - this is a new player
            newPlayersList.push({
              name: player.name,
              isNew: true
            });
          }
        }
        
        setNewPlayers(newPlayersList);
        setUpdatedPlayers(updatedPlayersList);
        setDataLoading(false);
      } catch (error) {
        console.error('Error parsing player data:', error);
        alert('Failed to load player data');
        router.push('/dashboard/superadmin/players');
      }
    };
    
    // Execute the async function
    loadPlayers();
  }, [user, authLoading, router]);

  const validateCell = (value: any, field: string, required: boolean): string | null => {
    if (required && (!value || value.toString().trim() === '')) {
      return `${field} is required`;
    }
    return null;
  };

  const handleCellChange = (
    type: 'new' | 'updated',
    index: number,
    field: keyof PlayerData,
    value: any
  ) => {
    if (type === 'new') {
      const players = [...newPlayers];
      (players[index] as any)[field] = value;
      setNewPlayers(players);
    } else {
      const players = [...updatedPlayers];
      (players[index] as any)[field] = value;
      setUpdatedPlayers(players);
    }
    
    // Clear validation error for this cell
    const errorKey = `${type}-${index}-${field}`;
    const newErrors = new Set(validationErrors);
    newErrors.delete(errorKey);
    setValidationErrors(newErrors);
  };

  const handleRemovePlayer = (type: 'new' | 'updated', index: number) => {
    if (confirm('Remove this player from the import?')) {
      if (type === 'new') {
        setNewPlayers(newPlayers.filter((_, i) => i !== index));
      } else {
        setUpdatedPlayers(updatedPlayers.filter((_, i) => i !== index));
      }
    }
  };

  const validateAll = () => {
    const errors = new Set<string>();
    
    newPlayers.forEach((player, index) => {
      const nameError = validateCell(player.name, 'name', true);
      if (nameError) errors.add(`new-${index}-name`);
    });
    
    updatedPlayers.forEach((player, index) => {
      const nameError = validateCell(player.name, 'name', true);
      if (nameError) errors.add(`updated-${index}-name`);
    });
    
    setValidationErrors(errors);
    return errors.size === 0;
  };

  const handleStartImport = async () => {
    if (!validateAll()) {
      alert('Please fix all validation errors before importing.');
      return;
    }
    
    if (newPlayers.length === 0 && updatedPlayers.length === 0) {
      alert('No players to import.');
      return;
    }
    
    const confirmMessage = `You are about to:\n` +
      `- Add ${newPlayers.length} new player(s)\n` +
      `- Update ${updatedPlayers.length} existing player(s)\n\n` +
      `Total: ${newPlayers.length + updatedPlayers.length} operation(s)\n\n` +
      `Continue with import?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setImporting(true);
    
    try {
      // Import Firestore functions
      const { db } = await import('@/lib/firebase/config');
      const { doc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      // Process new players
      for (const player of newPlayers) {
        try {
          // Generate player_id
          // Get the last player ID to determine the next ID
          const playersRef = collection(db, 'realplayers');
          const q = query(playersRef, orderBy('player_id', 'desc'), limit(1));
          const snapshot = await getDocs(q);
          
          let nextIdNumber = 1;
          if (!snapshot.empty) {
            const lastPlayerId = snapshot.docs[0].data().player_id;
            // Extract number from format sspslpsl001
            const match = lastPlayerId.match(/\d+$/);
            if (match) {
              nextIdNumber = parseInt(match[0]) + 1;
            }
          }
          
          const newPlayerId = `sspslpsl${nextIdNumber.toString().padStart(3, '0')}`;
          
          // Create new player document
          await setDoc(doc(db, 'realplayers', newPlayerId), {
            player_id: newPlayerId,
            name: player.name.trim(),
            is_registered: false,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            created_by: user?.uid || 'system',
          });
          
          successCount++;
        } catch (error) {
          console.error(`Error creating player ${player.name}:`, error);
          errorCount++;
          errors.push(`Failed to create: ${player.name}`);
        }
      }
      
      // Process updated players
      for (const player of updatedPlayers) {
        try {
          if (!player.player_id) continue;
          
          // Update existing player document
          await updateDoc(doc(db, 'realplayers', player.player_id), {
            name: player.name.trim(),
            updated_at: serverTimestamp(),
            updated_by: user?.uid || 'system',
          });
          
          successCount++;
        } catch (error) {
          console.error(`Error updating player ${player.player_id}:`, error);
          errorCount++;
          errors.push(`Failed to update: ${player.name} (${player.player_id})`);
        }
      }
      
      // Clear sessionStorage
      sessionStorage.removeItem('importPlayers');
      
      // Show results
      let message = `Import completed!\n\n`;
      message += `✓ Successfully processed: ${successCount} player(s)\n`;
      if (errorCount > 0) {
        message += `✗ Failed: ${errorCount} player(s)\n\n`;
        message += `Errors:\n${errors.join('\n')}`;
      }
      
      alert(message);
      
      // Redirect back to players page
      router.push('/dashboard/superadmin/players');
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImporting(false);
    }
  };

  const totalOperations = newPlayers.length + updatedPlayers.length;

  if (authLoading || dataLoading) {
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

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">👥 Player Import Preview</h1>
              <p className="text-gray-600 text-sm md:text-base">Review and edit players before importing to database</p>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard/superadmin/players')}
                className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Database
              </button>
            </div>
          </div>
        </div>

        {/* Import Summary */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{newPlayers.length}</div>
              <div className="text-sm text-gray-600">New Players</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{updatedPlayers.length}</div>
              <div className="text-sm text-gray-600">Updates</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#0066FF]">{totalOperations}</div>
              <div className="text-sm text-gray-600">Total Operations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">CSV</div>
              <div className="text-sm text-gray-600">Data Source</div>
            </div>
          </div>
        </div>

        {/* Validation Status */}
        <div className={`glass rounded-3xl p-4 mb-6 shadow-lg backdrop-blur-md border border-white/20 ${validationErrors.size > 0 ? 'bg-red-50/30' : 'bg-blue-50/30'}`}>
          <div className="flex items-center">
            <svg className={`w-5 h-5 mr-2 ${validationErrors.size > 0 ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm ${validationErrors.size > 0 ? 'text-red-800' : 'text-blue-800'}`}>
              {validationErrors.size > 0 
                ? `${validationErrors.size} validation error(s) found. Please fix them before importing.`
                : 'Click on any cell to edit player data. Changes are automatically validated.'}
            </span>
          </div>
        </div>

        {/* New Players Table */}
        {newPlayers.length > 0 && (
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
            <div className="px-6 py-5 bg-gradient-to-r from-green-50/50 to-green-100/50 border-b border-green-200/50">
              <h3 className="text-xl font-semibold text-green-700 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Players ({newPlayers.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-16">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Player Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {newPlayers.map((player, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => handleCellChange('new', index, 'name', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 text-gray-800 ${
                            validationErrors.has(`new-${index}-name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Player name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer('new', index)}
                          className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Remove from import"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Updated Players Table */}
        {updatedPlayers.length > 0 && (
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-50/50 to-blue-100/50 border-b border-blue-200/50">
              <h3 className="text-xl font-semibold text-blue-700 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Player Updates ({updatedPlayers.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-16">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Player ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Current Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">New Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {updatedPlayers.map((player, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-blue-600 font-medium">{player.player_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-500 italic">{player.oldName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={player.name}
                            onChange={(e) => handleCellChange('updated', index, 'name', e.target.value)}
                            className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 text-gray-800 font-medium ${
                              validationErrors.has(`updated-${index}-name`) ? 'border-red-500 bg-red-50' : ''
                            } ${
                              player.oldName !== player.name ? 'bg-green-50' : ''
                            }`}
                            placeholder="New player name"
                          />
                          {player.oldName !== player.name && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer('updated', index)}
                          className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Remove from import"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Actions */}
        <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Ready to Import</h3>
              <p className="text-sm text-gray-600">Review your changes and start the import process</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={validateAll}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validate All
              </button>
              <button
                onClick={handleStartImport}
                disabled={importing || validationErrors.size > 0}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 hover:from-[#0066FF]/90 hover:to-[#0066FF]/70 text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Preparing Import...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Start Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
