import { useCallback, useRef } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import { useUniverseLabScene } from './use-universe-lab-scene';

const PAN_THROTTLE_MS = 16;
const PINCH_THROTTLE_MS = 16;
const TAP_MOVE_CANCEL_DISTANCE = 8;

export const useUniverseLabNativeGestures = ({
  scene,
}: {
  scene: ReturnType<typeof useUniverseLabScene>;
}) => {
  const lastPanRef = useRef({ x: 0, y: 0 });
  const pendingPanRef = useRef({ x: 0, y: 0 });
  const latestPinchScaleRef = useRef(1);
  const gestureMovedRef = useRef(false);

  const gesture = Gesture.Simultaneous(
    Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => {
        lastPanRef.current = { x: 0, y: 0 };
        pendingPanRef.current = { x: 0, y: 0 };
        gestureMovedRef.current = false;
      })
      .onUpdate((event) => {
        const deltaX = event.translationX - lastPanRef.current.x;
        const deltaY = event.translationY - lastPanRef.current.y;
        lastPanRef.current = { x: event.translationX, y: event.translationY };
        pendingPanRef.current.x += deltaX;
        pendingPanRef.current.y += deltaY;

        if (Math.hypot(event.translationX, event.translationY) > TAP_MOVE_CANCEL_DISTANCE) {
          gestureMovedRef.current = true;
          scene.suppressTap('pan');
        }

        const now = Date.now();
        if (now - scene.lastPanApplyAtRef.current < PAN_THROTTLE_MS) {
          return;
        }

        if (scene.panBy(pendingPanRef.current.x, pendingPanRef.current.y)) {
          pendingPanRef.current = { x: 0, y: 0 };
          scene.lastPanApplyAtRef.current = now;
        }
      })
      .onFinalize(() => {
        if (pendingPanRef.current.x !== 0 || pendingPanRef.current.y !== 0) {
          scene.panBy(pendingPanRef.current.x, pendingPanRef.current.y);
          pendingPanRef.current = { x: 0, y: 0 };
        }

        if (gestureMovedRef.current) {
          scene.suppressTap('pan');
        }
      }),
    Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        latestPinchScaleRef.current = 1;
        gestureMovedRef.current = true;
        scene.suppressTap('pinch');
        scene.beginZoom();
      })
      .onUpdate((event) => {
        latestPinchScaleRef.current = event.scale;
        const now = Date.now();
        if (now - scene.lastPinchApplyAtRef.current < PINCH_THROTTLE_MS) {
          return;
        }

        if (scene.zoomFromScale(event.scale)) {
          scene.lastPinchApplyAtRef.current = now;
        }
      })
      .onFinalize(() => {
        scene.zoomFromScale(latestPinchScaleRef.current);
        scene.suppressTap('pinch');
      }),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((event, success) => {
        if (success && scene.canHandleTap()) {
          scene.handleTapAtPoint(event.x, event.y);
        }
      })
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scene.setViewport(event.nativeEvent.layout.width, event.nativeEvent.layout.height);
    },
    [scene]
  );

  return {
    gesture,
    handleLayout,
  };
};
