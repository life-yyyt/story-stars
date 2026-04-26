import { useEffect, useMemo } from 'react';

import { createGlowTexture } from './universe-lab-render-core';

export const useUniverseGlowTexture = () => {
  const glowTexture = useMemo(() => createGlowTexture(), []);

  useEffect(() => {
    return () => {
      glowTexture.dispose();
    };
  }, [glowTexture]);

  return glowTexture;
};
