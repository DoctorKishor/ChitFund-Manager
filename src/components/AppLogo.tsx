'use client';

import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export default function AppLogo({
  className = '',
  size = 36,
  showText = false,
  textClassName = '',
}: AppLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md select-none"
      >
        <defs>
          <linearGradient id="appLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0A0E1A" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>

          <linearGradient id="appLogoRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.6" />
          </linearGradient>

          <linearGradient id="appLogoGrowth" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>

          <linearGradient id="appLogoVault" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>

          <linearGradient id="appLogoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          <filter id="appLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Base Squircle */}
        <rect
          x="16"
          y="16"
          width="480"
          height="480"
          rx="112"
          fill="url(#appLogoBg)"
          stroke="url(#appLogoRim)"
          strokeWidth="6"
        />

        {/* Center Glow */}
        <circle cx="256" cy="256" r="140" fill="#4F46E5" opacity="0.18" filter="url(#appLogoGlow)" />
        <circle cx="210" cy="220" r="90" fill="#10B981" opacity="0.14" filter="url(#appLogoGlow)" />

        {/* Hexagonal Geometry */}
        <polygon
          points="256,108 384,182 384,330 256,404 128,330 128,182"
          fill="none"
          stroke="#6366F1"
          strokeWidth="2"
          strokeOpacity="0.3"
          strokeDasharray="6,6"
        />

        {/* C Arc */}
        <path
          d="M 290 148 C 190 148, 136 200, 136 270 C 136 340, 195 382, 296 382 C 345 382, 380 365, 396 348"
          fill="none"
          stroke="url(#appLogoGrowth)"
          strokeWidth="32"
          strokeLinecap="round"
        />

        {/* F Crossbars */}
        <path
          d="M 216 206 L 358 206"
          fill="none"
          stroke="url(#appLogoVault)"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <path
          d="M 216 276 L 326 276"
          fill="none"
          stroke="url(#appLogoVault)"
          strokeWidth="26"
          strokeLinecap="round"
        />

        {/* Spine */}
        <path
          d="M 216 172 L 216 350"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.95"
          strokeWidth="28"
          strokeLinecap="round"
        />

        {/* Coin Node with Rupee Emblem */}
        <g transform="translate(356, 318)">
          <circle cx="0" cy="0" r="32" fill="url(#appLogoGold)" stroke="#FFFFFF" strokeWidth="3" />
          <path
            d="M -10 -10 L 10 -10 M -10 -4 L 8 -4 M -10 -10 L -10 6 C -2 6, 8 6, 8 -1 C 8 -7, -2 -7, -10 -7 M -2 5 L 8 13"
            fill="none"
            stroke="#78350F"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {showText && (
        <div className={`flex flex-col leading-none ${textClassName}`}>
          <span className="font-extrabold text-slate-900 tracking-tight font-display text-base">
            ChitFunds<span className="text-brand-600">.Admin</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
            Fintech Portal
          </span>
        </div>
      )}
    </div>
  );
}

