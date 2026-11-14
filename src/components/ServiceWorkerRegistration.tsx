'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function ServiceWorkerRegistration() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if app is already running in standalone PWA mode
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }

    // 1. Register Service Worker for offline shell and PWA support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('ChitFunds PWA update available.');
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.warn('PWA service worker registration failed:', error);
          });
      });
    }

    // 2. Listen for PWA Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user dismissed recently (persisted for the session)
      const dismissed = sessionStorage.getItem('chitfund_pwa_install_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Listen for app installed
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('chitfund_pwa_install_dismissed', 'true');
  };

  if (isStandalone || !showInstallBanner || !deferredPrompt) {
    return null;
  }

  return (
    <div
      role="banner"
      aria-label="Install Application"
      className="fixed z-50 animate-in duration-300 select-none
        top-3 inset-x-3 max-w-sm mx-auto slide-in-from-top-4
        md:top-auto md:inset-x-auto md:bottom-6 md:right-6 md:max-w-sm md:slide-in-from-bottom-4"
    >
      <div className="bg-[#0B0F19]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-2xl shadow-black/60 ring-1 ring-white/5 flex items-center justify-between gap-3 text-slate-100">
        {/* Brand Logo & Description */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <AppLogo size={36} />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0B0F19]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-white tracking-tight truncate font-display">
                Install Chit Funds
              </p>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate leading-snug">
              Instant offline shell &amp; home screen app
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} className="shrink-0 stroke-[2.5]" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
