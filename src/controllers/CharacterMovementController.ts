// CharacterMovementController: Tracks the detective mascot's live map node position,
// smooth walking transition between missions, and celebratory/curious states.

import { useEffect, useRef, useState } from 'react';

export type CharacterMotionState = 'idle' | 'walking' | 'celebrating' | 'exploring';

const CHAR_NODE_STORAGE_KEY = 'reading_quest_char_node_v1';

export function loadLastCharacterNodeId(): string | null {
  try {
    return localStorage.getItem(CHAR_NODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLastCharacterNodeId(nodeId: string): void {
  try {
    localStorage.setItem(CHAR_NODE_STORAGE_KEY, nodeId);
  } catch {
    // Ignore storage errors
  }
}

export function useCharacterMovement(
  targetNodeId: string | null,
  justCompletedId: string | null,
  justUnlockedZone: boolean,
) {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(
    () => loadLastCharacterNodeId() ?? targetNodeId,
  );
  const [motionState, setMotionState] = useState<CharacterMotionState>('idle');
  const prevTargetRef = useRef<string | null>(currentNodeId);

  useEffect(() => {
    if (!targetNodeId) return;

    if (prevTargetRef.current && prevTargetRef.current !== targetNodeId) {
      setMotionState('walking');
      const walkTimer = window.setTimeout(() => {
        setCurrentNodeId(targetNodeId);
        saveLastCharacterNodeId(targetNodeId);
        if (justUnlockedZone) {
          setMotionState('exploring');
        } else if (justCompletedId) {
          setMotionState('celebrating');
        } else {
          setMotionState('idle');
        }
      }, 360);

      const settleTimer = window.setTimeout(() => {
        setMotionState('idle');
      }, 1500);

      prevTargetRef.current = targetNodeId;
      return () => {
        window.clearTimeout(walkTimer);
        window.clearTimeout(settleTimer);
      };
    }

    setCurrentNodeId(targetNodeId);
    saveLastCharacterNodeId(targetNodeId);
    prevTargetRef.current = targetNodeId;

    if (justUnlockedZone) {
      setMotionState('exploring');
      const t = window.setTimeout(() => setMotionState('idle'), 1300);
      return () => window.clearTimeout(t);
    }
    if (justCompletedId) {
      setMotionState('celebrating');
      const t = window.setTimeout(() => setMotionState('idle'), 1300);
      return () => window.clearTimeout(t);
    }
  }, [targetNodeId, justCompletedId, justUnlockedZone]);

  return {
    characterNodeId: currentNodeId ?? targetNodeId,
    motionState,
    triggerExplore: () => {
      setMotionState('exploring');
      window.setTimeout(() => setMotionState('idle'), 1100);
    },
  };
}
