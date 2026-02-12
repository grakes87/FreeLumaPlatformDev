'use client';

import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Ensure this component is rendered inside the (app) or onboarding layout.'
    );
  }
  return context;
}
