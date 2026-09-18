'use client';

import React, { useState, useEffect } from 'react';

// Progressive scale steps from 14px to 24px
const FONT_STEPS = [
  { size: 14, label: '87.5%', desc: 'Compact' },
  { size: 16, label: '100%', desc: 'Default' },
  { size: 18, label: '112.5%', desc: 'Large (+1)' },
  { size: 20, label: '125%', desc: 'Extra Large (+2)' },
  { size: 22, label: '137.5%', desc: 'Senior View (+3)' },
  { size: 24, label: '150%', desc: 'Max High Contrast (+4)' },
];

const DEFAULT_INDEX = 1; // 16px

export default function FontSizeSwitcher() {
  const [stepIndex, setStepIndex] = useState<number>(DEFAULT_INDEX);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('cf_font_step_idx');
      if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < FONT_STEPS.length) {
          setStepIndex(idx);
          document.documentElement.style.fontSize = `${FONT_STEPS[idx].size}px`;
          return;
        }
      }
      document.documentElement.style.fontSize = `${FONT_STEPS[DEFAULT_INDEX].size}px`;
    } catch (e) {
      console.error('Error loading font size preference:', e);
    }
  }, []);

  const applyStep = (newIdx: number) => {
    const clamped = Math.max(0, Math.min(FONT_STEPS.length - 1, newIdx));
    setStepIndex(clamped);
    try {
      localStorage.setItem('cf_font_step_idx', clamped.toString());
      document.documentElement.style.fontSize = `${FONT_STEPS[clamped].size}px`;
    } catch (e) {
      console.error('Error saving font size preference:', e);
    }
  };

  const handleIncrease = () => {
    applyStep(stepIndex + 1);
  };

  const handleDecrease = () => {
    applyStep(stepIndex - 1);
  };

  const handleReset = () => {
    applyStep(DEFAULT_INDEX);
  };

  if (!mounted) {
    return (
      <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  const currentStep = FONT_STEPS[stepIndex];
  const isDefault = stepIndex === DEFAULT_INDEX;
  const canIncrease = stepIndex < FONT_STEPS.length - 1;
  const canDecrease = stepIndex > 0;

  return (
    <div className="flex items-center space-x-1.5" role="group" aria-label="Font size controls">
      {/* Individual Action Button: A⁺ (Increase Font) */}
      <button
        type="button"
        onClick={handleIncrease}
        disabled={!canIncrease}
        title={`Increase font size (${currentStep.size}px -> ${canIncrease ? FONT_STEPS[stepIndex + 1].size : currentStep.size}px)`}
        className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg border text-sm sm:text-base font-black tracking-tight transition-all duration-150 flex items-center justify-center select-none shadow-2xs ${
          canIncrease
            ? 'bg-white hover:bg-indigo-50 border-gray-300 hover:border-indigo-400 text-gray-800 hover:text-indigo-700 active:scale-95 cursor-pointer'
            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
        }`}
      >
        <span className="font-extrabold leading-none">A</span>
        <span className="text-xs sm:text-sm font-black text-indigo-600 ml-0.5 leading-none">+</span>
      </button>

      {/* Individual Action Button: A⁻ (Decrease Font) */}
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        title={`Decrease font size (${currentStep.size}px -> ${canDecrease ? FONT_STEPS[stepIndex - 1].size : currentStep.size}px)`}
        className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg border text-sm sm:text-base font-black tracking-tight transition-all duration-150 flex items-center justify-center select-none shadow-2xs ${
          canDecrease
            ? 'bg-white hover:bg-indigo-50 border-gray-300 hover:border-indigo-400 text-gray-800 hover:text-indigo-700 active:scale-95 cursor-pointer'
            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
        }`}
      >
        <span className="font-extrabold leading-none">A</span>
        <span className="text-xs sm:text-sm font-black text-indigo-600 ml-0.5 leading-none">-</span>
      </button>

      {/* Reset Pill Indicator if changed from default 16px */}
      {!isDefault && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset to default font size (16px)"
          className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/80 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
        >
          <span>{currentStep.size}px</span>
          <span className="text-indigo-400 hover:text-indigo-700 font-normal">↺</span>
        </button>
      )}
    </div>
  );
}
