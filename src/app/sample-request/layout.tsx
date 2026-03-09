import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Sample Bracelets | Free Luma',
  description:
    'Request free NFC bracelets for your church youth group. Each bracelet connects to daily Bible verses and inspirational content through the Free Luma app.',
};

export default function SampleRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-amber-50" data-theme="light">
      {children}
    </div>
  );
}
