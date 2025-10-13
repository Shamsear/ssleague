import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Management - SS League Admin',
  description: 'Manage user accounts, roles, and permissions',
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}