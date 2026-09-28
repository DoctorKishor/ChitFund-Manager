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
      thumbActiveText: 'text-red-600',
      glow: 'shadow-red-500/20',
    },
    amber: {
      activeBg: 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600',
      activeText: 'text-white',
      fillBg: 'bg-amber-500/20',
      thumbActiveText: 'text-amber-600',
      glow: 'shadow-amber-500/20',
    },
    green: {
      activeBg: 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600',
      activeText: 'text-white',
      fillBg: 'bg-emerald-500/20',
      thumbActiveText: 'text-emerald-600',
      glow: 'shadow-emerald-500/20',
    },
    indigo: {
      activeBg: 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600',
      activeText: 'text-white',
      fillBg: 'bg-indigo-500/20',
      thumbActiveText: 'text-indigo-600',
      glow: 'shadow-indigo-500/20',
    },
    slate: {
      activeBg: 'bg-slate-800',
      activeText: 'text-white',
      fillBg: 'bg-slate-500/20',
      thumbActiveText: 'text-slate-800',
      glow: 'shadow-slate-500/20',
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
      className={`relative h-14 select-none rounded-full overflow-hidden p-1 flex items-center transition-all duration-300 ${
        disabled
          ? 'bg-gray-200/80 cursor-not-allowed opacity-60'
          : isConfirmed || isLoading
          ? `${colorStyles.activeBg} shadow-md ${colorStyles.glow}`
          : 'bg-gray-200/90 hover:bg-gray-200 cursor-grab active:cursor-grabbing shadow-inner'
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
          className={`absolute left-0 top-0 bottom-0 ${colorStyles.fillBg} rounded-full transition-none`}
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
              ? 'text-gray-400 font-bold'
              : 'text-gray-600 font-bold'
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

      {/* Circular Drag Thumb */}
      <div
        ref={thumbRef}
        className={`relative z-10 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md transition-transform ${
          isDragging ? 'scale-105 shadow-lg' : isConfirmed ? 'shadow-lg scale-100' : 'hover:scale-102'
        }`}
        style={{
          transform: `translateX(${thumbPositionPx}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {isLoading ? (
          <RefreshCw size={18} className={`animate-spin ${colorStyles.thumbActiveText}`} />
        ) : isConfirmed ? (
          <Check size={22} className={`${colorStyles.thumbActiveText} stroke-[3] animate-in zoom-in duration-200`} />
        ) : (
          <ChevronRight
            size={22}
            className={`text-gray-700 stroke-[2.5] transition-transform ${
              isDragging ? 'translate-x-0.5 text-gray-900' : ''
            }`}
          />
        )}
      </div>
    </div>
  );
}
