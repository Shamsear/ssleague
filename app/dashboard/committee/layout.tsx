import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Committee Dashboard - SS League',
  description: 'Committee admin panel for managing auctions and teams',
};

export default function CommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
