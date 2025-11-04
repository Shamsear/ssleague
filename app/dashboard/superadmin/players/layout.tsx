import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Player Management - SS League Admin',
  description: 'Import and manage player database',
};

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
