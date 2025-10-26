'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PromptModalProps {
  isOpen: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export default function PromptModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Input Required',
  message,
  placeholder = 'Enter value...',
  defaultValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel'
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'prompt-modal-portal';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999;';
    document.body.appendChild(container);
    setPortalContainer(container);
    setMounted(true);
    
    return () => {
      document.body.removeChild(container);
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, isOpen]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
    onCancel();
  };

  if (!isOpen || !mounted || !portalContainer) return null;

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
          <form onSubmit={handleSubmit}>
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-5">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 whitespace-pre-line">
                    {message}
                  </p>
                </div>
                <div className="mt-5">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="block w-full rounded-xl border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 sm:text-sm px-4 py-3"
                    autoFocus
                  />
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
                type="submit"
                className="inline-flex w-full sm:w-auto justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {confirmText}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    portalContainer
  );
}
