import React, { PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { FocusRequest } from '@/src/types/domain';

interface UniverseFocusIntentContextValue {
  focusRequest: FocusRequest | null;
  requestFocus: (storyId: string, options?: Pick<FocusRequest, 'message' | 'openReader'>) => void;
  clearFocusRequest: () => void;
}

const UniverseFocusIntentContext = createContext<UniverseFocusIntentContextValue | null>(null);

export const UniverseFocusIntentProvider = ({ children }: PropsWithChildren) => {
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const requestFocus = useCallback((storyId: string, options: Pick<FocusRequest, 'message' | 'openReader'> = {}) => {
    setFocusRequest({
      storyId,
      nonce: Date.now(),
      ...options,
    });
  }, []);

  const clearFocusRequest = useCallback(() => {
    setFocusRequest(null);
  }, []);

  const value = useMemo(
    () => ({
      focusRequest,
      requestFocus,
      clearFocusRequest,
    }),
    [clearFocusRequest, focusRequest, requestFocus]
  );

  return <UniverseFocusIntentContext.Provider value={value}>{children}</UniverseFocusIntentContext.Provider>;
};

export const useUniverseFocusIntent = () => {
  const context = useContext(UniverseFocusIntentContext);

  if (!context) {
    throw new Error('useUniverseFocusIntent must be used inside UniverseFocusIntentProvider.');
  }

  return context;
};
