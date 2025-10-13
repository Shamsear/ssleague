import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Season Management - SS League Admin',
  description: 'Create and manage auction seasons',
};

export default function SeasonsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}