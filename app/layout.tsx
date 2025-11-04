import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MobileNav from "@/components/layout/MobileNav";
import { AuthProvider } from "@/contexts/AuthContext";
import { TeamRegistrationProvider } from "@/contexts/TeamRegistrationContext";
import { QueryProvider } from "@/contexts/QueryProvider";
import { TournamentProvider } from "@/contexts/TournamentContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: "SS League - Football Auction Platform",
  description: "Experience the thrill of building your dream football team through strategic bidding and competitive auctions",
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: "SS League - Football Auction Platform",
    description: "Experience the thrill of building your dream football team through strategic bidding and competitive auctions",
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "SS League - Football Auction Platform",
    description: "Experience the thrill of building your dream football team through strategic bidding and competitive auctions",
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <QueryProvider>
          <AuthProvider>
            <TeamRegistrationProvider>
              <TournamentProvider>
                <LanguageProvider>
                  <Navbar />
                  <main className="flex-grow">
                    {children}
                  </main>
                  <Footer />
                  <MobileNav />
                </LanguageProvider>
              </TournamentProvider>
            </TeamRegistrationProvider>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
