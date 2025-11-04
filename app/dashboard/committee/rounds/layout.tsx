import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auction Rounds - SS League Committee',
  description: 'Manage auction rounds and bidding sessions',
};

export default function RoundsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
