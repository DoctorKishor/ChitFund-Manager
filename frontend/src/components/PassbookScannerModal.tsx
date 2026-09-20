'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, QrCode } from 'lucide-react';

interface PassbookScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  targetMemberName?: string;
}

export default function PassbookScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Passbook QR Code',
  subtitle = 'Point your camera at the QR code on the physical pocket passbook',
  targetMemberName,
}: PassbookScannerModalProps) {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'passbook-qr-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setScannerError(null);
    setHasScanned(false);
    setIsProcessing(false);

    const startScanner = async () => {
      try {
        // Allow DOM to mount the reader element
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!isMounted) return;

        const qrScanner = new Html5Qrcode(readerElementId);
        html5QrCodeRef.current = qrScanner;

        const qrCodeSuccessCallback = async (decodedText: string) => {
          if (isProcessing || hasScanned) return;
          setHasScanned(true);
          setIsProcessing(true);

          try {
            // Stop camera once scanned
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
              await html5QrCodeRef.current.stop();
            }
          } catch (stopErr) {
            console.warn('Scanner stop note:', stopErr);
          }

          // Extract token if decodedText is a full URL or direct token
          let extractedToken = decodedText.trim();
          if (extractedToken.includes('key=')) {
            try {
              const url = new URL(extractedToken);
              const key = url.searchParams.get('key');
              if (key) extractedToken = key;
            } catch {
              const match = extractedToken.match(/key=([a-zA-Z0-9_-]+)/);
              if (match && match[1]) extractedToken = match[1];
            }
          }

          try {
            await onScanSuccess(extractedToken);
          } catch (err: any) {
            setScannerError(err.message || 'Failed to process scanned QR code.');
            setIsProcessing(false);
            setHasScanned(false);
          }
        };

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await qrScanner.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          () => {}
        );
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Camera startup error:', err);
        setScannerError(
          err.message ||
            'Camera permission denied or camera not available. Please allow camera access and try again.'
        );
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current
          .stop()
          .catch((e) => console.warn('Scanner cleanup warning:', e));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn('Scanner stop error on close:', err);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {targetMemberName ? `Pairing to ${targetMemberName}` : subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera View Area */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500/40 shadow-inner flex items-center justify-center">
            <div id={readerElementId} className="w-full h-full object-cover" />

            {/* Target Scanning Overlay Frame */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-48 h-48 border-2 border-dashed border-indigo-400/70 rounded-xl relative animate-pulse">
                {/* Corner Markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
              </div>
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                <RefreshCw className="animate-spin text-indigo-400" size={28} />
                <span className="text-xs font-bold">Verifying Passbook Token...</span>
              </div>
            )}
          </div>

          {scannerError ? (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2 max-w-sm text-left">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{scannerError}</span>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>High-contrast QR detection active</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
