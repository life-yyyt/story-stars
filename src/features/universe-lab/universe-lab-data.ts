import * as THREE from 'three';

import { clamp } from '@/src/lib/star-utils';
import { UniverseStar } from '@/src/types/domain';

import { UNIVERSE_LAB_CAMERA } from './universe-lab-constants';

export interface UniverseLabOrbit {
  yaw: number;
  pitch: number;
  distance: number;
  target: THREE.Vector3;
}

export interface UniverseLabDistanceRange {
  minDistance: number;
  maxDistance: number;
  preferredDistance: number;
}

const getStarWeight = (star: UniverseStar) => star.brightness * (0.88 + star.sizeFactor * 0.28);

const getWeightedCentroid = (stars: UniverseStar[]) => {
  const totals = stars.reduce(
    (accumulator, star) => {
      const weight = getStarWeight(star);
      return {
        x: accumulator.x + star.x * weight,
        y: accumulator.y + star.y * weight,
        z: accumulator.z + star.z * weight,
        weight: accumulator.weight + weight,
      };
    },
    { x: 0, y: 0, z: 0, weight: 0 }
  );
  const divisor = totals.weight || 1;
  return new THREE.Vector3(totals.x / divisor, totals.y / divisor, totals.z / divisor);
};

const getExtents = (stars: UniverseStar[], center: THREE.Vector3) =>
  stars.reduce(
    (accumulator, star) => ({
      x: Math.max(accumulator.x, Math.abs(star.x - center.x)),
      y: Math.max(accumulator.y, Math.abs(star.y - center.y)),
      z: Math.max(accumulator.z, Math.abs(star.z - center.z)),
    }),
    { x: 0, y: 0, z: 0 }
  );

const getFitDistance = (
  extents: { x: number; y: number; z: number },
  viewport: { width: number; height: number }
) => {
  const width = viewport.width || 390;
  const height = viewport.height || 844;
  const aspect = width / Math.max(1, height);
  const verticalFov = THREE.MathUtils.degToRad(42);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const fitWidth = extents.x > 0 ? (extents.x * 1.72) / Math.tan(horizontalFov / 2) : 0;
  const fitHeight = extents.y > 0 ? (extents.y * 2.36) / Math.tan(verticalFov / 2) : 0;
  const depthBuffer = extents.z * 0.92;

  return Math.max(fitWidth, fitHeight, 214 + depthBuffer);
};

export const createUniverseLabDistanceRange = (
  stars: UniverseStar[],
  viewport: { width: number; height: number }
): UniverseLabDistanceRange => {
  const center = getWeightedCentroid(stars);
  const extents = getExtents(stars, center);
  const fitDistance = getFitDistance(extents, viewport);
  const starCountWeight = clamp((Math.log10(Math.max(stars.length, 10)) - 2) / 2, 0, 1);
  const spatialRadius = Math.sqrt(extents.x * extents.x + extents.y * extents.y + extents.z * extents.z);
  const preferredDistance = clamp(
    fitDistance * (1 + starCountWeight * 0.34),
    UNIVERSE_LAB_CAMERA.initialMinDistance,
    UNIVERSE_LAB_CAMERA.initialMaxDistance
  );
  const maxDistance = clamp(
    Math.max(preferredDistance * (1.68 + starCountWeight * 0.22), spatialRadius * 3.1),
    preferredDistance + 180,
    UNIVERSE_LAB_CAMERA.hardMaxDistance
  );

  return {
    minDistance: UNIVERSE_LAB_CAMERA.minDistance,
    maxDistance,
    preferredDistance,
  };
};

export const createUniverseLabOrbit = (
  stars: UniverseStar[],
  viewport: { width: number; height: number }
): UniverseLabOrbit => {
  const center = getWeightedCentroid(stars);
  const distanceRange = createUniverseLabDistanceRange(stars, viewport);

  return {
    yaw: 0.12,
    pitch: -0.04,
    distance: distanceRange.preferredDistance,
    target: new THREE.Vector3(center.x, center.y, center.z),
  };
};
