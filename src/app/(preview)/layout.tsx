'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';

/**
 * Minimal layout for iframe-embedded preview pages.
 * No nav, no app shell — just auth context + children.
 */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
