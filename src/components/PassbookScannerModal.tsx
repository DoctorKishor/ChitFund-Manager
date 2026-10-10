'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertTriangle, ShieldCheck, Zap, ZapOff, Check, Sparkles } from 'lucide-react';
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

  // Case C: Specific recognizable third-party QR payloads
  if (clean.startsWith('upi://')) {
    return { isValid: false, error: 'UPI Payment QR detected. Please scan an official Passbook QR sticker.' };
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return { isValid: false, error: 'External Web QR detected. Please scan an official Passbook QR sticker.' };
  }

  return { isValid: false, error: 'Unrecognized QR code: Not an official Passbook sticker.' };
}

interface TargetBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  angle: number;
  isTracking: boolean;
}

export default function PassbookScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Passbook QR Code',
  subtitle = 'Point camera at the QR code on the physical passbook',
  targetMemberName,
}: PassbookScannerModalProps) {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerWarning, setScannerWarning] = useState<string | null>(null);
  const [testPayload, setTestPayload] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  const [targetBox, setTargetBox] = useState<TargetBox>({
    centerX: 0,
    centerY: 0,
    width: 240,
    height: 240,
    angle: 0,
    isTracking: false,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isLockedRef = useRef<boolean>(false);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const readerElementId = 'passbook-qr-reader-fullscreen';

  const qrCodeSuccessCallbackRef = useRef<((decodedText: string) => Promise<void>) | null>(null);

  // Check torch capability
  const checkTorchCapability = () => {
    try {
      const videoElem = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
      if (videoElem && videoElem.srcObject) {
        const stream = videoElem.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const capabilities = track.getCapabilities() as any;
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          }
        }
      }
    } catch {
      // Torch not supported on device
    }
  };

  const toggleTorch = async () => {
    try {
      const videoElem = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
      if (videoElem && videoElem.srcObject) {
        const stream = videoElem.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const nextState = !isTorchOn;
          await (track as any).applyConstraints({
            advanced: [{ torch: nextState }],
          });
          setIsTorchOn(nextState);
          triggerHapticFeedback('light');
        }
      }
    } catch (err) {
      console.warn('Torch toggle warning:', err);
    }
  };

  // Helper: map video frame pixel coordinates to display container coordinates
  const mapVideoPointToContainer = (
    point: { x: number; y: number },
    video: HTMLVideoElement,
    container: HTMLElement
  ) => {
    const cRect = container.getBoundingClientRect();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return { x: point.x, y: point.y };

    const vAspect = vw / vh;
    const cAspect = cRect.width / cRect.height;
    let renderW: number, renderH: number, offX: number, offY: number;

    if (cAspect > vAspect) {
      renderW = cRect.width;
      renderH = cRect.width / vAspect;
      offX = 0;
      offY = (cRect.height - renderH) / 2;
    } else {
      renderH = cRect.height;
      renderW = cRect.height * vAspect;
      offY = 0;
      offX = (cRect.width - renderW) / 2;
    }

    const scale = renderW / vw;
    return {
      x: offX + point.x * scale,
      y: offY + point.y * scale,
    };
  };

  // Handle successful QR detection from either BarcodeDetector or Html5Qrcode
  const handleQrDetected = async (decodedText: string) => {
    if (isProcessing || isLockedRef.current) return;

    const validation = extractAndValidatePassbookToken(decodedText);

    if (!validation.isValid || !validation.token) {
      triggerHapticFeedback('warning');
      setScannerWarning(validation.error || 'Unrecognized QR code format.');
      setTestPayload(decodedText);

      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setScannerWarning(null);
      }, 3500);
      return;
    }

    // Official Passbook Token Recognized! Lock target!
    isLockedRef.current = true;
    setIsLocked(true);
    triggerHapticFeedback('success');

    // Pause camera feed
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.pause();
      }
    } catch {
      // ignore pause error
    }

    // Tactile 350ms micro-moment for the user to experience the target lock
    await new Promise((resolve) => setTimeout(resolve, 350));

    setIsProcessing(true);

    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (stopErr) {
      console.warn('Scanner stop note:', stopErr);
    }

    try {
      await onScanSuccess(validation.token);
    } catch (err: any) {
      triggerHapticFeedback('error');
      setScannerError(err.message || 'Failed to process scanned QR code.');
      setIsProcessing(false);
      setIsLocked(false);
      isLockedRef.current = false;
    }
  };

  // ── Real-Time Dynamic Target Tracking Loop (Moves & Rotates Over QR Code) ──
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let animationFrameId: number;

    const trackLoop = async () => {
      if (!active || isLockedRef.current) return;

      try {
        const videoElem = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
        const container = containerRef.current;

        if (videoElem && videoElem.readyState >= 2 && container && 'BarcodeDetector' in window) {
          const detector =
            (window as any)._passbookBarcodeDetector ||
            new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          (window as any)._passbookBarcodeDetector = detector;

          const barcodes = await detector.detect(videoElem);

          if (barcodes && barcodes.length > 0 && active && !isLockedRef.current) {
            const raw = barcodes[0];

            if (raw.cornerPoints && raw.cornerPoints.length >= 4) {
              const p0 = mapVideoPointToContainer(raw.cornerPoints[0], videoElem, container);
              const p1 = mapVideoPointToContainer(raw.cornerPoints[1], videoElem, container);
              const p2 = mapVideoPointToContainer(raw.cornerPoints[2], videoElem, container);
              const p3 = mapVideoPointToContainer(raw.cornerPoints[3], videoElem, container);

              const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
              const cy = (p0.y + p1.y + p2.y + p3.y) / 4;

              const w = Math.hypot(p1.x - p0.x, p1.y - p0.y);
              const h = Math.hypot(p3.x - p0.x, p3.y - p0.y);

              // Calculate true rotation angle of the QR code in degrees
              const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);

              setTargetBox({
                centerX: cx,
                centerY: cy,
                width: Math.max(70, Math.min(container.clientWidth - 20, w + 16)),
                height: Math.max(70, Math.min(container.clientHeight - 40, h + 16)),
                angle: angle,
                isTracking: true,
              });

              // Also trigger detection check if rawValue is present
              if (raw.rawValue && !isLockedRef.current) {
                handleQrDetected(raw.rawValue);
              }
            }
          } else if (!isLockedRef.current && active) {
            // When no QR code is in sight, smoothly release back to center
            setTargetBox((prev) => (prev.isTracking ? { ...prev, isTracking: false, angle: 0 } : prev));
          }
        }
      } catch {
        // Silently skip frame misses
      }

      if (active && !isLockedRef.current) {
        animationFrameId = requestAnimationFrame(trackLoop);
      }
    };

    const timer = setTimeout(() => {
      trackLoop();
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  // ── Camera Initialization via Html5Qrcode (Full Frame, NO Double Shaded Box!) ──
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    isLockedRef.current = false;
    setScannerError(null);
    setScannerWarning(null);
    setTestPayload(null);
    setIsLocked(false);
    setIsProcessing(false);
    setIsTorchOn(false);
    setHasTorch(false);
    setTargetBox({ centerX: 0, centerY: 0, width: 240, height: 240, angle: 0, isTracking: false });

    const startScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!isMounted) return;

        const qrScanner = new Html5Qrcode(readerElementId);
        html5QrCodeRef.current = qrScanner;

        const qrCodeSuccessCallback = async (decodedText: string) => {
          handleQrDetected(decodedText);
        };

        qrCodeSuccessCallbackRef.current = qrCodeSuccessCallback;

        // Start scanning WITHOUT qrbox so Html5Qrcode scans 100% of the camera
        // and NEVER injects its own duplicate #qr-shaded-region frame!
        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 25,
            // Do NOT specify qrbox! This scans full frame and prevents the 2nd frame!
          },
          qrCodeSuccessCallback,
          () => {}
        );

        if (isMounted) {
          setTimeout(checkTorchCapability, 500);
        }
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
      isLockedRef.current = false;
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
    isLockedRef.current = false;
    setScannerError(null);
    setScannerWarning(null);
    setTestPayload(null);
    setIsProcessing(false);
    setIsLocked(false);
    setTargetBox({ centerX: 0, centerY: 0, width: 240, height: 240, angle: 0, isTracking: false });

    try {
      if (html5QrCodeRef.current && qrCodeSuccessCallbackRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          { fps: 25 },
          qrCodeSuccessCallbackRef.current,
          () => {}
        );
        setTimeout(checkTorchCapability, 500);
      }
    } catch (err) {
      console.warn('Retry scan camera note:', err);
    }
  };

  const handleClose = async () => {
    isLockedRef.current = false;
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

  // Helper to simulate valid passbook token if testing with external QR code
  const handleSimulateTestScan = async () => {
    if (!testPayload) return;
    triggerHapticFeedback('success');
    setIsLocked(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsProcessing(true);
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch {}
    // Generate a deterministic testing UUID or use raw
    const fallbackUuid = '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    try {
      await onScanSuccess(fallbackUuid);
    } catch (err: any) {
      setScannerError(err.message || 'Error processing test token.');
      setIsProcessing(false);
      setIsLocked(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Global CSS to strictly hide Html5Qrcode's internal duplicate shaded borders */}
      <style jsx global>{`
        #qr-shaded-region {
          display: none !important;
          visibility: hidden !important;
        }
        #passbook-qr-reader-fullscreen svg {
          display: none !important;
        }
        #passbook-qr-reader-fullscreen img {
          display: none !important;
        }
      `}</style>

      {/* ── Immersive Full-Bleed Container Shell ── */}
      <div
        ref={containerRef}
        className="relative w-full h-full sm:h-[640px] sm:max-w-md sm:rounded-3xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl border-0 sm:border sm:border-slate-200/80 text-slate-900"
      >
        {/* Full-Bleed Camera Viewport */}
        <div
          id={readerElementId}
          className="absolute inset-0 w-full h-full object-cover [&_video]:w-full! [&_video]:h-full! [&_video]:object-cover!"
        />

        {/* Soft Camera Darkening Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-black/25 z-10" />

        {/* ── 1. Top Bar: Floating Frosted Glass Controls ── */}
        <div className="relative z-20 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between">
          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer border border-white/60"
            aria-label="Close Scanner"
          >
            <X size={18} className="stroke-[2.5]" />
          </button>

          {/* Title Pill */}
          <div className="px-3.5 py-1.5 rounded-full bg-white/90 shadow-md backdrop-blur-md border border-white/60 flex items-center gap-2 max-w-[200px]">
            <Camera size={14} className="text-brand-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900 truncate">
              {targetMemberName ? `Pair ${targetMemberName}` : title}
            </span>
          </div>

          {/* Torch / Flashlight Toggle */}
          <div className="w-10 h-10 flex items-center justify-center">
            {hasTorch ? (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
                className={`w-10 h-10 rounded-full shadow-md backdrop-blur-md flex items-center justify-center transition-all active:scale-95 cursor-pointer border ${
                  isTorchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-400/40 ring-2 ring-amber-300/40'
                    : 'bg-white/90 hover:bg-white text-slate-800 border-white/60'
                }`}
              >
                {isTorchOn ? <Zap size={18} className="fill-current" /> : <ZapOff size={18} />}
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}
          </div>
        </div>

        {/* ── 2. THE SINGLE DYNAMIC RETICLE (Moves, Resizes & Rotates Over QR Code) ── */}
        <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
          <div
            className={`transition-all duration-150 ease-out flex items-center justify-center ${
              isLocked ? 'scale-95' : 'scale-100'
            }`}
            style={
              targetBox.isTracking
                ? {
                    position: 'absolute',
                    left: `${targetBox.centerX}px`,
                    top: `${targetBox.centerY}px`,
                    width: `${targetBox.width}px`,
                    height: `${targetBox.height}px`,
                    transform: `translate(-50%, -50%) rotate(${targetBox.angle}deg)`,
                  }
                : {
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '240px',
                    height: '240px',
                    transform: 'translate(-50%, -50%) rotate(0deg)',
                  }
            }
          >
            {/* Top-Left Corner Bracket */}
            <div
              className={`absolute top-0 left-0 w-7 h-7 border-t-[4px] border-l-[4px] rounded-tl-xl transition-all duration-150 ${
                isLocked
                  ? 'border-emerald-400 drop-shadow-[0_0_18px_rgba(16,185,129,1)]'
                  : scannerWarning
                    ? 'border-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,1)] animate-shake'
                    : targetBox.isTracking
                      ? 'border-brand-400 drop-shadow-[0_0_14px_rgba(99,102,241,1)]'
                      : 'border-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]'
              }`}
            />

            {/* Top-Right Corner Bracket */}
            <div
              className={`absolute top-0 right-0 w-7 h-7 border-t-[4px] border-r-[4px] rounded-tr-xl transition-all duration-150 ${
                isLocked
                  ? 'border-emerald-400 drop-shadow-[0_0_18px_rgba(16,185,129,1)]'
                  : scannerWarning
                    ? 'border-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,1)] animate-shake'
                    : targetBox.isTracking
                      ? 'border-brand-400 drop-shadow-[0_0_14px_rgba(99,102,241,1)]'
                      : 'border-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]'
              }`}
            />

            {/* Bottom-Left Corner Bracket */}
            <div
              className={`absolute bottom-0 left-0 w-7 h-7 border-b-[4px] border-l-[4px] rounded-bl-xl transition-all duration-150 ${
                isLocked
                  ? 'border-emerald-400 drop-shadow-[0_0_18px_rgba(16,185,129,1)]'
                  : scannerWarning
                    ? 'border-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,1)] animate-shake'
                    : targetBox.isTracking
                      ? 'border-brand-400 drop-shadow-[0_0_14px_rgba(99,102,241,1)]'
                      : 'border-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]'
              }`}
            />

            {/* Bottom-Right Corner Bracket */}
            <div
              className={`absolute bottom-0 right-0 w-7 h-7 border-b-[4px] border-r-[4px] rounded-br-xl transition-all duration-150 ${
                isLocked
                  ? 'border-emerald-400 drop-shadow-[0_0_18px_rgba(16,185,129,1)]'
                  : scannerWarning
                    ? 'border-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,1)] animate-shake'
                    : targetBox.isTracking
                      ? 'border-brand-400 drop-shadow-[0_0_14px_rgba(99,102,241,1)]'
                      : 'border-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]'
              }`}
            />

            {/* Scanning Laser Beam (glides across reticle when idle) */}
            {!isLocked && !isProcessing && (
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_10px_rgba(99,102,241,0.95)] animate-laser-scan" />
            )}

            {/* Target Locked Micro-Animation: Radar Wave + Emerald Checkmark */}
            {isLocked && (
              <div className="flex items-center justify-center animate-in zoom-in-75 duration-200">
                <div className="w-16 h-16 rounded-full border-2 border-emerald-400/90 animate-ping absolute" />
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/50">
                  <Check size={26} className="stroke-[3]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Bottom Bar: Floating Status Pill & Testing Controls ── */}
        <div className="relative z-20 p-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] flex flex-col items-center justify-center gap-2.5">
          {scannerWarning ? (
            <div className="flex flex-col items-center gap-2 max-w-xs text-center animate-in fade-in duration-200">
              <div className="px-4 py-2 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg backdrop-blur-md flex items-center gap-2 border border-amber-300">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{scannerWarning}</span>
              </div>
              {/* Testing helper: allow simulating passbook with any scanned code */}
              {testPayload && (
                <button
                  type="button"
                  onClick={handleSimulateTestScan}
                  className="px-3 py-1 rounded-full bg-white/90 text-slate-900 font-bold text-[10px] shadow-md border border-white/80 hover:bg-white active:scale-95 transition-transform flex items-center gap-1 cursor-pointer pointer-events-auto"
                >
                  <Sparkles size={11} className="text-brand-600" />
                  <span>Test Pair With This Code</span>
                </button>
              )}
            </div>
          ) : scannerError ? (
            <div className="p-3 rounded-2xl bg-white/95 text-rose-900 text-xs shadow-lg backdrop-blur-md flex flex-col items-center gap-2 border border-rose-200 max-w-xs text-center animate-in fade-in">
              <span className="font-semibold">{scannerError}</span>
              <button
                type="button"
                onClick={handleRetryScan}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-transform"
              >
                <RefreshCw size={13} />
                <span>Retry Scanner</span>
              </button>
            </div>
          ) : isProcessing ? (
            <div className="px-4 py-2 rounded-full bg-white/90 text-slate-900 font-bold text-xs shadow-lg backdrop-blur-md flex items-center gap-2 border border-white/80">
              <RefreshCw size={14} className="animate-spin text-emerald-600" />
              <span>Verifying Passbook...</span>
            </div>
          ) : targetBox.isTracking ? (
            <div className="px-4 py-1.5 rounded-full bg-white/90 text-slate-900 font-bold text-[11px] shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-white/80 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Target Acquired — Hold Steady</span>
            </div>
          ) : (
            <div className="px-4 py-1.5 rounded-full bg-white/85 text-slate-800 font-semibold text-[11px] shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-white/60">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Point camera at member passbook QR</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
