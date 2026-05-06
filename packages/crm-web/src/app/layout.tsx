import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MiniCRM',
  description: 'WhatsApp CRM — contacts, messages, and more',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <Sidebar />

        {/* Main content: offset by sidebar width on desktop */}
        <main className="min-h-screen lg:pl-60">
          <div className="mx-auto max-w-7xl px-6 py-8 pt-20 lg:pt-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
