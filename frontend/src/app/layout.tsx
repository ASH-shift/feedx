import type { Metadata } from 'next';
import './globals.css';
import AuthHydrator from './AuthHydrator';

export const metadata: Metadata = {
  title: 'FeedX — Real-time Social Feed',
  description: 'A distributed real-time social feed powered by microservices.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-950 text-white min-h-screen antialiased">
        <AuthHydrator />
        {children}
      </body>
    </html>
  );
}
