'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, X, CheckCircle2, Info } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isInfo?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  isInfo = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const IconComponent = isDanger ? AlertTriangle : isInfo ? Info : CheckCircle2;
  const iconColor = isDanger ? 'text-rose-500' : isInfo ? 'text-blue-500' : 'text-emerald-500';
  const confirmBtnClass = isDanger
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-4">
          <div
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isDanger ? 'bg-rose-50' : 'bg-blue-50'
            }`}
          >
            <IconComponent size={20} className={iconColor} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
            <p className="mt-1.5 text-xs text-gray-600 whitespace-pre-line leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
