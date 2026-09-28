'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info } from 'lucide-react';

interface HelpTooltipProps {
  text: string;
  title?: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'icon' | 'badge' | 'info';
  size?: 'xs' | 'sm' | 'md';
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  text,
  title,
  className = '',
  position = 'top',
  variant = 'badge',
  size = 'xs'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent border-[5px]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent border-[5px]',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent border-[5px]',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent border-[5px]'
  };

  const sizeStyles = {
    xs: 'w-4 h-4 text-[10px]',
    sm: 'w-4.5 h-4.5 text-[11px]',
    md: 'w-5 h-5 text-xs'
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-label="Help and information"
        className={`focus:outline-none transition-all duration-150 inline-flex items-center justify-center select-none ${
          variant === 'badge'
            ? `${sizeStyles[size]} rounded-full font-bold border ${
                isOpen 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105 ring-2 ring-indigo-200' 
                  : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 border-gray-300/80 shadow-2xs'
              }`
            : variant === 'info'
            ? `rounded-full text-gray-400 hover:text-indigo-600 ${isOpen ? 'text-indigo-600' : ''}`
            : `rounded-full text-gray-400 hover:text-indigo-600 ${isOpen ? 'text-indigo-600' : ''}`
        }`}
      >
        {variant === 'badge' ? (
          <span>?</span>
        ) : variant === 'info' ? (
          <Info className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
        ) : (
          <HelpCircle className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
        )}
      </button>

      {/* Floating Popover / Tooltip */}
      {isOpen && (
        <div
          className={`absolute ${positionClasses[position]} z-[100] w-64 max-w-[calc(100vw-32px)] p-2.5 bg-gray-900/95 text-white rounded-xl shadow-2xl backdrop-blur-md border border-gray-800/80 text-left text-xs font-normal leading-relaxed pointer-events-auto transform animate-in fade-in zoom-in-95 duration-150 select-text`}
          style={{ filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.3))' }}
        >
          {/* Arrow */}
          <div className={`absolute w-0 h-0 pointer-events-none ${arrowClasses[position]}`} />
          
          {title && (
            <div className="font-semibold text-gray-100 mb-1 flex items-center gap-1.5 pb-1 border-b border-gray-800">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              {title}
            </div>
          )}
          <div className="text-gray-300 font-sans tracking-normal">
            {text}
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpTooltip;
