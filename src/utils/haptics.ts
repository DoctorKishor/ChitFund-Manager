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
}
