import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Registration - SS League',
  description: 'Register your team for SS League auction',
};

export default function TeamRegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
