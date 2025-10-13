import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Profile - SS League',
  description: 'Manage your team profile and settings',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}