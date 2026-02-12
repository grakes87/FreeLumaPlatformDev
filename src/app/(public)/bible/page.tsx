import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free Luma - Daily Faith Inspiration',
  description:
    'Daily Bible verses and faith-based inspiration delivered to you every day. Join the Free Luma community.',
};

interface BiblePageProps {
  searchParams: Promise<{ activation_code?: string }>;
}

export default async function BiblePage({ searchParams }: BiblePageProps) {
  const params = await searchParams;
  const activationCode = params.activation_code;

  const signupHref = activationCode
    ? `/signup?mode=bible&activation_code=${encodeURIComponent(activationCode)}`
    : '/signup?mode=bible';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 px-4 text-white">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 shadow-lg backdrop-blur-sm">
            <span className="text-3xl font-bold tracking-tight">FL</span>
          </div>
        </div>

        {/* Brand name */}
        <h1 className="mb-3 text-4xl font-bold tracking-tight">Free Luma</h1>

        {/* Tagline */}
        <p className="mb-8 text-lg text-indigo-200">
          Daily inspiration for your faith journey
        </p>

        {/* Inspirational verse */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-sm">
          <p className="text-base leading-relaxed italic text-indigo-100">
            &ldquo;For I know the plans I have for you, declares the Lord, plans
            to prosper you and not to harm you, plans to give you hope and a
            future.&rdquo;
          </p>
          <p className="mt-3 text-sm text-indigo-300">Jeremiah 29:11</p>
        </div>

        {/* CTA Buttons */}
        <Link
          href={signupHref}
          className="mb-4 w-full rounded-xl bg-white px-8 py-3.5 text-center text-lg font-semibold text-indigo-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Get Started
        </Link>

        <Link
          href="/login"
          className="text-sm text-indigo-200 transition-colors hover:text-white"
        >
          Already have an account?{' '}
          <span className="font-medium underline underline-offset-2">
            Log in
          </span>
        </Link>
      </div>
    </div>
  );
}
