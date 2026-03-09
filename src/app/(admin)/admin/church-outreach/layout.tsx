import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Church Outreach | Admin',
};

export default function ChurchOutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
