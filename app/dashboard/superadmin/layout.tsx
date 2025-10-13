import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Super Admin Dashboard - SS League',
  description: 'Super admin control panel for managing users, seasons, and system settings',
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}