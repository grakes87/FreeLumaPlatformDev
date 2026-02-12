import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Free Luma - Daily Positivity',
  description:
    'Daily positivity and uplifting inspiration delivered to you every day. Join the Free Luma community.',
};

interface PositivityPageProps {
  searchParams: Promise<{ activation_code?: string }>;
}

export default async function PositivityPage({
  searchParams,
}: PositivityPageProps) {
  const params = await searchParams;
  const activationCode = params.activation_code;

  const signupHref = activationCode
    ? `/signup?mode=positivity&activation_code=${encodeURIComponent(activationCode)}`
    : '/signup?mode=positivity';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-4 text-white">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-yellow-300/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-rose-400/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
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
        <p className="mb-8 text-lg text-amber-100">
          Daily positivity to brighten your world
        </p>

        {/* Inspirational quote */}
        <div className="mb-10 rounded-xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-sm">
          <p className="text-base leading-relaxed italic text-amber-50">
            &ldquo;The only way to do great work is to love what you do. Keep
            looking. Don&rsquo;t settle.&rdquo;
          </p>
          <p className="mt-3 text-sm text-amber-200">Steve Jobs</p>
        </div>

        {/* CTA Buttons */}
        <Link
          href={signupHref}
          className="mb-4 w-full rounded-xl bg-white px-8 py-3.5 text-center text-lg font-semibold text-orange-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Get Started
        </Link>

        <Link
          href="/login"
          className="text-sm text-amber-100 transition-colors hover:text-white"
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
