'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ImportHistoricalSeason() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seasonNumber, setSeasonNumber] = useState('');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    if (!seasonNumber.trim() || isNaN(parseInt(seasonNumber))) {
      alert('Please enter a valid season number (e.g., 12)');
      return;
    }

    // Validate file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      alert('Please upload a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('seasonNumber', seasonNumber.trim());
      
      const response = await fetch('/api/seasons/historical/upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      // Store the parsed data in localStorage for the preview page
      localStorage.setItem('seasonUploadData', JSON.stringify(result.data));
      
      // Redirect to preview page
      router.push('/dashboard/superadmin/historical-seasons/preview');
      
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      
      const response = await fetch('/api/seasons/historical/template');
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SS_League_Historical_Season_Template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template. Please try again.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  if (loading) {
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
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/superadmin/historical-seasons')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Import Historical Season</h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base ml-14">Upload season data from Excel or CSV file</p>
        </header>

        {/* Instructions Section */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6">📋 Import Instructions</h2>
          
          <div className="bg-blue-50/50 rounded-lg p-4 mb-6 border border-blue-100">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800 mb-2"><strong>File Format Requirements:</strong></p>
                <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>Teams Sheet (League Table):</strong> rank, team, owner_name, p (points), mp (matches played), w (wins), d (draws), l (losses), f (goals for), a (goals against), gd (goal difference), percentage, cup (optional)</li>
                  <li><strong>Players Sheet:</strong> name, team, category, goals_scored, goals_per_game, goals_conceded, conceded_per_game, net_goals, cleansheets, points, win, draw, loss, total_matches, total_points</li>
                  <li><strong>Supported formats:</strong> Excel (.xlsx, .xls) with exactly two sheets: Teams and Players</li>
                  <li><strong>Season ID:</strong> Only season number is needed (e.g., 12 → creates ID: SSPSLS12)</li>
                  <li><strong>Note:</strong> All fields are mandatory except CUP in Teams sheet. Download the template below for correct format and sample data</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Download Template Button */}
          <div className="mb-6">
            <button
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloadingTemplate ? (
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              )}
              {isDownloadingTemplate ? 'Downloading...' : 'Download Excel Template with Sample Data'}
            </button>
          </div>
        </div>

        {/* Season Details Form */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6">Season Number</h2>
          
          <div>
            <label htmlFor="season_number" className="block text-sm font-medium text-gray-700 mb-2">
              Season Number *
              <span className="text-xs text-gray-500 ml-2">(will create ID: SSPSLS##)</span>
            </label>
            <input
              type="number"
              id="season_number"
              value={seasonNumber}
              onChange={(e) => setSeasonNumber(e.target.value)}
              required
              min="1"
              max="999"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
              placeholder="e.g., 12 (will create ID: SSPSLS12)"
            />
            <p className="mt-1 text-xs text-gray-500">
              💡 This number will be used to create the season ID (e.g., 12 → SSPSLS12)
            </p>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6">Upload Season Data</h2>
          
          <form onSubmit={handleFileUpload} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-grow w-full">
                <label htmlFor="season_file" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Season Data File
                </label>
                <input
                  type="file"
                  id="season_file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: <span className="font-medium">{selectedFile.name}</span>
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !seasonNumber.trim()}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload & Preview
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-4">What Happens Next?</h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">File Processing</h3>
                <p className="text-sm text-gray-600">Your file will be parsed and validated for correct format and data integrity</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Preview & Edit</h3>
                <p className="text-sm text-gray-600">Review all season data including teams and players with statistics before importing</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Import Progress</h3>
                <p className="text-sm text-gray-600">Track the real-time progress as the season data is imported into the database</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Completion</h3>
                <p className="text-sm text-gray-600">View import statistics and access the newly imported historical season</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
