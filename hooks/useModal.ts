import { useState, useCallback } from 'react';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export function useModal() {
  const [alertState, setAlertState] = useState<AlertOptions & { isOpen: boolean }>({
    isOpen: false,
    message: '',
  });

  const [confirmState, setConfirmState] = useState<ConfirmOptions & { 
    isOpen: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    message: '',
  });

  const [promptState, setPromptState] = useState<PromptOptions & {
    isOpen: boolean;
    onConfirm?: (value: string) => void;
  }>({
    isOpen: false,
    message: '',
  });

  // Alert
  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({ ...options, isOpen: true });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Confirm
  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        ...options,
        isOpen: true,
        onConfirm: () => {
          console.log('✅ useModal: User confirmed');
          resolve(true);
        },
      });
      
      // Store the reject function to be called on cancel
      (window as any).__modalReject = () => {
        console.log('❌ useModal: User cancelled');
        resolve(false);
      };
    });
  }, []);

  const closeConfirm = useCallback(() => {
    // Call the reject function if it exists (user cancelled)
    if ((window as any).__modalReject) {
      (window as any).__modalReject();
      (window as any).__modalReject = null;
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    // Clear the reject function since user confirmed
    (window as any).__modalReject = null;
    confirmState.onConfirm?.();
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState.onConfirm]);

  // Prompt
  const showPrompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        ...options,
        isOpen: true,
        onConfirm: (value) => resolve(value),
      });
    });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState(prev => {
      if (prev.isOpen && prev.onConfirm) {
        prev.onConfirm(''); // Return empty string on cancel
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  const handlePromptConfirm = useCallback((value: string) => {
    promptState.onConfirm?.(value);
    setPromptState(prev => ({ ...prev, isOpen: false }));
  }, [promptState.onConfirm]);

  return {
    // Alert
    alertState,
    showAlert,
    closeAlert,
    
    // Confirm
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
    
    // Prompt
    promptState,
    showPrompt,
    closePrompt,
    handlePromptConfirm,
  };
}
