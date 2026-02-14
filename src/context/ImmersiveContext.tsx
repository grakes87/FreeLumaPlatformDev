'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ImmersiveContextValue {
  immersive: boolean;
  setImmersive: (value: boolean) => void;
}

const ImmersiveContext = createContext<ImmersiveContextValue>({
  immersive: false,
  setImmersive: () => {},
});

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);

  return (
    <ImmersiveContext.Provider value={{ immersive, setImmersive }}>
      {children}
    </ImmersiveContext.Provider>
  );
}

export function useImmersive() {
  return useContext(ImmersiveContext);
}
