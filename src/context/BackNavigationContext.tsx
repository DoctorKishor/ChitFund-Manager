'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { LogOut, X, ShieldAlert, Check } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { triggerHapticFeedback } from '@/utils/haptics';

type BackHandler = () => boolean;

interface BackHandlerRegistration {
  id: string;
  priority: number;
  handler: BackHandler;
}

interface BackNavigationContextType {
  registerBackHandler: (id: string, priority: number, handler: BackHandler) => () => void;
  showExitModal: boolean;
  setShowExitModal: (show: boolean) => void;
  confirmExitApp: () => void;
}

const BackNavigationContext = createContext<BackNavigationContextType | null>(null);

export function useBackNavigation() {
  const ctx = useContext(BackNavigationContext);
  if (!ctx) {
    throw new Error('useBackNavigation must be used within BackNavigationProvider');
  }
  return ctx;
}

/**
 * Hook for any component/modal/subview to register its hardware/browser back action.
 * Priority guideline:
 * - 100: Topmost Modals, full-screen sheets, dialogs
 * - 50: Sub-views (Member Details, Auction Archive, sub-screens)
 * - 10: Non-overview tabs (navigating back to Overview)
 */
export function useBackHandler(
  id: string,
  priority: number,
  handler: BackHandler,
  active: boolean = true
) {
  const { registerBackHandler } = useBackNavigation();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    return registerBackHandler(id, priority, () => handlerRef.current());
  }, [id, priority, active, registerBackHandler]);
}

export function BackNavigationProvider({ children }: { children: React.ReactNode }) {
  const handlersRef = useRef<BackHandlerRegistration[]>([]);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const showExitModalRef = useRef<boolean>(false);
  showExitModalRef.current = showExitModal;
  const isExitingRef = useRef<boolean>(false);

  const registerBackHandler = useCallback((id: string, priority: number, handler: BackHandler) => {
    const item: BackHandlerRegistration = { id, priority, handler };
    handlersRef.current = [
      ...handlersRef.current.filter(h => h.id !== id),
      item,
    ];

    return () => {
      handlersRef.current = handlersRef.current.filter(h => h.id !== id);
    };
  }, []);

  // Initialize browser history entry buffer and listen on capture phase
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use native History prototype methods to prevent Next.js App Router from treating
    // buffer pushState calls as route changes / page refreshes
    const nativePushState = History.prototype.pushState;
    const nativeReplaceState = History.prototype.replaceState;

    try {
      nativeReplaceState.call(window.history, { cf_page: 'cf_root' }, '', window.location.href);
      nativePushState.call(window.history, { cf_page: 'cf_app' }, '', window.location.href);
    } catch {}

    const onPopState = (e: PopStateEvent) => {
      if (isExitingRef.current) return;

      // CRITICAL: Stop immediate propagation so Next.js App Router listener does NOT receive popstate
      // and does NOT trigger an App Router page reload / re-render / fetch!
      e.stopImmediatePropagation();

      // 1. If Exit Modal is currently open, pressing back closes it
      if (showExitModalRef.current) {
        setShowExitModal(false);
        try {
          nativePushState.call(window.history, { cf_page: 'cf_app' }, '', window.location.href);
        } catch {}
        return;
      }

      // 2. Sort registered handlers by priority descending (highest priority executes first)
      const sorted = [...handlersRef.current].sort((a, b) => b.priority - a.priority);

      for (const item of sorted) {
        try {
          const handled = item.handler();
          if (handled) {
            // Re-push history entry natively so subsequent back presses are captured without Next.js reload
            try {
              nativePushState.call(window.history, { cf_page: 'cf_app' }, '', window.location.href);
            } catch {}
            return;
          }
        } catch (err) {
          console.warn(`Error in back handler "${item.id}":`, err);
        }
      }

      // 3. Absolute Root Reached (Overview tab with zero open modals or subviews):
      // Re-push history buffer natively and trigger the Exit Confirmation Dialog
      try {
        nativePushState.call(window.history, { cf_page: 'cf_app' }, '', window.location.href);
      } catch {}
      setShowExitModal(true);
      triggerHapticFeedback('light');
    };

    // Capture phase listener ensures our back interceptor runs BEFORE Next.js's router listeners
    window.addEventListener('popstate', onPopState, { capture: true });

    return () => {
      window.removeEventListener('popstate', onPopState, { capture: true });
    };
  }, []);

  const confirmExitApp = useCallback(() => {
    isExitingRef.current = true;
    setShowExitModal(false);

    if (typeof window !== 'undefined') {
      try {
        // Attempt clean window close (works for PWAs and popups)
        window.close();
      } catch {}

      // Fallback: navigate backward out of the app history while remaining signed in
      setTimeout(() => {
        try {
          window.history.go(-2);
        } catch {}
      }, 50);
    }
  }, []);

  return (
    <BackNavigationContext.Provider
      value={{
        registerBackHandler,
        showExitModal,
        setShowExitModal,
        confirmExitApp,
      }}
    >
      {children}

      {/* ── Global Exit Application Confirmatory Dialog ── */}
      {showExitModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200/90 text-center space-y-4 animate-in zoom-in-95 duration-150">
            {/* Logo / Exit Icon */}
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mx-auto text-slate-800 shadow-xs">
              <AppLogo size={36} />
            </div>

            {/* Title & Explanatory Text */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 tracking-tight font-display">
                Exit Chit Funds Manager?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Are you sure you want to close the workspace? Your session, recorded ledger entries, and treasury balances remain safely saved.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('light');
                  setShowExitModal(false);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer active:scale-95"
              >
                Cancel (Stay in App)
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('warning');
                  confirmExitApp();
                }}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Exit App</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </BackNavigationContext.Provider>
  );
}
