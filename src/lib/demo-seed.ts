import {
  createBrightnessFromLikes,
  generateGalaxyPosition,
  PRIVATE_STAR_FIXED_BRIGHTNESS,
  STAR_SIZE_MAX,
  STAR_SIZE_MIN,
} from '@/src/lib/star-utils';
import { Story } from '@/src/types/domain';

export const DEMO_SEED_VERSION = 'demo-seed-v9-volumetric-cluster-layout';

const DEMO_STORY_COUNT = 3000;
const now = Date.now();
const COORDINATE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const titleLeft = ['凌晨', '雾里', '雨后', '夏末', '月台边', '海风里', '桥下', '旧城里', '晚灯下', '回程路上'];
const titleRight = ['的回声', '的慢车', '的纸灯', '的夜色', '的风口', '的微光', '的潮汐', '的空白页', '的长椅', '的旧站牌'];

const bodyOpening = [
  '我把这段故事留在一盏快要熄灭的灯旁边',
  '那天夜里，城市像把呼吸放慢了一点',
  '我原本只是路过，却在风里站了很久',
  '所有人都在往前走的时候，我忽然停了下来',
  '那一刻没有谁说话，只有远处的光在摇晃',
];

const bodyMiddle = [
  '我想起那些没有说出口的话，像被推远又缓慢飘回来的星尘',
  '脚步声一阵一阵掠过，我却第一次听清了自己心里的回音',
  '有些离开并不是结束，只是把自己重新放回更辽阔的地方',
  '我一直以为自己已经忘了，直到空气里又出现熟悉的气味',
  '那种微小的犹豫像夜空里最淡的一颗星，却始终没有熄灭',
];

const bodyEnding = [
  '后来我明白，故事不是要被藏起来，而是要被放进宇宙里。',
  '我把这一页写下来，像是在替那晚的自己留一盏灯。',
  '如果你也看见它，希望你会知道，有人曾在这里认真生活过。',
  '于是我没有回头，只把它轻轻挂成了一颗星。',
  '那之后每次抬头，我都会想起那个终于愿意继续往前走的自己。',
];

const namedAuthors = ['北岛旅人', '雾港', 'M42', '夜行列车', '海盐信箱', '半山来信', '迟星', '南风口', '微光站台', '旧城气象'];

const colorPalette = ['#E7EDF7', '#D7E2F4', '#E7DCF2', '#F0E4D4', '#D7E8DF', '#F1D9E3', '#D8D5EE', '#E8E0D2', '#D4E2EA', '#E5DCCB'];

const seededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const buildCoordinateChunk = (value: number) => {
  let remaining = value;
  let chunk = '';

  for (let index = 0; index < 3; index += 1) {
    chunk = `${COORDINATE_ALPHABET[remaining % COORDINATE_ALPHABET.length]}${chunk}`;
    remaining = Math.floor(remaining / COORDINATE_ALPHABET.length);
  }

  return chunk;
};

const buildCoordinateCode = (index: number) =>
  `STAR-${buildCoordinateChunk(index * 29 + 117)}-${buildCoordinateChunk(index * 47 + 281)}`;

const createTitle = (index: number) =>
  `${titleLeft[index % titleLeft.length]}${titleRight[Math.floor(index / titleLeft.length) % titleRight.length]}`;

const createBody = (index: number) =>
  `${bodyOpening[index % bodyOpening.length]}，${bodyMiddle[(index + 2) % bodyMiddle.length]}。${bodyEnding[(index + 1) % bodyEnding.length]}`;

const createStarPosition = (index: number) => {
  const random = seededRandom(index * 41 + 7);
  const position = generateGalaxyPosition(random);

  return {
    x: Number(position.x.toFixed(2)),
    y: Number(position.y.toFixed(2)),
    z: Number(position.z.toFixed(2)),
  };
};

const createSizeFactor = (random: () => number) =>
  Number((STAR_SIZE_MIN + random() * (STAR_SIZE_MAX - STAR_SIZE_MIN)).toFixed(2));

const createDemoStory = (index: number): Story => {
  const random = seededRandom(index * 17 + 3);
  const visibility = index % 7 === 0 ? 'private' : 'public';
  const authorMode = index % 4 === 0 ? 'anonymous' : 'named';
  const viewCount = visibility === 'public' ? 8 + Math.floor(random() * 160) : 0;
  const likeCount = visibility === 'public' ? 2 + Math.floor(random() * 42) : 0;
  const createdAt = new Date(now - index * 1000 * 60 * 37).toISOString();

  return {
    id: `seed-story-${String(index + 1).padStart(3, '0')}`,
    authorId: `seed-author-${(index % namedAuthors.length) + 1}`,
    title: createTitle(index),
    body: createBody(index),
    visibility,
    authorMode,
    authorDisplayName: authorMode === 'anonymous' ? '匿名旅人' : namedAuthors[index % namedAuthors.length],
    starColor: colorPalette[index % colorPalette.length],
    starSizeFactor: createSizeFactor(random),
    brightness: visibility === 'public' ? createBrightnessFromLikes(likeCount) : PRIVATE_STAR_FIXED_BRIGHTNESS,
    starPosition: createStarPosition(index),
    coordinateCode: visibility === 'public' ? buildCoordinateCode(index) : null,
    createdAt,
    updatedAt: createdAt,
    viewCount,
    likeCount,
    likedByViewer: false,
  };
};

export const demoSeedStories: Story[] = Array.from({ length: DEMO_STORY_COUNT }, (_, index) => createDemoStory(index));
