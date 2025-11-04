import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Teams Overview - SS League Committee',
  description: 'View team details, budgets, and player rosters',
};

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
