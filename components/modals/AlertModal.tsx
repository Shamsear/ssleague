'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info'
}: AlertModalProps) {
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Create dedicated portal container
  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'alert-modal-portal';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999;';
    document.body.appendChild(container);
    setPortalContainer(container);
    setMounted(true);
    
    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !portalContainer) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getColorClass = () => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };

  // Portal renders to dedicated container
  return createPortal(
    <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', height: '100%' }}>
      {/* Backdrop - full viewport overlay */}
      <div
        className="bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {/* Modal - absolutely centered */}
      <div 
        className="w-[calc(100%-2rem)] sm:w-auto sm:min-w-[400px] sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: '0',
          maxWidth: 'min(90vw, 512px)'
        }}
        aria-labelledby="modal-title" 
        role="dialog" 
        aria-modal="true"
      >
        <div className="px-5 py-5 sm:px-8 sm:py-8">
          <div>
            {getIcon()}
            <div className="mt-3 text-center sm:mt-5">
              <h3 className={`text-lg font-semibold leading-6 ${getColorClass()}`}>
                {title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Information')}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 sm:mt-8">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                type === 'success' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' :
                type === 'error' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' :
                type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' :
                'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalContainer
  );
}
