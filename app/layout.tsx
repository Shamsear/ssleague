import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MobileNav from "@/components/layout/MobileNav";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/contexts/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
            <MobileNav />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
