import React from 'react';
import { StyleSheet, View } from 'react-native';

import { UniverseLabRenderTree } from '@/src/features/universe-lab/universe-lab-render-tree';
import { UniverseLabSceneState } from '@/src/features/universe-lab/use-universe-lab-scene';

import { UNIVERSE_LAB_CAMERA } from './universe-lab-constants';
import { Canvas } from './universe-lab-fiber-adapter';

export const UniverseLabScene = ({
  scene,
}: {
  scene: UniverseLabSceneState;
}) => {
  return (
    <View
      onLayout={(event) => {
        scene.setViewport(event.nativeEvent.layout.width, event.nativeEvent.layout.height);
      }}
      style={styles.container}>
      <Canvas
        dpr={[1, 1.5]}
        style={styles.canvas}
        camera={{ position: [0, 12, 320], fov: 42, near: 0.1, far: UNIVERSE_LAB_CAMERA.farPlane }}>
        <UniverseLabRenderTree
          stars={scene.stars}
          desiredOrbit={scene.desiredOrbit}
          currentOrbit={scene.currentOrbit}
          cameraRef={scene.cameraRef}
          focusedStarId={scene.focusedStarId}
          sceneDistance={scene.sceneDistance}
          onDistanceChange={scene.setSceneDistance}
        />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
