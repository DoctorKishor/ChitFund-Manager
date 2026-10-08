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
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/60 shadow-2xs" role="group" aria-label="Font size controls">
      {/* Individual Action Button: A+ (Increase Font) */}
      <button
        type="button"
        onClick={handleIncrease}
        disabled={!canIncrease}
        title={`Increase font size (${currentStep.size}px -> ${canIncrease ? FONT_STEPS[stepIndex + 1].size : currentStep.size}px)`}
        className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 rounded hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
      >
        A+
      </button>

      {/* Individual Action Button: A- (Decrease Font) */}
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        title={`Decrease font size (${currentStep.size}px -> ${canDecrease ? FONT_STEPS[stepIndex - 1].size : currentStep.size}px)`}
        className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 rounded hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
      >
        A-
      </button>

      {/* Reset Pill Indicator if changed from default 16px */}
      {!isDefault && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset to default font size (16px)"
          className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 hover:text-brand-700 bg-white rounded border border-slate-200 transition-colors cursor-pointer"
        >
          {currentStep.size}px ↺
        </button>
      )}
    </div>
  );
}
