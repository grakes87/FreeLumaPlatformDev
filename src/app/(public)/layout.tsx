import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background py-8 dark:bg-background-dark">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
