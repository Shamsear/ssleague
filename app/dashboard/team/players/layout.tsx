import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Players - SS League Team',
  description: 'View your team roster and player details',
};

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}