// Preserved soundEffects.ts exports, powered by AudioManager for unified SFX volume & mute control

import { AudioManager } from '../controllers/AudioManager';

export function playClueChime(enabled?: boolean) {
  AudioManager.playClue(enabled);
}

export function playSuccessChime(enabled?: boolean) {
  AudioManager.playSuccess(enabled);
}

export function playBadgeFanfare(enabled?: boolean) {
  AudioManager.playReward(enabled);
}

export function playTryAgainSoft(enabled?: boolean) {
  AudioManager.playTryAgain(enabled);
}
