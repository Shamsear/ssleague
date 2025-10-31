'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LanguageToggleProps {
  variant?: 'button' | 'switch' | 'dropdown';
  className?: string;
}

export default function LanguageToggle({ variant = 'switch', className = '' }: LanguageToggleProps) {
  const { language, toggleLanguage, setLanguage } = useLanguage();

  if (variant === 'button') {
    return (
      <button
        onClick={toggleLanguage}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          language === 'en'
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-green-600 text-white hover:bg-green-700'
        } ${className}`}
        aria-label="Toggle Language"
      >
        {language === 'en' ? 'English' : 'മലയാളം'}
      </button>
    );
  }

  if (variant === 'dropdown') {
    return (
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as 'en' | 'ml')}
        className={`px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        aria-label="Select Language"
      >
        <option value="en">English</option>
        <option value="ml">മലയാളം</option>
      </select>
    );
  }

  // Default: switch variant
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        className={`text-sm font-medium transition-colors ${
          language === 'en' ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        EN
      </span>
      
      <button
        onClick={toggleLanguage}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          language === 'ml' ? 'bg-green-600' : 'bg-blue-600'
        }`}
        role="switch"
        aria-checked={language === 'ml'}
        aria-label="Toggle Language"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            language === 'ml' ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      
      <span
        className={`text-sm font-medium transition-colors ${
          language === 'ml' ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        ML
      </span>
    </div>
  );
}
