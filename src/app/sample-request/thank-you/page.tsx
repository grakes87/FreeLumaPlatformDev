import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Thank You | Free Luma Bracelets',
  description: 'Your sample request has been received. We will review and ship your bracelets soon.',
};

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6">
        <div className="max-w-lg text-center">
          <div className="mb-8">
            <Image
              src="/LumaLogo.png"
              alt="Free Luma Bracelets"
              width={80}
              height={80}
              className="mx-auto rounded-xl shadow-md"
            />
          </div>

          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
            Thank You for Your Request!
          </h1>

          <p className="text-lg text-gray-600 mb-3 leading-relaxed">
            We&apos;ll review your request and ship your free sample bracelets soon. Check
            your email for a confirmation.
          </p>

          <p className="text-gray-500 mb-8">
            If you have any questions, feel free to reach out at{' '}
            <a
              href="mailto:outreach@freeluma.com"
              className="text-amber-600 hover:text-amber-700 underline"
            >
              outreach@freeluma.com
            </a>
          </p>

          <div className="flex justify-center">
            <Link
              href="https://freeluma.app"
              className="inline-block rounded-lg bg-amber-600 px-6 py-3 text-white font-medium shadow-md transition hover:bg-amber-700"
            >
              Visit FreeLumaBracelets.com
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-amber-800 text-amber-200 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center text-sm">
          <p className="font-medium text-amber-100 mb-1">Free Luma Bracelets</p>
          <p>Connecting youth to daily scripture through NFC technology</p>
        </div>
      </footer>
    </div>
  );
}
