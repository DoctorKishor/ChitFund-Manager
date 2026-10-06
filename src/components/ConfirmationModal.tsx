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
    ? 'bg-[#E41414] hover:bg-[#E41414]/90 text-white shadow-md shadow-[#E41414]/20'
    : 'bg-[#6359E9] hover:bg-[#6F64FF] text-white shadow-md shadow-[#6359E9]/20';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
      <div className="relative bg-[#1D1D41] border border-[#27264E] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-[#AEABD8] hover:text-white hover:bg-[#27264E] p-1.5 rounded-xl cursor-pointer transition-colors"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-4">
          <div
            className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isDanger 
                ? 'bg-[#E41414]/15 border-[#E41414]/30' 
                : 'bg-[#6359E9]/15 border-[#6359E9]/30'
            }`}
          >
            <IconComponent size={20} className={iconColor} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm">{title}</h3>
            <p className="mt-1.5 text-xs text-[#AEABD8] whitespace-pre-line leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-[#AEABD8] hover:text-white bg-[#141332] hover:bg-[#27264E] border border-[#27264E] rounded-xl transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
