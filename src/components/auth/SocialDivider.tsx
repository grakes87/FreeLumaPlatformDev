'use client';

export function SocialDivider() {
  return (
    <div className="flex items-center gap-4">
      <hr className="flex-1 border-border dark:border-border-dark" />
      <span className="text-sm text-text-muted dark:text-text-muted-dark">or</span>
      <hr className="flex-1 border-border dark:border-border-dark" />
    </div>
  );
}
