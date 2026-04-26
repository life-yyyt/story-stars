/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import {
  createEnvironmentPositions,
  createNebulaClouds,
  getNebulaVisibility,
  getUniverseRenderProfile,
  UNIVERSE_BACKGROUND_COLOR,
  UNIVERSE_FOG_RANGE,
  updateEnvironmentOpacity,
} from './universe-lab-render-core';
import { UniverseStar } from '@/src/types/domain';

import { UNIVERSE_LAB_STARFIELD } from './universe-lab-constants';
import { UniverseLabOrbit } from './universe-lab-data';
import { useFrame, useThree } from './universe-lab-fiber-adapter';
import { StoryStarsFocus } from './universe-lab-focus-star';
import { useUniverseGlowTexture } from './use-universe-lab-glow-texture';

const LAB_STAR_VERTEX_SHADER = `
attribute float size;
attribute float alpha;
uniform float uSceneDistance;
varying vec3 vColor;
varying float vAlpha;
varying float vFarReveal;

void main() {
  vColor = color;
  vAlpha = alpha;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float depth = max(96.0, -mvPosition.z);
  vFarReveal = smoothstep(
    ${UNIVERSE_LAB_STARFIELD.farRevealStart.toFixed(1)},
    ${UNIVERSE_LAB_STARFIELD.farRevealEnd.toFixed(1)},
    depth
  );
  vFarReveal = max(
    vFarReveal,
    smoothstep(
      ${UNIVERSE_LAB_STARFIELD.farRevealStart.toFixed(1)},
      ${UNIVERSE_LAB_STARFIELD.farRevealEnd.toFixed(1)},
      uSceneDistance
    )
  );
  float farSizeBoost = 1.0 + vFarReveal * ${UNIVERSE_LAB_STARFIELD.farSizeBoost.toFixed(2)};
  float minPointSize = mix(1.35, ${UNIVERSE_LAB_STARFIELD.farMinPointSize.toFixed(2)}, vFarReveal);
  gl_PointSize = clamp(size * farSizeBoost * (440.0 / depth), minPointSize, 40.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const LAB_STAR_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;
varying float vFarReveal;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float radius = length(uv) * 2.0;
  float halo = smoothstep(1.0, 0.0, radius);
  float outerGlow = smoothstep(1.0, 0.0, radius) * (1.0 - smoothstep(0.42, 0.96, radius));
  float core = smoothstep(0.2, 0.0, radius);
  float alphaBoost = 1.0 + vFarReveal * ${UNIVERSE_LAB_STARFIELD.farAlphaBoost.toFixed(2)};
  float alpha = (halo * 0.15 + outerGlow * 0.08 + core * 0.76) * vAlpha * alphaBoost;
  float farCoreFloor = core * vFarReveal * ${UNIVERSE_LAB_STARFIELD.farCoreFloor.toFixed(3)} * (0.64 + vAlpha * 0.36);
  alpha = max(alpha, farCoreFloor);

  if (alpha < 0.012) {
    discard;
  }

  vec3 hot = mix(vColor, vec3(1.0), core * 0.54);
  hot = mix(hot, vec3(0.92, 0.96, 1.0), outerGlow * 0.16);
  float luminanceBoost = 1.0 + vFarReveal * ${UNIVERSE_LAB_STARFIELD.farLuminanceBoost.toFixed(2)};
  gl_FragColor = vec4(hot * (0.58 + core * 0.64) * luminanceBoost, alpha);
}
`;

const LabStoryStarField = ({ stars, sceneDistance }: { stars: UniverseStar[]; sceneDistance: number }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniformsRef = useRef({
    uSceneDistance: { value: sceneDistance },
  });
  const geometry = useMemo(() => {
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const sizes = new Float32Array(stars.length);
    const alphas = new Float32Array(stars.length);
    const color = new THREE.Color();

    stars.forEach((star, index) => {
      const positionOffset = index * 3;
      const brightness = THREE.MathUtils.clamp(star.brightness, 0.24, 1.32);
      const isAnchor = index % 173 === 0 || index % 389 === 0;

      positions[positionOffset] = star.x;
      positions[positionOffset + 1] = star.y;
      positions[positionOffset + 2] = star.z;

      color.set(star.color);
      colors[positionOffset] = color.r;
      colors[positionOffset + 1] = color.g;
      colors[positionOffset + 2] = color.b;

      sizes[index] = (isAnchor ? 10 : 5.8) + brightness * (isAnchor ? 9.2 : 5.4) + star.sizeFactor * 2.2;
      alphas[index] = THREE.MathUtils.clamp((isAnchor ? 0.44 : 0.2) + brightness * 0.25, 0.18, 0.82);
    });

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nextGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    nextGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    nextGeometry.computeBoundingSphere();

    return nextGeometry;
  }, [stars]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry]
  );

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSceneDistance.value = sceneDistance;
    }
  });

  if (stars.length === 0) {
    return null;
  }

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={4}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniformsRef.current}
        vertexColors
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        vertexShader={LAB_STAR_VERTEX_SHADER}
        fragmentShader={LAB_STAR_FRAGMENT_SHADER}
      />
    </points>
  );
};

const LabNebula = ({
  hasFocus,
  glowTexture,
}: {
  hasFocus: boolean;
  glowTexture: THREE.Texture;
}) => {
  const { camera } = useThree();
  const clouds = useMemo(() => createNebulaClouds(), []);
  const refs = useRef<{ outer: THREE.Sprite | null; inner: THREE.Sprite | null }[]>([]);
  const outerMaterials = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const innerMaterials = useRef<(THREE.SpriteMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const visibility = getNebulaVisibility(camera.position.length(), hasFocus);

    clouds.forEach((cloud, index) => {
      const driftX = Math.sin(clock.elapsedTime * cloud.driftSpeed + cloud.phase) * cloud.driftX;
      const driftY = Math.cos(clock.elapsedTime * cloud.driftSpeed * 0.82 + cloud.phase) * cloud.driftY;
      const pulse = 0.96 + visibility * 0.14 + Math.sin(clock.elapsedTime * cloud.driftSpeed * 2.2 + cloud.phase) * 0.03;
      const pair = refs.current[index];
      const outer = pair?.outer;
      const inner = pair?.inner;

      if (outer) {
        outer.position.set(cloud.x + driftX, cloud.y + driftY, cloud.z);
        outer.scale.set(cloud.scaleX * pulse, cloud.scaleY * pulse, 1);
      }

      if (inner) {
        inner.position.set(cloud.x + driftX * 0.55, cloud.y + driftY * 0.55, cloud.z + 2);
        inner.scale.set(cloud.scaleX * 0.62 * pulse, cloud.scaleY * 0.62 * pulse, 1);
      }

      if (outerMaterials.current[index]) {
        outerMaterials.current[index]!.opacity = cloud.opacity * visibility;
      }

      if (innerMaterials.current[index]) {
        innerMaterials.current[index]!.opacity = cloud.innerOpacity * visibility;
      }
    });
  });

  return (
    <>
      {clouds.map((cloud, index) => (
        <group key={`lab-nebula-${index}`}>
          <sprite
            ref={(value) => {
              refs.current[index] = { outer: value, inner: refs.current[index]?.inner ?? null };
            }}
            scale={[cloud.scaleX, cloud.scaleY, 1]}
            renderOrder={0}>
            <spriteMaterial
              ref={(value) => {
                outerMaterials.current[index] = value;
              }}
              map={glowTexture}
              color={cloud.color}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
            />
          </sprite>
          <sprite
            ref={(value) => {
              refs.current[index] = { inner: value, outer: refs.current[index]?.outer ?? null };
            }}
            scale={[cloud.scaleX * 0.62, cloud.scaleY * 0.62, 1]}
            renderOrder={0}>
            <spriteMaterial
              ref={(value) => {
                innerMaterials.current[index] = value;
              }}
              map={glowTexture}
              color="#EEF3FF"
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
            />
          </sprite>
        </group>
      ))}
    </>
  );
};

const LabEnvironmentStars = ({ count }: { count: number }) => {
  const stars = useMemo(() => createEnvironmentPositions(count), [count]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }

    const dummy = new THREE.Object3D();
    stars.forEach((star, index) => {
      dummy.position.set(star.x, star.y, star.z);
      dummy.scale.setScalar(star.scale);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(index, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [stars]);

  useFrame(() => {
    updateEnvironmentOpacity({ material: materialRef.current, hasFocus: false });
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, stars.length]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#DCE3EC"
        transparent
        opacity={0.26}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
      />
    </instancedMesh>
  );
};

const LabCameraRig = ({
  desiredOrbit,
  currentOrbit,
  cameraRef,
  onDistanceChange,
}: {
  desiredOrbit: React.MutableRefObject<UniverseLabOrbit>;
  currentOrbit: React.MutableRefObject<UniverseLabOrbit>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  onDistanceChange: (distance: number) => void;
}) => {
  const { camera } = useThree();

  useEffect(() => {
    cameraRef.current = camera as THREE.PerspectiveCamera;
  }, [camera, cameraRef]);

  useFrame(({ clock }, delta) => {
    const current = currentOrbit.current;
    const desired = desiredOrbit.current;
    const damping = 8.5;

    current.yaw = THREE.MathUtils.damp(current.yaw, desired.yaw, damping, delta);
    current.pitch = THREE.MathUtils.damp(current.pitch, desired.pitch, damping, delta);
    current.distance = THREE.MathUtils.damp(current.distance, desired.distance, damping, delta);
    current.target.set(
      THREE.MathUtils.damp(current.target.x, desired.target.x, damping, delta),
      THREE.MathUtils.damp(current.target.y, desired.target.y, damping, delta),
      THREE.MathUtils.damp(current.target.z, desired.target.z, damping, delta)
    );

    const offset = new THREE.Vector3(
      Math.sin(current.yaw) * Math.cos(current.pitch),
      Math.sin(current.pitch) + Math.sin(clock.elapsedTime * 0.16) * 0.006,
      Math.cos(current.yaw) * Math.cos(current.pitch)
    ).multiplyScalar(current.distance);

    camera.position.copy(current.target.clone().add(offset));
    camera.lookAt(current.target);
    camera.updateProjectionMatrix();
    onDistanceChange(current.distance);
  });

  return null;
};

export const UniverseLabRenderTree = ({
  stars,
  desiredOrbit,
  currentOrbit,
  cameraRef,
  focusedStarId,
  sceneDistance,
  onDistanceChange,
}: {
  stars: UniverseStar[];
  desiredOrbit: React.MutableRefObject<UniverseLabOrbit>;
  currentOrbit: React.MutableRefObject<UniverseLabOrbit>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  focusedStarId: string | null;
  sceneDistance: number;
  onDistanceChange: (distance: number) => void;
}) => {
  const glowTexture = useUniverseGlowTexture();
  const renderProfile = useMemo(() => getUniverseRenderProfile(stars.length), [stars.length]);

  return (
    <>
      <color attach="background" args={[UNIVERSE_BACKGROUND_COLOR]} />
      <fog attach="fog" args={UNIVERSE_FOG_RANGE} />
      <LabCameraRig
        desiredOrbit={desiredOrbit}
        currentOrbit={currentOrbit}
        cameraRef={cameraRef}
        onDistanceChange={onDistanceChange}
      />
      <LabNebula hasFocus={Boolean(focusedStarId)} glowTexture={glowTexture} />
      <LabEnvironmentStars count={renderProfile.environmentStarCount + 36} />
      <LabStoryStarField stars={stars} sceneDistance={sceneDistance} />
      <StoryStarsFocus
        stars={stars}
        focusedStoryId={focusedStarId}
        glowTexture={glowTexture}
        opacity={focusedStarId ? 1 : 0}
        sceneDistance={sceneDistance}
      />
    </>
  );
};
