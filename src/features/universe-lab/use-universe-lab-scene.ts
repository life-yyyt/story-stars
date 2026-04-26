import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';

import { clamp } from '@/src/lib/star-utils';
import { UniverseStar } from '@/src/types/domain';

import { UNIVERSE_LAB_CAMERA } from './universe-lab-constants';
import {
  createUniverseLabDistanceRange,
  createUniverseLabOrbit,
  UniverseLabDistanceRange,
  UniverseLabOrbit,
} from './universe-lab-data';

const STARTUP_IMMUNITY_MS = 700;
const READER_OPEN_MS = 320;
const READER_CLOSE_MS = 240;
const TAP_SUPPRESSION_MS = 260;
const PASSIVE_FOCUS_MS = 2400;
const FOCUS_AUTO_FRAME_GUARD_MS = 1600;

export type UniverseLabReaderStatus = 'closed' | 'opening' | 'open' | 'closing';

export interface UniverseLabSceneState {
  stars: UniverseStar[];
  desiredOrbit: MutableRefObject<UniverseLabOrbit>;
  currentOrbit: MutableRefObject<UniverseLabOrbit>;
  cameraRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  sceneDistance: number;
  focusedStarId: string | null;
  activeStoryId: string | null;
  readerStatus: UniverseLabReaderStatus;
  controlsLocked: boolean;
  frameScene: () => void;
  setViewport: (width: number, height: number) => void;
  setSceneDistance: Dispatch<SetStateAction<number>>;
  panBy: (deltaX: number, deltaY: number) => boolean;
  beginZoom: () => boolean;
  zoomFromScale: (scale: number) => boolean;
  zoomByWheel: (deltaY: number) => boolean;
  handleTapAtPoint: (x: number, y: number) => void;
  focusStarById: (storyId: string, options?: { immediate?: boolean; openReader?: boolean }) => boolean;
  closeReader: () => void;
  suppressTap: (reason: 'pan' | 'pinch') => void;
  canHandleTap: () => boolean;
  lastPanApplyAtRef: MutableRefObject<number>;
  lastPinchApplyAtRef: MutableRefObject<number>;
}

const cloneOrbit = (orbit: UniverseLabOrbit): UniverseLabOrbit => ({
  yaw: orbit.yaw,
  pitch: orbit.pitch,
  distance: orbit.distance,
  target: orbit.target.clone(),
});

const createStarSignature = (stars: UniverseStar[]) =>
  stars.map((star) => `${star.id}:${star.x},${star.y},${star.z}`).join('|');

export const useUniverseLabScene = (sourceStars: UniverseStar[] = []): UniverseLabSceneState => {
  const stars = sourceStars;
  const starSignature = useMemo(() => createStarSignature(stars), [stars]);
  const starsRef = useRef(stars);
  const viewportRef = useRef({ width: 390, height: 844 });
  const initialOrbit = useMemo(() => createUniverseLabOrbit(stars, viewportRef.current), [stars]);
  const initialDistanceRange = useMemo(
    () => createUniverseLabDistanceRange(stars, viewportRef.current),
    [stars]
  );
  const desiredOrbit = useRef<UniverseLabOrbit>(cloneOrbit(initialOrbit));
  const currentOrbit = useRef<UniverseLabOrbit>(cloneOrbit(initialOrbit));
  const distanceRangeRef = useRef<UniverseLabDistanceRange>(initialDistanceRange);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const zoomOriginRef = useRef(initialOrbit.distance);
  const browseOrbitRef = useRef<UniverseLabOrbit>(cloneOrbit(initialOrbit));
  const startupLockedUntilRef = useRef(Date.now() + STARTUP_IMMUNITY_MS);
  const lastPanApplyAtRef = useRef(0);
  const lastPinchApplyAtRef = useRef(0);
  const suppressTapUntilRef = useRef(0);
  const autoFrameBlockedUntilRef = useRef(0);
  const readerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passiveFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sceneDistance, setSceneDistance] = useState(initialOrbit.distance);
  const [focusedStarId, setFocusedStarId] = useState<string | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [readerStatus, setReaderStatus] = useState<UniverseLabReaderStatus>('closed');

  starsRef.current = stars;

  const isInputLocked = () => Date.now() < startupLockedUntilRef.current;
  const controlsLocked = readerStatus !== 'closed';
  const suppressTap = (_reason: 'pan' | 'pinch') => {
    suppressTapUntilRef.current = Date.now() + TAP_SUPPRESSION_MS;
  };
  const canHandleTap = () => !controlsLocked && !isInputLocked() && Date.now() >= suppressTapUntilRef.current;

  const clearReaderTimer = useCallback(() => {
    if (readerTimerRef.current) {
      clearTimeout(readerTimerRef.current);
      readerTimerRef.current = null;
    }
  }, []);

  const clearPassiveFocusTimer = useCallback(() => {
    if (passiveFocusTimerRef.current) {
      clearTimeout(passiveFocusTimerRef.current);
      passiveFocusTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearReaderTimer();
      clearPassiveFocusTimer();
    },
    [clearPassiveFocusTimer, clearReaderTimer]
  );

  const frameScene = useCallback(() => {
    const currentStars = starsRef.current;
    clearReaderTimer();
    distanceRangeRef.current = createUniverseLabDistanceRange(currentStars, viewportRef.current);

    if (Date.now() < autoFrameBlockedUntilRef.current) {
      return;
    }

    const nextOrbit = createUniverseLabOrbit(currentStars, viewportRef.current);
    desiredOrbit.current = cloneOrbit(nextOrbit);
    currentOrbit.current = cloneOrbit(nextOrbit);
    browseOrbitRef.current = cloneOrbit(nextOrbit);
    setSceneDistance(nextOrbit.distance);
    setFocusedStarId(null);
    setActiveStoryId(null);
    setReaderStatus('closed');
    startupLockedUntilRef.current = Date.now() + STARTUP_IMMUNITY_MS;
  }, [clearReaderTimer]);

  useEffect(() => {
    frameScene();
  }, [frameScene, starSignature]);

  const setViewport = (width: number, height: number) => {
    const previous = viewportRef.current;
    if (Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1) {
      return;
    }

    viewportRef.current = { width, height };
    frameScene();
  };

  const panBy = (deltaX: number, deltaY: number) => {
    if (controlsLocked || isInputLocked()) {
      return false;
    }

    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) {
      return false;
    }

    desiredOrbit.current.yaw -= deltaX * 0.0048;
    desiredOrbit.current.pitch = clamp(desiredOrbit.current.pitch - deltaY * 0.0036, -0.44, 0.22);
    suppressTap('pan');
    return true;
  };

  const beginZoom = () => {
    if (controlsLocked || isInputLocked()) {
      return false;
    }

    zoomOriginRef.current = desiredOrbit.current.distance;
    return true;
  };

  const zoomFromScale = (scale: number) => {
    if (controlsLocked || isInputLocked()) {
      return false;
    }

    if (Math.abs(scale - 1) < 0.015) {
      return false;
    }

    desiredOrbit.current.distance = clamp(
      zoomOriginRef.current / Math.pow(scale, 1.48),
      distanceRangeRef.current.minDistance,
      distanceRangeRef.current.maxDistance
    );
    suppressTap('pinch');
    return true;
  };

  const zoomByWheel = (deltaY: number) => {
    if (controlsLocked) {
      return false;
    }

    if (Math.abs(deltaY) < 0.01) {
      return false;
    }

    desiredOrbit.current.distance = clamp(
      desiredOrbit.current.distance + deltaY * 0.2,
      distanceRangeRef.current.minDistance,
      distanceRangeRef.current.maxDistance
    );
    suppressTap('pinch');
    return true;
  };

  const openReaderForStar = useCallback(
    (star: UniverseStar) => {
      if (controlsLocked || Date.now() < startupLockedUntilRef.current || !star.clickable) {
        return;
      }

      clearReaderTimer();
      browseOrbitRef.current = cloneOrbit(desiredOrbit.current);
      const nextOrbit = cloneOrbit(desiredOrbit.current);
      nextOrbit.distance = clamp(
        nextOrbit.distance * UNIVERSE_LAB_CAMERA.readerApproachScale,
        distanceRangeRef.current.minDistance,
        distanceRangeRef.current.maxDistance
      );
      nextOrbit.target.lerp(new THREE.Vector3(star.x, star.y, star.z), 0.1);
      nextOrbit.target.y += 10;
      desiredOrbit.current = nextOrbit;

      setFocusedStarId(star.id);
      setActiveStoryId(star.id);
      setReaderStatus('opening');
      readerTimerRef.current = setTimeout(() => {
        setReaderStatus('open');
        readerTimerRef.current = null;
      }, READER_OPEN_MS);
    },
    [clearReaderTimer, controlsLocked]
  );

  const focusStarById = useCallback(
    (storyId: string, options: { immediate?: boolean; openReader?: boolean } = {}) => {
      const star = stars.find((item) => item.id === storyId);
      if (!star) {
        return false;
      }

      if (options.openReader) {
        openReaderForStar(star);
        return true;
      }

      clearPassiveFocusTimer();
      const nextOrbit = cloneOrbit(desiredOrbit.current);
      nextOrbit.distance = clamp(
        distanceRangeRef.current.minDistance,
        distanceRangeRef.current.minDistance,
        distanceRangeRef.current.maxDistance
      );
      nextOrbit.target.set(star.x, star.y, star.z);
      autoFrameBlockedUntilRef.current = Date.now() + FOCUS_AUTO_FRAME_GUARD_MS;
      desiredOrbit.current = nextOrbit;
      if (options.immediate ?? true) {
        currentOrbit.current = cloneOrbit(nextOrbit);
        setSceneDistance(nextOrbit.distance);
      }
      setFocusedStarId(star.id);

      passiveFocusTimerRef.current = setTimeout(() => {
        setFocusedStarId((current) => (current === star.id ? null : current));
        passiveFocusTimerRef.current = null;
      }, PASSIVE_FOCUS_MS);

      return true;
    },
    [clearPassiveFocusTimer, openReaderForStar, stars]
  );

  const closeReader = useCallback(() => {
    if (readerStatus === 'closed' || readerStatus === 'closing') {
      return;
    }

    clearReaderTimer();
    desiredOrbit.current = cloneOrbit(browseOrbitRef.current);
    setReaderStatus('closing');
    readerTimerRef.current = setTimeout(() => {
      setReaderStatus('closed');
      setActiveStoryId(null);
      setFocusedStarId(null);
      readerTimerRef.current = null;
    }, READER_CLOSE_MS);
  }, [clearReaderTimer, readerStatus]);

  const handleTapAtPoint = (x: number, y: number) => {
    if (!canHandleTap()) {
      return;
    }

    const camera = cameraRef.current;
    const viewport = viewportRef.current;
    if (!camera || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    let nearestStar: UniverseStar | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const thresholdBase = 22 + sceneDistance / 46;

    for (const star of stars) {
      if (!star.clickable) {
        continue;
      }

      const projected = new THREE.Vector3(star.x, star.y, star.z).project(camera);
      if (projected.z < -1 || projected.z > 1) {
        continue;
      }

      const screenX = (projected.x * 0.5 + 0.5) * viewport.width;
      const screenY = (-projected.y * 0.5 + 0.5) * viewport.height;
      const distance = Math.hypot(screenX - x, screenY - y);
      const threshold = thresholdBase + star.sizeFactor * 10;

      if (distance <= threshold && distance < nearestDistance) {
        nearestStar = star;
        nearestDistance = distance;
      }
    }

    if (nearestStar) {
      openReaderForStar(nearestStar);
    }
  };

  return {
    stars,
    desiredOrbit,
    currentOrbit,
    cameraRef,
    sceneDistance,
    focusedStarId,
    activeStoryId,
    readerStatus,
    controlsLocked,
    frameScene,
    setViewport,
    setSceneDistance,
    panBy,
    beginZoom,
    zoomFromScale,
    zoomByWheel,
    handleTapAtPoint,
    focusStarById,
    closeReader,
    suppressTap,
    canHandleTap,
    lastPanApplyAtRef,
    lastPinchApplyAtRef,
  };
};
