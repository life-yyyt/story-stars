import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'story-stars/device-id';

const createId = () =>
  `device-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const getOrCreateDeviceId = async () => {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const next = createId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
};
