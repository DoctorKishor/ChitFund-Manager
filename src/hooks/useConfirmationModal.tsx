'use client';

import React, { useState, useCallback } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isInfo?: boolean;
}

export function useConfirmationModal() {
  const [state, setState] = useState<
    ConfirmOptions & { isOpen: boolean; resolve: ((val: boolean) => void) | null }
  >({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  });

  const showConfirmModal = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, isOpen: true, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  }, [state]);

  const ConfirmModal = useCallback(
    () => (
      <ConfirmationModal
        isOpen={state.isOpen}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        isDanger={state.isDanger}
        isInfo={state.isInfo}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state, handleConfirm, handleCancel]
  );

  return { showConfirmModal, ConfirmModal };
}
