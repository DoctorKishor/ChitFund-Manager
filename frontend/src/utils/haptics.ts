/**
 * Web Haptic & Audio Feedback Utilities
 * Uses the Web Vibration API (navigator.vibrate) and Web Audio API synthesizer.
 */

// 1. Trigger haptic vibration pattern
export function triggerHapticFeedback(type: 'success' | 'warning' | 'error' | 'light' = 'light') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  try {
    if ('vibrate' in navigator) {
      if (type === 'success') {
        // Crisp single tap
        navigator.vibrate(60);
      } else if (type === 'warning') {
        // Double pulse buzz
        navigator.vibrate([80, 50, 80]);
      } else if (type === 'error') {
        // Triple rejection buzz
        navigator.vibrate([100, 50, 100, 50, 100]);
      } else {
        // Light tap
        navigator.vibrate(40);
      }
    }
  } catch (err) {
    // Graceful fallback if device permissions restrict vibration
  }

  // Also play synthesized micro-tone for complete tactile feedback across all devices
  playMicroTone(type);
}

// 2. Synthesize subtle audio tone using Web Audio API (Zero audio assets required)
function playMicroTone(type: 'success' | 'warning' | 'error' | 'light') {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant high chime (880Hz -> 1174Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'warning' || type === 'error') {
      // Low double buzz tone (220Hz -> 160Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch {
    // Audio context initialization ignored if user hasn't interacted yet
  }
}
