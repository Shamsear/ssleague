'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'confirm-modal-portal';
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
      if (e.key === 'Escape') onCancel();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen || !mounted || !portalContainer) return null;

  const getIcon = () => {
    if (type === 'danger') {
      return (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    } else if (type === 'warning') {
      return (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
          <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  return createPortal(
    <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', height: '100%' }}>
      {/* Backdrop */}
      <div
        className="bg-black/20 backdrop-blur-sm"
        onClick={onCancel}
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

      {/* Modal - centered */}
      <div 
        className="w-[calc(100%-2rem)] sm:w-auto sm:min-w-[400px] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: '0',
          maxWidth: 'min(90vw, 640px)'
        }}
        aria-labelledby="modal-title" 
        role="dialog" 
        aria-modal="true"
      >
        <div className="px-5 py-5 sm:px-8 sm:py-8">
          <div className="sm:flex sm:items-start">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div className="mt-4 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                {title || 'Confirmation Required'}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex w-full sm:w-auto justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-md ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`inline-flex w-full sm:w-auto justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                type === 'danger' 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                  : type === 'warning'
                  ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalContainer
  );
}
