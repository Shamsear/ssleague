import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Player Registration - SS League',
  description: 'Register as a player for SS League auction',
};

export default function PlayerRegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
