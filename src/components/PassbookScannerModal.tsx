'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, QrCode, AlertTriangle } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

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

  const qrCodeSuccessCallbackRef = useRef<((decodedText: string) => Promise<void>) | null>(null);

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
            // Unrecognized or foreign QR code: trigger warning haptic & keep scanning!
            triggerHapticFeedback('warning');
            setScannerWarning(validation.error || 'Unrecognized QR code format.');
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = setTimeout(() => {
              setScannerWarning(null);
            }, 3000);
            return;
          }

          setIsProcessing(true);

          try {
            // Stop camera once scan is detected
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
              await html5QrCodeRef.current.stop();
            }
          } catch (stopErr) {
            console.warn('Scanner stop note:', stopErr);
          }

          try {
            await onScanSuccess(validation.token);
            // Successful pair/login: trigger success haptic
            triggerHapticFeedback('success');
            setHasScanned(true);
          } catch (err: any) {
            // Rejection or already-linked error: trigger error/warning haptic!
            triggerHapticFeedback('error');
            setScannerError(err.message || 'Failed to process scanned QR code.');
            setIsProcessing(false);
            setHasScanned(false);
          }
        };

        qrCodeSuccessCallbackRef.current = qrCodeSuccessCallback;

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

  const handleRetryScan = async () => {
    setScannerError(null);
    setScannerWarning(null);
    setIsProcessing(false);
    setHasScanned(false);

    try {
      if (html5QrCodeRef.current && qrCodeSuccessCallbackRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallbackRef.current,
          () => {}
        );
      }
    } catch (err) {
      console.warn('Retry scan camera start note:', err);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-md max-h-[90dvh] overflow-hidden shadow-2xl relative flex flex-col my-auto text-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 shadow-2xs">
              <Camera size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-display truncate">{title}</h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                {targetMemberName ? `Pairing to ${targetMemberName}` : subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera View Area */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center bg-white">
          <div className={`relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 shadow-inner flex items-center justify-center transition-colors ${
            scannerWarning ? 'border-amber-400 animate-shake' : 'border-indigo-600/40'
          }`}>
            <div id={readerElementId} className="w-full h-full object-cover" />

            {/* Target Scanning Overlay Frame */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className={`w-48 h-48 border-2 border-dashed rounded-xl relative transition-colors ${
                scannerWarning ? 'border-amber-400' : 'border-indigo-400/80 animate-pulse'
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
            <div className="mt-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 max-w-sm text-left animate-in fade-in duration-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-bold block">Invalid QR Code</span>
                <span className="text-[11px] text-amber-700 leading-relaxed block mt-0.5">{scannerWarning}</span>
              </div>
            </div>
          )}

          {scannerError ? (
            <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col items-start gap-2.5 max-w-sm text-left animate-in fade-in duration-200">
              <div className="flex items-start gap-2 w-full">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <span className="font-bold text-rose-900 block">Cannot Link QR Code</span>
                  <span className="text-[11px] text-rose-700 leading-relaxed block mt-0.5">
                    {scannerError}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRetryScan}
                className="w-full mt-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Scan Another Passbook Sticker</span>
              </button>
            </div>
          ) : !scannerWarning && (
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Official Passbook QR verification active</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

