'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, QrCode, AlertTriangle } from 'lucide-react';

interface PassbookScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  targetMemberName?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractAndValidatePassbookToken(rawText: string): { isValid: boolean; token?: string; error?: string } {
  const clean = rawText.trim();

  // Case A: URL containing /passbook?key=<UUID>
  if (clean.includes('/passbook') && clean.includes('key=')) {
    try {
      const parsedUrl = new URL(clean);
      const key = parsedUrl.searchParams.get('key');
      if (key && UUID_REGEX.test(key)) {
        return { isValid: true, token: key };
      }
    } catch {
      const match = clean.match(/[?&]key=([0-9a-fA-F-]{36})/);
      if (match && match[1] && UUID_REGEX.test(match[1])) {
        return { isValid: true, token: match[1] };
      }
    }
    return { isValid: false, error: 'Malformed Passbook URL: Invalid security token.' };
  }

  // Case B: Raw 36-character UUID token
  if (UUID_REGEX.test(clean)) {
    return { isValid: true, token: clean };
  }

  // Case C: Specific recognizable third-party QR payloads for helpful error text
  if (clean.startsWith('upi://')) {
    return { isValid: false, error: 'UPI Payment QR detected. Please scan an official Passbook QR sticker.' };
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return { isValid: false, error: 'External website QR detected. Please scan your official Passbook QR sticker.' };
  }

  return { isValid: false, error: 'Invalid QR Code: Not a valid ChitFund Manager Passbook QR.' };
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
  const [scannerWarning, setScannerWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const readerElementId = 'passbook-qr-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setScannerError(null);
    setScannerWarning(null);
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

          // Validate that the scanned QR code is strictly our app's passbook format
          const validation = extractAndValidatePassbookToken(decodedText);

          if (!validation.isValid || !validation.token) {
            // Unrecognized or foreign QR code: warn user and keep scanning!
            setScannerWarning(validation.error || 'Unrecognized QR code format.');
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = setTimeout(() => {
              setScannerWarning(null);
            }, 3000);
            return;
          }

          // Valid passbook QR token detected!
          setScannerWarning(null);
          setHasScanned(true);
          setIsProcessing(true);

          try {
            // Stop camera once valid passbook is scanned
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
              await html5QrCodeRef.current.stop();
            }
          } catch (stopErr) {
            console.warn('Scanner stop note:', stopErr);
          }

          try {
            await onScanSuccess(validation.token);
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
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current
          .stop()
          .catch((e) => console.warn('Scanner cleanup warning:', e));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = async () => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
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
          <div className={`relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 shadow-inner flex items-center justify-center transition-colors ${
            scannerWarning ? 'border-amber-500/80 animate-shake' : 'border-indigo-500/40'
          }`}>
            <div id={readerElementId} className="w-full h-full object-cover" />

            {/* Target Scanning Overlay Frame */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className={`w-48 h-48 border-2 border-dashed rounded-xl relative transition-colors ${
                scannerWarning ? 'border-amber-400' : 'border-indigo-400/70 animate-pulse'
              }`}>
                {/* Corner Markers */}
                <div className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 ${scannerWarning ? 'border-amber-400' : 'border-indigo-400'}`} />
                <div className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 ${scannerWarning ? 'border-amber-400' : 'border-indigo-400'}`} />
                <div className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 ${scannerWarning ? 'border-amber-400' : 'border-indigo-400'}`} />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 ${scannerWarning ? 'border-amber-400' : 'border-indigo-400'}`} />
              </div>
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                <RefreshCw className="animate-spin text-indigo-400" size={28} />
                <span className="text-xs font-bold">Verifying Passbook Token...</span>
              </div>
            )}
          </div>

          {/* Warning for foreign / invalid QR codes */}
          {scannerWarning && (
            <div className="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 max-w-sm text-left animate-in fade-in duration-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold block">Invalid QR Code</span>
                <span className="text-[11px] text-amber-200/90">{scannerWarning}</span>
              </div>
            </div>
          )}

          {scannerError ? (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2 max-w-sm text-left">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{scannerError}</span>
            </div>
          ) : !scannerWarning && (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Official Passbook QR verification active</span>
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
