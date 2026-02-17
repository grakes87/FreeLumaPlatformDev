import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background py-8 dark:bg-background-dark">
      <div className="w-full max-w-md px-4">
        <Link
          href="/bible"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {children}
      </div>
    </div>
  );
}
