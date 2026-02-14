import { BadgeCheck } from 'lucide-react';

export default function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={className ?? 'inline-block h-4 w-4 shrink-0 text-blue-500'}
      aria-label="Verified"
    />
  );
}
