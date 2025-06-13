import type { Metadata } from 'next';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css'; // Add MapLibre GL CSS
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'PawPal SD - Your AI Companion for San Diego Pet Life',
  description: 'Your AI Companion for San Diego Pet Life. Find vets, parks, emergency info, and more.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ scrollBehavior: 'smooth' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/assets/images/favicon.ico" sizes="any" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <Providers>
          <Header />
          {/* The main tag in page.tsx will now handle the flex-grow for its content area */}
          <div className="relative z-0 flex-grow container mx-auto px-4 py-8">
            {children}
          </div>
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}