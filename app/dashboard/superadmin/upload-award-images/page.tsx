'use client';

import { useState, useEffect } from 'react';

interface Award {
  id: string;
  award_type: string;
  player_name?: string;
  team_name?: string;
  round_number?: number;
  week_number?: number;
  season_id?: string;
  instagram_link?: string;
  instagram_post_url?: string;
}

interface PlayerAward {
  id: string;
  award_type: string;
  player_name: string;
  award_position?: string;
  season_id?: string;
  instagram_link?: string;
  instagram_post_url?: string;
}

interface Trophy {
  id: string;
  trophy_name: string;
  team_name: string;
  trophy_type: string;
  season_id?: string;
  instagram_link?: string;
  instagram_post_url?: string;
}

export default function UploadAwardImagesPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [instagramPostUrl, setInstagramPostUrl] = useState<string>('');
  
  // Award selection
  const [awardType, setAwardType] = useState<'award' | 'player_award' | 'trophy'>('award');
  const [awards, setAwards] = useState<Award[]>([]);
  const [playerAwards, setPlayerAwards] = useState<PlayerAward[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  // Fetch awards on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [awardsRes, playerAwardsRes, trophiesRes] = await Promise.all([
        fetch('/api/awards'),
        fetch('/api/player-awards'),
        fetch('/api/trophies')
      ]);

      const [awardsData, playerAwardsData, trophiesData] = await Promise.all([
        awardsRes.json(),
        playerAwardsRes.json(),
        trophiesRes.json()
      ]);

      const allAwards = Array.isArray(awardsData.data) ? awardsData.data : [];
      const allPlayerAwards = Array.isArray(playerAwardsData.awards) ? playerAwardsData.awards : [];
      const allTrophies = Array.isArray(trophiesData.trophies) ? trophiesData.trophies : [];

      if (awardsData.success) setAwards(allAwards);
      if (playerAwardsData.success) setPlayerAwards(allPlayerAwards);
      if (trophiesData.success) setTrophies(allTrophies);

      // Extract unique seasons from all sources
      const seasonSet = new Set<string>();
      allAwards.forEach((a: any) => a.season_id && seasonSet.add(a.season_id));
      allPlayerAwards.forEach((a: any) => a.season_id && seasonSet.add(a.season_id));
      allTrophies.forEach((t: any) => t.season_id && seasonSet.add(t.season_id));
      
      if (seasonSet.size > 0) {
        const uniqueSeasons = Array.from(seasonSet).sort().reverse();
        setSeasons(uniqueSeasons);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get current image for selected item
  const getCurrentImage = () => {
    if (!selectedItemId) return null;
    
    // Convert selectedItemId to number for comparison (since DB returns numbers)
    const numericId = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
    
    if (awardType === 'award') {
      const award = awards.find(a => a.id == numericId);
      return award?.instagram_link || null;
    } else if (awardType === 'player_award') {
      const award = playerAwards.find(a => a.id == numericId);
      return award?.instagram_link || null;
    } else if (awardType === 'trophy') {
      const trophy = trophies.find(t => t.id == numericId);
      return trophy?.instagram_link || null;
    }
    return null;
  };

  // Get current Instagram post URL for selected item
  const getCurrentInstagramUrl = () => {
    if (!selectedItemId) return null;
    
    // Convert selectedItemId to number for comparison (since DB returns numbers)
    const numericId = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
    
    if (awardType === 'award') {
      const award = awards.find(a => a.id == numericId);
      return award?.instagram_post_url || null;
    } else if (awardType === 'player_award') {
      const award = playerAwards.find(a => a.id == numericId);
      return award?.instagram_post_url || null;
    } else if (awardType === 'trophy') {
      const trophy = trophies.find(t => t.id == numericId);
      return trophy?.instagram_post_url || null;
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadedUrl('');
      setMessage(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    if (!selectedItemId) {
      setMessage({ type: 'error', text: 'Please select an award/trophy' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Upload image
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/upload-award-image', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      const imageUrl = uploadData.url;
      setUploadedUrl(imageUrl);
      
      // Show duplicate message if applicable
      if (uploadData.isDuplicate) {
        setMessage({ 
          type: 'success', 
          text: '⚠️ This image already exists in ImageKit. Using existing file to avoid duplicates.' 
        });
      }

      // Update database
      let updateEndpoint = '';
      let updateBody: any = { 
        instagram_link: imageUrl,
        instagram_post_url: instagramPostUrl || null
      };

      if (awardType === 'award') {
        updateEndpoint = `/api/awards/${selectedItemId}`;
      } else if (awardType === 'player_award') {
        updateEndpoint = `/api/player-awards/${selectedItemId}`;
      } else if (awardType === 'trophy') {
        updateEndpoint = `/api/trophies/${selectedItemId}`;
      }

      const updateResponse = await fetch(updateEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });

      const updateResult = await updateResponse.json();

      if (updateResult.success) {
        setMessage({ type: 'success', text: 'Image uploaded and linked successfully!' });
        // Refresh data
        await fetchAllData();
      } else {
        setMessage({ type: 'success', text: `Image uploaded to ${imageUrl}, but auto-link failed. Please update manually.` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard!' });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏆 Upload Award Images
          </h1>
          <p className="text-gray-600">
            Upload images for awards, trophies, and player achievements
          </p>
        </div>

        {/* Award Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Select Award/Trophy
          </h2>

          {/* Season Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Season (optional filter):
            </label>
            <select
              value={selectedSeason}
              onChange={(e) => {
                setSelectedSeason(e.target.value);
                setSelectedItemId('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>

          {/* Award Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type:
            </label>
            <select
              value={awardType}
              onChange={(e) => {
                setAwardType(e.target.value as any);
                setSelectedItemId('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="award">Awards (POTD, POTW, POTS, TOTS)</option>
              <option value="player_award">Player Awards (Golden Boot, Best Player)</option>
              <option value="trophy">Trophies</option>
            </select>
          </div>

          {/* Item Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Item:
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                // Clear preview and file when changing selection
                setSelectedFile(null);
                setPreview('');
                setUploadedUrl('');
                setMessage(null);
                // Load existing Instagram URL if available
                const currentUrl = getCurrentInstagramUrl();
                setInstagramPostUrl(currentUrl || '');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select {awardType === 'award' ? 'Award' : awardType === 'player_award' ? 'Player Award' : 'Trophy'} --</option>
              {awardType === 'award' && Array.isArray(awards) && awards
                .filter(award => !selectedSeason || award.season_id === selectedSeason)
                .map((award) => (
                <option key={award.id} value={award.id}>
                  {award.instagram_link ? '📸 ' : '⬜ '}
                  {award.award_type} - {award.player_name || award.team_name} 
                  {award.round_number ? ` (Round ${award.round_number})` : ''}
                  {award.week_number ? ` (Week ${award.week_number})` : ''}
                  {!selectedSeason ? ` [${award.season_id}]` : ''}
                </option>
              ))}
              {awardType === 'player_award' && Array.isArray(playerAwards) && playerAwards
                .filter(award => !selectedSeason || award.season_id === selectedSeason)
                .map((award) => (
                <option key={award.id} value={award.id}>
                  {award.instagram_link ? '📸 ' : '⬜ '}
                  {award.award_type} - {award.player_name} {award.award_position ? `(${award.award_position})` : ''}
                  {!selectedSeason ? ` [${award.season_id}]` : ''}
                </option>
              ))}
              {awardType === 'trophy' && Array.isArray(trophies) && trophies
                .filter(trophy => !selectedSeason || trophy.season_id === selectedSeason)
                .map((trophy) => (
                <option key={trophy.id} value={trophy.id}>
                  {trophy.instagram_link ? '📸 ' : '⬜ '}
                  {trophy.trophy_name} - {trophy.team_name} ({trophy.trophy_type})
                  {!selectedSeason ? ` [${trophy.season_id}]` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Image
          </h2>

          {/* Show current image if it exists */}
          {selectedItemId && getCurrentImage() && !preview && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">📸 Current Image:</p>
              <div className="relative group">
                <img
                  src={getCurrentImage()!}
                  alt="Current award image"
                  className="w-full max-w-md mx-auto rounded-lg shadow-md border-2 border-gray-300"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <p className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm font-semibold">
                    Click below to replace
                  </p>
                </div>
              </div>
              {getCurrentInstagramUrl() && (
                <div className="mt-2 text-center">
                  <a
                    href={getCurrentInstagramUrl()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    🔗 {getCurrentInstagramUrl()}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* File Input */}
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {preview ? (
                  <img src={preview} alt="Preview" className="max-h-52 rounded-lg" />
                ) : (
                  <>
                    <svg
                      className="w-12 h-12 mb-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, WEBP (MAX. 10MB)</p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Selected file:</span> {selectedFile.name}
              </p>
              <p className="text-sm text-gray-600">
                Size: {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          {/* Instagram Post URL (Optional) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instagram Post Link (optional):
            </label>
            <input
              type="url"
              value={instagramPostUrl}
              onChange={(e) => setInstagramPostUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/POST_ID/"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              When users click the image, they'll be redirected to this Instagram post
            </p>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedItemId || uploading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition ${
              !selectedFile || !selectedItemId || uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : getCurrentImage() ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {uploading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {getCurrentImage() ? 'Replacing...' : 'Uploading...'}
              </span>
            ) : (
              getCurrentImage() ? '🔄 Replace Image' : '📤 Upload Image'
            )}
          </button>

          {/* Message */}
          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Result Section */}
        {uploadedUrl && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              ✅ Upload Successful!
            </h2>

            {/* Preview */}
            <div className="mb-6">
              <img
                src={uploadedUrl}
                alt="Uploaded"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>

            {/* URL to use */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL (use this in database):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={uploadedUrl}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(uploadedUrl)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* SQL Examples */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">SQL Examples:</p>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">For Awards:</p>
                    <code className="block bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                      UPDATE awards SET instagram_link = '{uploadedUrl}' WHERE id = 'award_id';
                    </code>
                    <button
                      onClick={() => copyToClipboard(`UPDATE awards SET instagram_link = '${uploadedUrl}' WHERE id = 'award_id';`)}
                      className="mt-1 text-blue-600 hover:underline text-xs"
                    >
                      Copy SQL
                    </button>
                  </div>

                  <div>
                    <p className="text-gray-600 mb-1">For Player Awards:</p>
                    <code className="block bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                      UPDATE player_awards SET instagram_link = '{uploadedUrl}' WHERE id = 'award_id';
                    </code>
                    <button
                      onClick={() => copyToClipboard(`UPDATE player_awards SET instagram_link = '${uploadedUrl}' WHERE id = 'award_id';`)}
                      className="mt-1 text-blue-600 hover:underline text-xs"
                    >
                      Copy SQL
                    </button>
                  </div>

                  <div>
                    <p className="text-gray-600 mb-1">For Trophies:</p>
                    <code className="block bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                      UPDATE team_trophies SET instagram_link = '{uploadedUrl}' WHERE id = 'trophy_id';
                    </code>
                    <button
                      onClick={() => copyToClipboard(`UPDATE team_trophies SET instagram_link = '${uploadedUrl}' WHERE id = 'trophy_id';`)}
                      className="mt-1 text-blue-600 hover:underline text-xs"
                    >
                      Copy SQL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
