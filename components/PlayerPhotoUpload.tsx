'use client';

import { useState } from 'react';

interface PlayerPhotoUploadProps {
  playerId: string;
  onUploadSuccess?: (url: string) => void;
}

export default function PlayerPhotoUpload({ playerId, onUploadSuccess }: PlayerPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.append('playerId', playerId);

      const response = await fetch('/api/players/photos/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        alert('Photo uploaded successfully!');
        if (onUploadSuccess) {
          onUploadSuccess(data.url);
        }
        setPreview(null);
        // Reset form
        (e.target as HTMLFormElement).reset();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Player Photo</h3>
      
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Choose Photo (JPG, PNG, WebP - Max 4MB)
          </label>
          <input
            type="file"
            id="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-[#0066FF] file:text-white
              hover:file:bg-[#0052CC]
              cursor-pointer"
            required
          />
        </div>

        {preview && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Preview:</p>
            <img
              src={preview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-xl border-2 border-gray-300"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl 
            disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </button>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Photo will be named: <code className="bg-gray-100 px-1 py-0.5 rounded">{playerId}.ext</code></p>
        <p>• Supported formats: JPG, PNG, WebP</p>
        <p>• Maximum file size: 4MB</p>
      </div>
    </div>
  );
}
