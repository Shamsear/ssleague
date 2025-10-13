import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Dashboard - SS League',
  description: 'Team control panel for managing bids and players',
};

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}