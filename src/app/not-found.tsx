import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-text dark:text-text-dark">
        Page not found
      </h2>
      <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
      >
        Go home
      </Link>
    </div>
  );
}
