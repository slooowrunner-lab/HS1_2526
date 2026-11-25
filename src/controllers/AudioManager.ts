// AudioManager: Web Audio API procedural BGM & SFX engine with persisted volume/mute settings
// Zero external audio file dependencies — never breaks if network/assets are absent.

export interface AudioSettings {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  bgmVolume: number; // 0.0 ~ 1.0
  sfxVolume: number; // 0.0 ~ 1.0
  masterMuted: boolean;
}

export type BgmScene = 'none' | 'map' | 'workspace';

const AUDIO_STORAGE_KEY = 'reading_quest_audio_v1';

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.45,
  sfxVolume: 0.7,
  masterMuted: false,
};

export function loadAudioSettings(legacySoundEnabled?: boolean): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_AUDIO_SETTINGS,
        sfxEnabled: legacySoundEnabled !== undefined ? legacySoundEnabled : true,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      bgmEnabled:
        parsed.bgmEnabled !== undefined ? Boolean(parsed.bgmEnabled) : true,
      sfxEnabled:
        parsed.sfxEnabled !== undefined ? Boolean(parsed.sfxEnabled) : true,
      bgmVolume:
        typeof parsed.bgmVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.bgmVolume))
          : DEFAULT_AUDIO_SETTINGS.bgmVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.sfxVolume))
          : DEFAULT_AUDIO_SETTINGS.sfxVolume,
      masterMuted: Boolean(parsed.masterMuted),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = loadAudioSettings();
  private userUnlocked = false;
  private currentScene: BgmScene = 'none';
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.userUnlocked = true;
        this.ensureContext();
        if (this.currentScene !== 'none') {
          this.restartBgmLoop();
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended' && this.userUnlocked) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(next: AudioSettings): void {
    this.settings = { ...next };
    saveAudioSettings(this.settings);
    if (this.settings.masterMuted || !this.settings.bgmEnabled) {
      this.stopBgmLoop();
    } else if (this.userUnlocked && this.currentScene !== 'none') {
      this.restartBgmLoop();
    }
  }

  public setScene(scene: BgmScene): void {
    if (this.currentScene === scene) return;
    this.currentScene = scene;
    this.bgmStep = 0;
    this.stopBgmLoop();
    if (
      scene !== 'none' &&
      this.userUnlocked &&
      this.settings.bgmEnabled &&
      !this.settings.masterMuted
    ) {
      this.restartBgmLoop();
    }
  }

  private stopBgmLoop(): void {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private restartBgmLoop(): void {
    this.stopBgmLoop();
    if (
      typeof window === 'undefined' ||
      !this.userUnlocked ||
      !this.settings.bgmEnabled ||
      this.settings.masterMuted ||
      this.currentScene === 'none'
    ) {
      return;
    }

    // Gentle pentatonic cozy chords/notes
    // Map: cheerful bright cozy adventure pluck (480ms step)
    // Workspace: calm low-volume focus study chimes (850ms step)
    const isMap = this.currentScene === 'map';
    const intervalMs = isMap ? 520 : 900;

    const mapNotes = [
      523.25, // C5
      659.25, // E5
      783.99, // G5
      659.25, // E5
      587.33, // D5
      659.25, // E5
      880.0, // A5
      783.99, // G5
    ];
    const studyNotes = [
      392.0, // G4
      440.0, // A4
      523.25, // C5
      493.88, // B4
      349.23, // F4
      440.0, // A4
      523.25, // C5
      440.0, // A4
    ];

    const playStep = () => {
      if (
        !this.settings.bgmEnabled ||
        this.settings.masterMuted ||
        this.settings.bgmVolume <= 0.01
      ) {
        return;
      }
      const notes = isMap ? mapNotes : studyNotes;
      const freq = notes[this.bgmStep % notes.length];
      this.bgmStep += 1;
      const gainLevel = (isMap ? 0.026 : 0.018) * this.settings.bgmVolume;
      this.playTone(
        freq,
        isMap ? 0.36 : 0.72,
        0,
        isMap ? 'sine' : 'triangle',
        gainLevel,
      );
    };

    playStep();
    this.bgmTimer = window.setInterval(playStep, intervalMs);
  }

  private scheduleTone(
    ctx: AudioContext,
    freq: number,
    durationSec: number,
    startOffsetSec: number,
    type: OscillatorType,
    peakGain: number,
    lowpassHz?: number,
  ): void {
    const now = ctx.currentTime + startOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    const safePeak = Math.max(0.0015, peakGain);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(safePeak, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    if (lowpassHz && typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassHz, now);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.03);
  }

  private playTone(
    freq: number,
    durationSec: number,
    startOffsetSec: number,
    type: OscillatorType = 'sine',
    peakGain = 0.08,
    lowpassHz?: number,
  ): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state === 'running') {
        this.scheduleTone(
          ctx,
          freq,
          durationSec,
          startOffsetSec,
          type,
          peakGain,
          lowpassHz,
        );
      } else if (ctx.state === 'suspended' && this.userUnlocked) {
        ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running') {
              this.scheduleTone(
                ctx,
                freq,
                durationSec,
                startOffsetSec,
                type,
                peakGain,
                lowpassHz,
              );
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore Web Audio errors in restricted sandboxes
    }
  }

  private canPlaySfx(overrideEnabled?: boolean): number {
    if (this.settings.masterMuted) return 0;
    const enabled =
      overrideEnabled !== undefined ? overrideEnabled : this.settings.sfxEnabled;
    if (!enabled || !this.settings.sfxEnabled) return 0;
    return this.settings.sfxVolume;
  }

  public playClue(overrideEnabled?: boolean): void {
    const vol = this.canPlaySfx(overrideEnabled);
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(587.33, 0.13, 0, 'triangle', 0.07 * vol);
    this.playTone(880, 0.16, 0.06, 'triangle', 0.07 * vol);
  }

  // Bright, crisp ascending major fanfare + sparkle for CORRECT answers
  public playSuccess(overrideEnabled?: boolean): void {
    const vol = this.canPlaySfx(overrideEnabled);
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(523.25, 0.12, 0, 'triangle', 0.1 * vol); // C5
    this.playTone(659.25, 0.12, 0.07, 'triangle', 0.1 * vol); // E5
    this.playTone(783.99, 0.14, 0.14, 'triangle', 0.11 * vol); // G5
    this.playTone(1046.5, 0.28, 0.21, 'sine', 0.12 * vol); // C6
    this.playTone(1567.98, 0.22, 0.24, 'sine', 0.045 * vol); // G6 sparkle overtone
  }

  public playReward(overrideEnabled?: boolean): void {
    const vol = this.canPlaySfx(overrideEnabled);
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(523.25, 0.12, 0, 'sine', 0.08 * vol);
    this.playTone(659.25, 0.12, 0.09, 'sine', 0.08 * vol);
    this.playTone(783.99, 0.12, 0.18, 'sine', 0.08 * vol);
    this.playTone(1046.5, 0.32, 0.27, 'sine', 0.09 * vol);
  }

  public playZoneUnlock(): void {
    const vol = this.canPlaySfx();
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(440, 0.14, 0, 'triangle', 0.07 * vol);
    this.playTone(554.37, 0.14, 0.09, 'triangle', 0.07 * vol);
    this.playTone(659.25, 0.16, 0.18, 'triangle', 0.08 * vol);
    this.playTone(880, 0.3, 0.27, 'sine', 0.09 * vol);
  }

  public playLevelUp(): void {
    const vol = this.canPlaySfx();
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(587.33, 0.12, 0, 'sine', 0.08 * vol);
    this.playTone(739.99, 0.12, 0.09, 'sine', 0.08 * vol);
    this.playTone(880, 0.12, 0.18, 'sine', 0.08 * vol);
    this.playTone(1174.66, 0.36, 0.27, 'sine', 0.1 * vol);
  }

  public playObjectDiscover(): void {
    const vol = this.canPlaySfx();
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(659.25, 0.11, 0, 'sine', 0.07 * vol);
    this.playTone(987.77, 0.22, 0.08, 'sine', 0.08 * vol);
  }

  public playStepMove(): void {
    const vol = this.canPlaySfx();
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(440, 0.08, 0, 'sine', 0.04 * vol);
  }

  // Distinct low descending warm buzzer double-boop for WRONG / TRY-AGAIN answers
  public playTryAgain(overrideEnabled?: boolean): void {
    const vol = this.canPlaySfx(overrideEnabled);
    if (vol <= 0) return;
    this.userUnlocked = true;
    this.playTone(233.08, 0.14, 0, 'sawtooth', 0.085 * vol, 620); // Bb3 muted buzz
    this.playTone(174.61, 0.24, 0.13, 'sawtooth', 0.095 * vol, 540); // F3 lower buzz
  }
}

export const AudioManager = new AudioManagerImpl();
