import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Management - SS League Admin',
  description: 'Manage teams, budgets, and team assignments',
};

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
