import { StarPosition, Story } from '@/src/types/domain';

export const STAR_SIZE_MIN = 0.8;
export const STAR_SIZE_MAX = 1.8;
export const BASE_STAR_SCALE = 0.86;
export const PUBLIC_STAR_BASE_BRIGHTNESS = 0.6;
export const PRIVATE_STAR_FIXED_BRIGHTNESS = 0.46;
export const PUBLIC_STAR_MAX_BRIGHTNESS = 1.32;

const MIN_STAR_DISTANCE = 8.5;
const GALAXY_ARM_COUNT = 4;
const GALAXY_RADIUS_MIN = 34;
const GALAXY_RADIUS_MAX = 168;
const GALAXY_VERTICAL_OFFSET = 0;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const createBrightnessFromLikes = (likeCount: number) =>
  clamp(
    PUBLIC_STAR_BASE_BRIGHTNESS +
      (PUBLIC_STAR_MAX_BRIGHTNESS - PUBLIC_STAR_BASE_BRIGHTNESS) * (1 - Math.exp(-Math.max(0, likeCount) / 22)),
    PUBLIC_STAR_BASE_BRIGHTNESS,
    PUBLIC_STAR_MAX_BRIGHTNESS
  );

const distanceBetween = (a: StarPosition, b: StarPosition) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

export const generateGalaxyPosition = (random: () => number = Math.random): StarPosition => {
  const arm = Math.floor(random() * GALAXY_ARM_COUNT);
  const radius =
    GALAXY_RADIUS_MIN + Math.pow(random(), 0.68) * (GALAXY_RADIUS_MAX - GALAXY_RADIUS_MIN);
  const armAngle = (arm / GALAXY_ARM_COUNT) * Math.PI * 2;
  const twist = radius * 0.024;
  const angle = armAngle + twist + (random() - 0.5) * 0.82;
  const radialSpread = 10 + radius * 0.08;
  const depthSpread = 26 + radius * 0.2;
  const verticalSpread = 48 + radius * 0.42;
  const laneLift = GALAXY_VERTICAL_OFFSET + Math.sin(angle * 1.06) * 8.6 + Math.cos(angle * 0.72) * 6.2;
  const depthWave = Math.cos(angle * 1.02) * (12 + radius * 0.08);
  const spiralX = Math.cos(angle) * radius + (random() - 0.5) * radialSpread;
  const spiralY = laneLift + (random() - 0.5) * verticalSpread;
  const spiralZ = Math.sin(angle) * radius * 0.92 + depthWave + (random() - 0.5) * depthSpread;
  const cloudBlend = 0.34 + random() * 0.18;
  const cloudX = (random() - 0.5) * (60 + radius * 0.78);
  const cloudY = (random() - 0.5) * (72 + radius * 0.56);
  const cloudZ = (random() - 0.5) * (64 + radius * 0.86);

  return {
    x: lerp(spiralX, cloudX, cloudBlend),
    y: lerp(spiralY, cloudY, 0.58 + cloudBlend * 0.18),
    z: lerp(spiralZ, cloudZ, cloudBlend),
  };
};

const randomPosition = (): StarPosition => generateGalaxyPosition();

export const generateStarPlacement = (existingStories: Story[]): StarPosition => {
  const existing = existingStories.map((story) => story.starPosition);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = randomPosition();
    const hasConflict = existing.some((position) => distanceBetween(position, candidate) < MIN_STAR_DISTANCE);

    if (!hasConflict) {
      return candidate;
    }
  }

  return {
    x: randomInRange(-120, 120),
    y: randomInRange(-72, 72),
    z: randomInRange(-120, 120),
  };
};

const COORDINATE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomCodeChunk = (length: number) =>
  Array.from({ length }, () => COORDINATE_ALPHABET[Math.floor(Math.random() * COORDINATE_ALPHABET.length)]).join('');

export const generateCoordinateCode = () => `STAR-${randomCodeChunk(3)}-${randomCodeChunk(3)}`;

export const normalizeHexColor = (value: string) => {
  const cleaned = value.trim().toUpperCase().replace(/[^0-9A-F#]/g, '');
  if (!cleaned) {
    return '#E0E7EF';
  }
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
};

export const isValidHexColor = (value: string) => /^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(normalizeHexColor(value));

export const generateSizeFactor = () => Number(randomInRange(STAR_SIZE_MIN, STAR_SIZE_MAX).toFixed(2));
