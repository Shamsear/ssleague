'use client';

import { useState, useEffect } from 'react';
import { uploadImage } from '@/lib/imagekit/upload';

interface OwnerRegistrationFormProps {
  teamId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface OwnerFormData {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  place: string;
  nationality: string;
  bio: string;
  instagramHandle: string;
  twitterHandle: string;
}

export default function OwnerRegistrationForm({
  teamId,
  userId,
  userName,
  userEmail,
  onSuccess,
  onCancel,
}: OwnerRegistrationFormProps) {
  const [formData, setFormData] = useState<OwnerFormData>({
    name: userName || '',
    email: userEmail || '',
    phone: '',
    dateOfBirth: '',
    place: '',
    nationality: 'India',
    bio: '',
    instagramHandle: '',
    twitterHandle: '',
  });
  const [initialName, setInitialName] = useState(userName || '');
  const [nameChanged, setNameChanged] = useState(false);

  // Kerala districts
  const keralaDistricts = [
    'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod',
    'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad',
    'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'
  ];
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup blob URL on unmount or when photo changes
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    // Fetch owner_name from Firebase teams collection
    const fetchOwnerName = async () => {
      if (!teamId) return;
      
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/config');
        
        // Get team document by teamId
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        
        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const ownerName = teamData.owner_name;
          
          if (ownerName && !formData.name) {
            setFormData(prev => ({ ...prev, name: ownerName }));
            setInitialName(ownerName);
          }
        }
      } catch (error) {
        console.error('Error fetching owner name from teams:', error);
      }
    };

    fetchOwnerName();
    
    // Update initial values when userName/userEmail props change (fallback)
    if (userName && !formData.name) {
      setFormData(prev => ({ ...prev, name: userName }));
      setInitialName(userName);
    }
    if (userEmail && !formData.email) {
      setFormData(prev => ({ ...prev, email: userEmail }));
    }
  }, [userName, userEmail, teamId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Track if name was changed from initial value
    if (name === 'name' && value !== initialName) {
      setNameChanged(true);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Revoke old preview URL before creating new one
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Owner name is required');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    if (!photoFile) {
      setError('Owner photo is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photo to ImageKit
      const timestamp = Date.now();
      const fileName = `owner_${teamId}_${timestamp}_${photoFile.name}`;

      const uploadResult = await uploadImage({
        file: photoFile,
        fileName,
        folder: '/owner-photos',
        tags: ['owner', teamId],
        useUniqueFileName: true,
      });

      // Create owner via API
      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          name: formData.name,
          email: formData.email,
          registeredEmail: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth || null,
          place: formData.place || null,
          nationality: formData.nationality || null,
          bio: formData.bio || null,
          instagramHandle: formData.instagramHandle || null,
          twitterHandle: formData.twitterHandle || null,
          photoUrl: uploadResult.url,
          photoFileId: uploadResult.fileId,
          registeredUserId: userId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to register owner');
      }

      // Update Firebase teams owner_name if name was changed
      if (nameChanged && formData.name !== initialName) {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase/config');
          
          // Update owner_name in teams collection
          const teamRef = doc(db, 'teams', teamId);
          await updateDoc(teamRef, {
            owner_name: formData.name
          });
        } catch (updateError) {
          console.error('Error updating Firebase teams owner_name:', updateError);
          // Don't fail the whole operation if this fails
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error registering owner:', err);
      setError(err.message || 'Failed to register owner. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Owner Photo *
        </label>
        <div className="flex items-center space-x-4">
          {photoPreview && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gray-200">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max size: 5MB. Formats: JPG, PNG
            </p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
          Full Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          placeholder="Enter owner's full name"
        />
      </div>

      {/* Email and Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="owner@example.com"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Enter phone number"
          />
        </div>
      </div>

      {/* Date of Birth, District, Nationality */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-gray-700 mb-2">
            Date of Birth
          </label>
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label htmlFor="place" className="block text-sm font-semibold text-gray-700 mb-2">
            District
          </label>
          <select
            id="place"
            name="place"
            value={formData.place}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">Select District</option>
            {keralaDistricts.map(district => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nationality" className="block text-sm font-semibold text-gray-700 mb-2">
            Nationality
          </label>
          <input
            type="text"
            id="nationality"
            name="nationality"
            value={formData.nationality}
            onChange={handleInputChange}
            readOnly
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-sm font-semibold text-gray-700 mb-2">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleInputChange}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          placeholder="Tell us about yourself..."
        />
      </div>

      {/* Social Media */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="instagramHandle" className="block text-sm font-semibold text-gray-700 mb-2">
            Instagram Handle
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
            <input
              type="text"
              id="instagramHandle"
              name="instagramHandle"
              value={formData.instagramHandle}
              onChange={handleInputChange}
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="username"
            />
          </div>
        </div>
        <div>
          <label htmlFor="twitterHandle" className="block text-sm font-semibold text-gray-700 mb-2">
            Twitter Handle
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
            <input
              type="text"
              id="twitterHandle"
              name="twitterHandle"
              value={formData.twitterHandle}
              onChange={handleInputChange}
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="username"
            />
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isSubmitting ? 'Registering...' : 'Register Owner'}
        </button>
      </div>
    </form>
  );
}
