import * as THREE from 'three';

import { BASE_STAR_SCALE, clamp } from '@/src/lib/star-utils';
import { UniverseStar } from '@/src/types/domain';

export const UNIVERSE_BACKGROUND_COLOR = '#020409';
export const UNIVERSE_FOG_RANGE: [string, number, number] = [UNIVERSE_BACKGROUND_COLOR, 360, 1180];
export const UNIVERSE_CAMERA_RANGE = {
  initialDistance: 468,
  minDistance: 18,
  maxDistance: 1120,
};

const DEFAULT_ENVIRONMENT_STAR_COUNT = 220;
const GLOW_TEXTURE_SIZE = 128;

export const getUniverseRenderProfile = (storyCount: number) => {
  if (storyCount >= 480) {
    return {
      environmentStarCount: 56,
      showCoreLayer: false,
    };
  }

  if (storyCount >= 240) {
    return {
      environmentStarCount: 72,
      showCoreLayer: true,
    };
  }

  return {
    environmentStarCount: 92,
    showCoreLayer: true,
  };
};

export const getUniverseScenePreset = (_preset = 'default') => ({
  cameraRange: UNIVERSE_CAMERA_RANGE,
  fogRange: UNIVERSE_FOG_RANGE,
  cameraHeight: 24,
  fov: 46,
  nebulaStrength: 1,
  environmentBaseOpacity: 0.26,
  environmentFocusOpacity: 0.16,
});

export const createEnvironmentPositions = (count: number = DEFAULT_ENVIRONMENT_STAR_COUNT) => {
  return Array.from({ length: count }, () => {
    const radius = 380 + Math.random() * 440;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.84;
    const scale = 0.045 + Math.random() * 0.12;

    return {
      x: Math.cos(theta) * Math.cos(phi) * radius,
      y: Math.sin(phi) * radius * 0.72,
      z: Math.sin(theta) * Math.cos(phi) * radius,
      scale,
    };
  });
};

export type NebulaCloud = {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  color: string;
  opacity: number;
  innerOpacity: number;
  driftX: number;
  driftY: number;
  driftSpeed: number;
  phase: number;
};

export const createNebulaClouds = (): NebulaCloud[] => [
  {
    x: -140,
    y: 26,
    z: -220,
    scaleX: 300,
    scaleY: 140,
    color: '#445167',
    opacity: 0.07,
    innerOpacity: 0.028,
    driftX: 8,
    driftY: 4,
    driftSpeed: 0.032,
    phase: 0.2,
  },
  {
    x: 168,
    y: -8,
    z: -180,
    scaleX: 260,
    scaleY: 130,
    color: '#524C63',
    opacity: 0.056,
    innerOpacity: 0.022,
    driftX: 6,
    driftY: 4,
    driftSpeed: 0.028,
    phase: 1.1,
  },
  {
    x: 12,
    y: -88,
    z: -120,
    scaleX: 220,
    scaleY: 112,
    color: '#6B6654',
    opacity: 0.042,
    innerOpacity: 0.018,
    driftX: 5,
    driftY: 3,
    driftSpeed: 0.024,
    phase: 2.2,
  },
];

export const getNebulaVisibility = (cameraDistance: number, hasFocus: boolean) => {
  const zoomReveal = clamp((cameraDistance - 360) / 320, 0, 1);
  const focusDampen = hasFocus ? 0.3 : 1;
  return zoomReveal * focusDampen;
};

export const createGlowTexture = () => {
  const data = new Uint8Array(GLOW_TEXTURE_SIZE * GLOW_TEXTURE_SIZE * 4);

  for (let y = 0; y < GLOW_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < GLOW_TEXTURE_SIZE; x += 1) {
      const offset = (y * GLOW_TEXTURE_SIZE + x) * 4;
      const nx = (x / (GLOW_TEXTURE_SIZE - 1)) * 2 - 1;
      const ny = (y / (GLOW_TEXTURE_SIZE - 1)) * 2 - 1;
      const radius = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      const falloff = Math.pow(1 - radius, 3.2);
      const hotCore = Math.pow(1 - radius, 10);
      const alpha = Math.min(1, falloff * 0.92 + hotCore * 0.4);

      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;

  return texture;
};

export const getUniverseStarVisual = (star: UniverseStar, focusedStoryId: string | null) => {
  const depthWeight = clamp((star.z + 180) / 360, 0, 1);
  const depthScale = 0.58 + depthWeight * 0.38;
  const glowPresence = 0.9 + depthWeight * 0.2;
  const scale = BASE_STAR_SCALE * star.sizeFactor * depthScale;
  const isPrivate = star.state !== 'public';
  const isFocused = focusedStoryId === star.id;
  const visualBrightness = star.brightness;
  const focusBoost = isFocused ? 1.14 : 1;
  const bodyScale = scale * (isPrivate ? 0.64 : 0.52);
  const innerCoreScale = scale * (isPrivate ? 0.16 : 0.12);
  const haloScale =
    scale * glowPresence * focusBoost * (isPrivate ? 12.4 + visualBrightness * 3.2 : 16.8 + visualBrightness * 4.8);
  const outerGlowScale =
    scale * glowPresence * focusBoost * (isPrivate ? 18.8 + visualBrightness * 5.2 : 24.4 + visualBrightness * 6.8);
  const dimFactor = focusedStoryId && !isFocused ? 0.24 : 1;
  const glowIntensity = (isPrivate ? 0.34 + visualBrightness * 0.18 : 0.62 + visualBrightness * 0.28) * dimFactor;
  const haloIntensity = (isPrivate ? 0.24 + visualBrightness * 0.12 : 0.42 + visualBrightness * 0.18) * dimFactor;
  const bodyIntensity = (isPrivate ? 0.18 : 0.24) * dimFactor;
  const coreIntensity = (isPrivate ? 0.32 : 0.5 + visualBrightness * 0.06) * dimFactor;

  return {
    bodyScale,
    innerCoreScale,
    haloScale,
    outerGlowScale,
    glowIntensity,
    haloIntensity,
    bodyIntensity,
    coreIntensity,
  };
};

export const updateEnvironmentOpacity = ({
  material,
  hasFocus,
}: {
  material: THREE.MeshBasicMaterial | null;
  hasFocus: boolean;
}) => {
  if (!material) {
    return;
  }

  const targetOpacity = hasFocus ? 0.16 : 0.26;
  material.opacity += (targetOpacity - material.opacity) * 0.08;
};
