import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Player Database - SS League Committee',
  description: 'Browse and manage player information for auctions',
};

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}