import { toUniverseStarPreview } from '@/src/lib/story-mappers';
import {
  StarPosition,
  Story,
  UniverseCoordinateTarget,
  UniverseStarPreview,
  UniverseWindowQuery,
  UniverseZoomTier,
  ViewerSession,
} from '@/src/types/domain';

export const UNIVERSE_NEAR_RADIUS = 220;
export const UNIVERSE_MID_RADIUS = 340;
export const UNIVERSE_QUERY_PREFETCH_MULTIPLIER = 1.3;
export const UNIVERSE_QUERY_MOVE_THRESHOLD_RATIO = 0.24;
export const INITIAL_UNIVERSE_CENTER: StarPosition = { x: 0, y: 0, z: 0 };
export const INITIAL_UNIVERSE_DISTANCE = 468;
export const FAR_MID_BLEND_START = 560;
export const FAR_MID_BLEND_END = 680;
export const MID_NEAR_BLEND_START = 80;
export const MID_NEAR_BLEND_END = 120;

const MAX_WINDOW_STARS_BY_TIER: Record<UniverseZoomTier, number> = {
  far: 5000,
  mid: 900,
  near: 220,
};

export const getZoomTierForDistance = (distance: number): UniverseZoomTier => {
  if (distance <= MID_NEAR_BLEND_END) {
    return 'near';
  }

  if (distance <= FAR_MID_BLEND_END) {
    return 'mid';
  }

  return 'far';
};

export const getWindowRadiusForTier = (zoomTier: UniverseZoomTier) => {
  if (zoomTier === 'near') {
    return UNIVERSE_NEAR_RADIUS;
  }

  return UNIVERSE_MID_RADIUS;
};

export const createUniverseWindowQuery = (
  center: StarPosition,
  distance: number,
  prefetch = true
): UniverseWindowQuery => {
  const zoomTier = getZoomTierForDistance(distance);
  const radius = getWindowRadiusForTier(zoomTier) * (prefetch ? UNIVERSE_QUERY_PREFETCH_MULTIPLIER : 1);

  return {
    center,
    radius,
    zoomTier,
    prefetch,
  };
};

export const createInitialUniverseWindowQuery = () =>
  createUniverseWindowQuery(INITIAL_UNIVERSE_CENTER, INITIAL_UNIVERSE_DISTANCE, true);

const distanceBetween = (a: StarPosition, b: StarPosition) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

export const shouldRefreshUniverseWindow = (
  previousQuery: UniverseWindowQuery | null,
  nextQuery: UniverseWindowQuery
) => {
  if (!previousQuery) {
    return true;
  }

  if (previousQuery.zoomTier !== nextQuery.zoomTier) {
    return true;
  }

  const moveThreshold = previousQuery.radius * UNIVERSE_QUERY_MOVE_THRESHOLD_RATIO;
  return distanceBetween(previousQuery.center, nextQuery.center) >= moveThreshold;
};

export const isStoryWithinWindow = (story: Story, query: UniverseWindowQuery) =>
  distanceBetween(story.starPosition, query.center) <= query.radius;

const sortStoriesByDistance = (stories: Story[], center: StarPosition) =>
  [...stories].sort(
    (left, right) => distanceBetween(left.starPosition, center) - distanceBetween(right.starPosition, center)
  );

const MID_GRID_X = 8;
const MID_GRID_Y = 6;
const MID_GRID_Z = 8;

const getBucketIndex = (value: number, size: number) =>
  Math.max(0, Math.min(size - 1, Math.floor(value * size)));

const createMidSpatialSample = (stories: Story[], query: UniverseWindowQuery, limit: number) => {
  if (stories.length <= limit) {
    return stories;
  }

  const buckets = new Map<string, Story[]>();
  const radius = Math.max(query.radius, 1);

  stories.forEach((story) => {
    const normalizedX = (story.starPosition.x - query.center.x + radius) / (radius * 2);
    const normalizedY = (story.starPosition.y - query.center.y + radius) / (radius * 2);
    const normalizedZ = (story.starPosition.z - query.center.z + radius) / (radius * 2);
    const bucketKey = [
      getBucketIndex(normalizedX, MID_GRID_X),
      getBucketIndex(normalizedY, MID_GRID_Y),
      getBucketIndex(normalizedZ, MID_GRID_Z),
    ].join(':');
    const bucket = buckets.get(bucketKey);

    if (bucket) {
      bucket.push(story);
    } else {
      buckets.set(bucketKey, [story]);
    }
  });

  const orderedBuckets = [...buckets.values()].map((bucket) =>
    [...bucket].sort((left, right) => {
      const brightnessDelta = right.brightness - left.brightness;
      if (Math.abs(brightnessDelta) > 0.02) {
        return brightnessDelta;
      }

      return distanceBetween(left.starPosition, query.center) - distanceBetween(right.starPosition, query.center);
    })
  );

  orderedBuckets.sort((left, right) => {
    const leftDistance = distanceBetween(left[0].starPosition, query.center);
    const rightDistance = distanceBetween(right[0].starPosition, query.center);
    return leftDistance - rightDistance;
  });

  const selectedStories: Story[] = [];
  let bucketIndex = 0;

  while (selectedStories.length < limit) {
    let pickedInPass = false;

    for (let index = 0; index < orderedBuckets.length && selectedStories.length < limit; index += 1) {
      const bucket = orderedBuckets[(bucketIndex + index) % orderedBuckets.length];
      const story = bucket.shift();

      if (!story) {
        continue;
      }

      selectedStories.push(story);
      pickedInPass = true;
    }

    if (!pickedInPass) {
      break;
    }

    bucketIndex = (bucketIndex + 1) % Math.max(orderedBuckets.length, 1);
  }

  return selectedStories;
};

export const selectWindowStories = (
  stories: Story[],
  query: UniverseWindowQuery,
  session: ViewerSession | null
) => {
  const limit = MAX_WINDOW_STARS_BY_TIER[query.zoomTier];

  if (limit === 0) {
    return [] as UniverseStarPreview[];
  }

  const withinWindow = stories.filter((story) => isStoryWithinWindow(story, query));

  if (query.zoomTier === 'far') {
    return withinWindow.slice(0, limit).map((story) => toUniverseStarPreview(story, session));
  }

  if (query.zoomTier === 'mid') {
    return createMidSpatialSample(withinWindow, query, limit).map((story) => toUniverseStarPreview(story, session));
  }

  return sortStoriesByDistance(withinWindow, query.center)
    .slice(0, limit)
    .map((story) => toUniverseStarPreview(story, session));
};

export const buildCoordinateTarget = (story: Story): UniverseCoordinateTarget => ({
  storyId: story.id,
  position: story.starPosition,
  zoomTier: 'mid',
  coordinateCode: story.coordinateCode ?? '',
});
