import { AudioManager } from '../controllers/AudioManager';

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore speech synthesis errors in restricted contexts
  }
}

export function speakEnglish(text: string, rate = 0.92): void {
  if (!isTtsSupported()) return;
  const clean = text.trim();
  if (!clean) return;

  const settings = AudioManager.getSettings();
  if (settings.masterMuted) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-US';
    utterance.rate = Math.min(1.3, Math.max(0.6, rate));
    utterance.pitch = 1.0;
    utterance.volume = Math.min(1, Math.max(0.2, settings.sfxVolume));

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    if (preferred) {
      utterance.voice = preferred;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors gracefully
  }
}
