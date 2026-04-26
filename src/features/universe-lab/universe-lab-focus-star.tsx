/* eslint-disable react/no-unknown-property */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { UniverseStar } from '@/src/types/domain';

import { useFrame } from './universe-lab-fiber-adapter';
import { getUniverseStarVisual } from './universe-lab-render-core';

export const StoryStarsFocus = ({
  stars,
  focusedStoryId,
  glowTexture,
  opacity,
  sceneDistance,
}: {
  stars: UniverseStar[];
  focusedStoryId: string | null;
  glowTexture: THREE.Texture;
  opacity: number;
  sceneDistance: number;
}) => {
  const focusedStar = useMemo(
    () => (focusedStoryId ? stars.find((star) => star.id === focusedStoryId) ?? null : null),
    [focusedStoryId, stars]
  );
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Sprite>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const haloMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const bodyMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!focusedStar) {
      return;
    }

    const visuals = getUniverseStarVisual(focusedStar, focusedStar.id);
    const distanceCompensation = THREE.MathUtils.clamp(sceneDistance / 220, 1, 3.6);
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.45) * 0.045;
    const glowOpacity = opacity * (0.54 + Math.sin(clock.elapsedTime * 1.2) * 0.04);
    const haloOpacity = opacity * (0.44 + Math.cos(clock.elapsedTime * 1.05) * 0.03);

    if (groupRef.current) {
      groupRef.current.position.set(focusedStar.x, focusedStar.y, focusedStar.z);
    }

    if (outerRef.current) {
      outerRef.current.scale.set(
        visuals.outerGlowScale * 0.84 * distanceCompensation * pulse,
        visuals.outerGlowScale * 0.84 * distanceCompensation * pulse,
        1
      );
    }

    if (haloRef.current) {
      haloRef.current.scale.set(
        visuals.haloScale * 0.82 * distanceCompensation * pulse,
        visuals.haloScale * 0.82 * distanceCompensation * pulse,
        1
      );
    }

    if (bodyRef.current) {
      bodyRef.current.scale.setScalar(visuals.bodyScale * 0.76 * distanceCompensation * pulse);
    }

    if (coreRef.current) {
      coreRef.current.scale.setScalar(visuals.innerCoreScale * 0.62 * distanceCompensation * pulse);
    }

    if (outerMaterialRef.current) {
      outerMaterialRef.current.opacity = visuals.glowIntensity * 0.26 * glowOpacity;
    }

    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = visuals.haloIntensity * 0.22 * haloOpacity;
    }

    if (bodyMaterialRef.current) {
      bodyMaterialRef.current.opacity = visuals.bodyIntensity * 0.66 * opacity;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = visuals.coreIntensity * 0.82 * opacity;
    }
  });

  if (!focusedStar || opacity <= 0.001) {
    return null;
  }

  return (
    <group ref={groupRef} position={[focusedStar.x, focusedStar.y, focusedStar.z]}>
      <sprite ref={outerRef} scale={[1, 1, 1]} renderOrder={6}>
        <spriteMaterial
          ref={outerMaterialRef}
          map={glowTexture}
          color={focusedStar.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>

      <sprite ref={haloRef} scale={[1, 1, 1]} renderOrder={7}>
        <spriteMaterial
          ref={haloMaterialRef}
          map={glowTexture}
          color={focusedStar.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>

      <mesh ref={bodyRef} scale={1} renderOrder={8}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial
          ref={bodyMaterialRef}
          color={focusedStar.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest
        />
      </mesh>

      <mesh ref={coreRef} scale={1} renderOrder={9}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          ref={coreMaterialRef}
          color="#F7FBFF"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest
        />
      </mesh>
    </group>
  );
};
