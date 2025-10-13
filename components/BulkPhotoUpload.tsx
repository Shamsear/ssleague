'use client';

import { useState } from 'react';
import { getStorage, ref, uploadBytes, deleteObject, listAll } from 'firebase/storage';
import { app } from '@/lib/firebase/config';

export default function BulkPhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [deleteResult, setDeleteResult] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
    setUploadResult(null);
  };

  const handleBulkUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('Please select photo files to upload');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      
      // Add all files to FormData
      Array.from(selectedFiles).forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/players/photos/upload-public', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setUploadResult(data);

      if (data.success) {
        // Clear file input
        const fileInput = document.getElementById('photo-files') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        setSelectedFiles(null);
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        error: error.message || 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ Are you sure you want to delete ALL player photos? This action cannot be undone!')) {
      return;
    }

    if (!confirm('⚠️ FINAL WARNING: This will permanently delete all player photos from storage. Continue?')) {
      return;
    }

    setDeleting(true);
    setDeleteResult(null);

    try {
      const response = await fetch('/api/players/photos/delete-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      });

      const data = await response.json();
      setDeleteResult(data);
    } catch (error: any) {
      setDeleteResult({
        success: false,
        error: error.message || 'Delete failed',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Bulk Player Photo Management
        </h3>
        <p className="text-sm text-gray-600">Upload or delete multiple player photos at once</p>
      </div>

      {/* Upload Section */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="font-medium text-gray-700 mb-3">📤 Upload Player Photos</h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Photos (Multiple files)
            </label>
            <input
              type="file"
              id="photo-files"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-[#0066FF] file:text-white
                hover:file:bg-[#0052CC]
                cursor-pointer"
            />
            <p className="mt-1 text-xs text-gray-500">
              {selectedFiles ? `${selectedFiles.length} file(s) selected` : 'No files selected'}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
            <p className="font-medium text-blue-800 mb-1">📝 File Naming Instructions:</p>
            <ul className="list-disc list-inside text-blue-700 space-y-1">
              <li>Name files as: <code className="bg-blue-100 px-1 rounded">player_id.jpg</code></li>
              <li>Example: <code className="bg-blue-100 px-1 rounded">12345.jpg</code>, <code className="bg-blue-100 px-1 rounded">67890.png</code></li>
              <li>Prefix "player_" is optional: <code className="bg-blue-100 px-1 rounded">player_12345.jpg</code></li>
              <li>Supported formats: JPG, PNG, WebP</li>
              <li>Max 4MB per file</li>
            </ul>
          </div>

          <button
            onClick={handleBulkUpload}
            disabled={uploading || !selectedFiles || selectedFiles.length === 0}
            className="w-full py-2 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl 
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload Photos'}
          </button>
        </div>

        {/* Upload Results */}
        {uploadResult && (
          <div className={`mt-4 p-4 rounded-xl ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {uploadResult.message}
            </p>
            {uploadResult.summary && (
              <div className="mt-2 text-sm text-gray-700">
                <p>✅ Success: {uploadResult.summary.success}</p>
                <p>❌ Failed: {uploadResult.summary.failed}</p>
                <p>📊 Total: {uploadResult.summary.total}</p>
              </div>
            )}
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-red-700 font-medium">View Errors</summary>
                <ul className="mt-1 space-y-1 text-red-600">
                  {uploadResult.errors.map((err: any, i: number) => (
                    <li key={i}>• {err.fileName}: {err.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Delete Section */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="font-medium text-gray-700 mb-3">🗑️ Delete All Player Photos</h4>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-800">
            <strong>⚠️ Warning:</strong> This will permanently delete ALL player photos from storage. This action cannot be undone!
          </p>
        </div>

        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl 
            disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          {deleting ? '⏳ Deleting...' : '🗑️ Delete All Photos'}
        </button>

        {/* Delete Results */}
        {deleteResult && (
          <div className={`mt-4 p-4 rounded-xl ${deleteResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-medium ${deleteResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {deleteResult.message}
            </p>
            {deleteResult.summary && (
              <div className="mt-2 text-sm text-gray-700">
                <p>✅ Deleted: {deleteResult.summary.success}</p>
                <p>❌ Failed: {deleteResult.summary.failed}</p>
                <p>📊 Total: {deleteResult.summary.total}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
