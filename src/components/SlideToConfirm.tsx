'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, Check, RefreshCw } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface SlideToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  confirmedLabel?: string;
  loadingLabel?: string;
  isLoading?: boolean;
  colorVariant?: 'red' | 'green' | 'indigo' | 'slate' | 'amber';
  className?: string;
}

export default function SlideToConfirm({
  onConfirm,
  disabled = false,
  label = 'Slide to confirm',
  confirmedLabel = 'Confirmed!',
  loadingLabel = 'Processing...',
  isLoading = false,
  colorVariant = 'red',
  className = '',
}: SlideToConfirmProps) {
  const [dragProgress, setDragProgress] = useState<number>(0); // 0 to 1
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Variant color definitions
  const colorStyles = {
    red: {
      activeBg: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600',
      activeText: 'text-white',
      fillBg: 'bg-red-500/20',
      thumbActiveText: 'text-red-500',
      glow: 'shadow-red-500/20',
    },
    amber: {
      activeBg: 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600',
      activeText: 'text-white',
      fillBg: 'bg-amber-500/20',
      thumbActiveText: 'text-amber-500',
      glow: 'shadow-amber-500/20',
    },
    green: {
      activeBg: 'bg-gradient-to-r from-[#02B15A] via-emerald-600 to-[#02B15A]',
      activeText: 'text-white',
      fillBg: 'bg-[#02B15A]/20',
      thumbActiveText: 'text-[#02B15A]',
      glow: 'shadow-[#02B15A]/20',
    },
    indigo: {
      activeBg: 'bg-gradient-to-r from-[#9C2CF3] via-[#6359E9] to-[#3A6FF9]',
      activeText: 'text-white',
      fillBg: 'bg-[#6359E9]/25',
      thumbActiveText: 'text-[#6359E9]',
      glow: 'shadow-[#6359E9]/25',
    },
    slate: {
      activeBg: 'bg-[#27264E]',
      activeText: 'text-white',
      fillBg: 'bg-[#6359E9]/20',
      thumbActiveText: 'text-[#64CFF6]',
      glow: 'shadow-[#27264E]/40',
    },
  }[colorVariant];

  // Calculate drag progress from coordinate
  const calculateProgress = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const thumbWidth = thumbRef.current ? thumbRef.current.offsetWidth : 48;
    const maxDragDistance = rect.width - thumbWidth;
    if (maxDragDistance <= 0) return 0;

    const currentX = clientX - rect.left - thumbWidth / 2;
    const progress = Math.max(0, Math.min(1, currentX / maxDragDistance));
    return progress;
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || isConfirmed || disabled || isLoading) return;
    const progress = calculateProgress(clientX);
    setDragProgress(progress);

    // If threshold reached (>= 0.92), trigger confirm
    if (progress >= 0.92) {
      setIsConfirmed(true);
      setDragProgress(1);
      setIsDragging(false);
      triggerHapticFeedback('success');
      onConfirm();
    }
  }, [isDragging, isConfirmed, disabled, isLoading, calculateProgress, onConfirm]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!isConfirmed && dragProgress < 0.92) {
      // Snap back to start
      setDragProgress(0);
      triggerHapticFeedback('light');
    }
  }, [isDragging, isConfirmed, dragProgress]);

  // Mouse Listeners on window
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleDragMove(e.clientX);
    };
    const onMouseUp = () => {
      if (isDragging) handleDragEnd();
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch Listeners on window
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      if (isDragging) handleDragEnd();
    };

    if (isDragging) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Reset if disabled changes
  useEffect(() => {
    if (disabled) {
      setDragProgress(0);
      setIsConfirmed(false);
      setIsDragging(false);
    }
  }, [disabled]);

  const thumbPositionPx = trackRef.current && thumbRef.current
    ? dragProgress * (trackRef.current.offsetWidth - thumbRef.current.offsetWidth)
    : 0;

  return (
    <div
      ref={trackRef}
      className={`relative h-14 select-none rounded-2xl overflow-hidden p-1 flex items-center transition-all duration-300 border ${
        disabled
          ? 'bg-[#141332]/60 border-[#27264E]/60 cursor-not-allowed opacity-50'
          : isConfirmed || isLoading
          ? `${colorStyles.activeBg} border-transparent shadow-lg ${colorStyles.glow}`
          : 'bg-[#141332] border-[#27264E] hover:border-[#6359E9]/50 cursor-grab active:cursor-grabbing shadow-inner'
      } ${className}`}
      onMouseDown={(e) => {
        if (disabled || isConfirmed || isLoading) return;
        setIsDragging(true);
        handleDragMove(e.clientX);
      }}
      onTouchStart={(e) => {
        if (disabled || isConfirmed || isLoading || e.touches.length === 0) return;
        setIsDragging(true);
        handleDragMove(e.touches[0].clientX);
      }}
    >
      {/* Dynamic Fill Track behind thumb during drag */}
      {!isConfirmed && !isLoading && (
        <div
          className={`absolute left-0 top-0 bottom-0 ${colorStyles.fillBg} rounded-2xl transition-none`}
          style={{
            width: thumbRef.current
              ? `${thumbPositionPx + thumbRef.current.offsetWidth / 2}px`
              : `${dragProgress * 100}%`,
          }}
        />
      )}

      {/* Center Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
        <span
          className={`text-xs sm:text-sm font-black tracking-wide transition-all duration-200 ${
            isConfirmed || isLoading
              ? `${colorStyles.activeText} animate-in zoom-in-95`
              : disabled
              ? 'text-[#AEABD8]/40 font-bold'
              : 'text-[#AEABD8] font-bold'
          }`}
          style={{
            opacity: isConfirmed || isLoading ? 1 : Math.max(0.15, 1 - dragProgress * 1.5),
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" />
              {loadingLabel}
            </span>
          ) : isConfirmed ? (
            confirmedLabel
          ) : (
            label
          )}
        </span>
      </div>

      {/* Drag Thumb */}
      <div
        ref={thumbRef}
        className={`relative z-10 w-12 h-12 rounded-xl bg-[#6359E9] text-white flex items-center justify-center shadow-lg transition-transform ${
          isDragging ? 'scale-105 shadow-[#6359E9]/50' : isConfirmed ? 'bg-white shadow-xl scale-100' : 'hover:scale-102 hover:bg-[#6F64FF]'
        }`}
        style={{
          transform: `translateX(${thumbPositionPx}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {isLoading ? (
          <RefreshCw size={18} className="animate-spin text-white" />
        ) : isConfirmed ? (
          <Check size={22} className={`${colorStyles.thumbActiveText} stroke-[3] animate-in zoom-in duration-200`} />
        ) : (
          <ChevronRight
            size={22}
            className={`text-white stroke-[2.5] transition-transform ${
              isDragging ? 'translate-x-0.5' : ''
            }`}
          />
        )}
      </div>
    </div>
  );
}
