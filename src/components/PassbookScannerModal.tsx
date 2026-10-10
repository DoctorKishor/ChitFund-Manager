'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { X, Camera, RefreshCw, AlertTriangle, ShieldCheck, Zap, ZapOff, Check, Sparkles, SwitchCamera } from 'lucide-react';
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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  const [targetBox, setTargetBox] = useState<TargetBox>({
    centerX: 0,
    centerY: 0,
    width: 240,
    height: 240,
    angle: 0,
    isTracking: false,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isLockedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenQrTimeRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check multiple cameras
  useEffect(() => {
    if (!isOpen || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      if (videoInputs.length > 1) {
        setHasMultipleCameras(true);
      }
    }).catch(() => {});
  }, [isOpen]);

  // Clean stream helper
  const stopCurrentStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Torch Toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
        triggerHapticFeedback('light');
      }
    } catch (err) {
      console.warn('Torch toggle warning:', err);
    }
  };

  // Flip Camera
  const toggleCameraFacing = () => {
    triggerHapticFeedback('light');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle successful QR detection
  const handleQrDetected = useCallback(async (decodedText: string) => {
    if (isProcessingRef.current || isLockedRef.current) return;

    const validation = extractAndValidatePassbookToken(decodedText);

    if (!validation.isValid || !validation.token) {
      triggerHapticFeedback('warning');
      setScannerWarning(validation.error || 'Unrecognized QR code format.');
      setTestPayload(decodedText);

      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setScannerWarning(null);
      }, 4000);
      return;
    }

    // Official Passbook Token Recognized! Lock target!
    isLockedRef.current = true;
    isProcessingRef.current = true;
    setIsLocked(true);
    triggerHapticFeedback('success');

    // Pause video track visually
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }

    // Tactile 350ms micro-moment for the user to experience the target lock
    await new Promise((resolve) => setTimeout(resolve, 350));
    setIsProcessing(true);

    try {
      await onScanSuccess(validation.token);
    } catch (err: any) {
      triggerHapticFeedback('error');
      setScannerError(err.message || 'Failed to process scanned QR code.');
      setIsProcessing(false);
      setIsLocked(false);
      isLockedRef.current = false;
      isProcessingRef.current = false;
      if (videoRef.current) {
        try {
          videoRef.current.play();
        } catch {}
      }
    }
  }, [onScanSuccess]);

  // Main Camera & jsQR Detection Loop
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    isLockedRef.current = false;
    isProcessingRef.current = false;
    setScannerError(null);
    setScannerWarning(null);
    setTestPayload(null);
    setIsLocked(false);
    setIsProcessing(false);
    setTargetBox({ centerX: 0, centerY: 0, width: 240, height: 240, angle: 0, isTracking: false });

    const startCamera = async () => {
      try {
        stopCurrentStream();

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check torch support
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as any;
          if (caps && caps.torch) {
            setHasTorch(true);
          }
        }

        // Initialize Offscreen Processing Canvas
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const canvas = offscreenCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Continuous Detection & Tracking Frame Loop
        let lastScanTimestamp = 0;

        const scanFrame = (timestamp: number) => {
          if (!isMounted || isLockedRef.current) return;

          const video = videoRef.current;
          const container = containerRef.current;

          // Process every ~33ms (approx 30fps) to ensure responsive tracking without thrashing CPU
          if (video && video.readyState >= 2 && ctx && container && timestamp - lastScanTimestamp >= 30) {
            lastScanTimestamp = timestamp;

            const vw = video.videoWidth;
            const vh = video.videoHeight;

            if (vw > 0 && vh > 0) {
              // Downsample to max dimension 640 for rapid sub-10ms decoding
              const scale = Math.min(1, 640 / Math.max(vw, vh));
              const cw = Math.round(vw * scale);
              const ch = Math.round(vh * scale);

              if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;
              }

              ctx.drawImage(video, 0, 0, cw, ch);
              const imgData = ctx.getImageData(0, 0, cw, ch);

              // Universal jsQR decoder (Works in 100% of browsers: Windows, Mac, iOS, Android)
              const qr = jsQR(imgData.data, cw, ch, {
                inversionAttempts: 'dontInvert',
              });

              if (qr && qr.location) {
                lastSeenQrTimeRef.current = Date.now();

                // Downsampled canvas coordinates
                const p0 = qr.location.topLeftCorner;
                const p1 = qr.location.topRightCorner;
                const p2 = qr.location.bottomRightCorner;
                const p3 = qr.location.bottomLeftCorner;

                // Map canvas points to raw video coordinates
                const v0 = { x: p0.x / scale, y: p0.y / scale };
                const v1 = { x: p1.x / scale, y: p1.y / scale };
                const v2 = { x: p2.x / scale, y: p2.y / scale };
                const v3 = { x: p3.x / scale, y: p3.y / scale };

                // Map video coordinates to container screen coordinates using object-cover projection
                const cRect = container.getBoundingClientRect();
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

                const toScreen = (pt: { x: number; y: number }) => ({
                  x: offX + (pt.x / vw) * renderW,
                  y: offY + (pt.y / vh) * renderH,
                });

                const s0 = toScreen(v0);
                const s1 = toScreen(v1);
                const s2 = toScreen(v2);
                const s3 = toScreen(v3);

                const cx = (s0.x + s1.x + s2.x + s3.x) / 4;
                const cy = (s0.y + s1.y + s2.y + s3.y) / 4;

                const widthDist = Math.hypot(s1.x - s0.x, s1.y - s0.y);
                const heightDist = Math.hypot(s3.x - s0.x, s3.y - s0.y);

                // Exact rotation angle in degrees
                const angleDeg = Math.atan2(s1.y - s0.y, s1.x - s0.x) * (180 / Math.PI);

                setTargetBox({
                  centerX: cx,
                  centerY: cy,
                  width: Math.max(80, Math.min(cRect.width - 20, widthDist + 24)),
                  height: Math.max(80, Math.min(cRect.height - 30, heightDist + 24)),
                  angle: angleDeg,
                  isTracking: true,
                });

                // Trigger verification check
                if (qr.data && !isLockedRef.current) {
                  handleQrDetected(qr.data);
                }
              } else {
                // If not detected in current frame, hold position for 350ms before returning to center
                const timeSinceLastSeen = Date.now() - lastSeenQrTimeRef.current;
                if (timeSinceLastSeen > 350) {
                  setTargetBox((prev) => (prev.isTracking ? { ...prev, isTracking: false, angle: 0 } : prev));
                }
              }
            }
          }

          if (isMounted && !isLockedRef.current) {
            animFrameRef.current = requestAnimationFrame(scanFrame);
          }
        };

        animFrameRef.current = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Camera startup error:', err);
        setScannerError(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera permission was denied. Please allow camera access in your browser settings.'
            : err.message || 'Unable to access camera.'
        );
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCurrentStream();
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [isOpen, facingMode, stopCurrentStream, handleQrDetected]);

  if (!isOpen) return null;

  const handleRetryScan = () => {
    isLockedRef.current = false;
    isProcessingRef.current = false;
    setScannerError(null);
    setScannerWarning(null);
    setTestPayload(null);
    setIsProcessing(false);
    setIsLocked(false);
    setTargetBox({ centerX: 0, centerY: 0, width: 240, height: 240, angle: 0, isTracking: false });
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleClose = () => {
    isLockedRef.current = false;
    isProcessingRef.current = false;
    stopCurrentStream();
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    onClose();
  };

  // Helper to simulate valid passbook token if testing with external QR code
  const handleSimulateTestScan = async () => {
    if (!testPayload) return;
    triggerHapticFeedback('success');
    setIsLocked(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsProcessing(true);
    stopCurrentStream();

    const fallbackUuid = '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    try {
      await onScanSuccess(fallbackUuid);
    } catch (err: any) {
      setScannerError(err.message || 'Error processing test token.');
      setIsProcessing(false);
      setIsLocked(false);
      isLockedRef.current = false;
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* ── Immersive Full-Bleed Container Shell ── */}
      <div
        ref={containerRef}
        className="relative w-full h-full sm:h-[640px] sm:max-w-md sm:rounded-3xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl border-0 sm:border sm:border-slate-200/80 text-slate-900"
      >
        {/* Full-Bleed Native Video Viewport (No third party wrappers or duplicate SVG boxes!) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Soft Camera Darkening Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-black/20 z-10" />

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

          {/* Action Buttons: Camera Switch & Flashlight */}
          <div className="flex items-center gap-2">
            {hasMultipleCameras && (
              <button
                type="button"
                onClick={toggleCameraFacing}
                title="Switch Camera"
                className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-md flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-white/60"
              >
                <SwitchCamera size={17} />
              </button>
            )}

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
            ) : !hasMultipleCameras ? (
              <div className="w-10 h-10" />
            ) : null}
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
                <span>Retry Camera</span>
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
