import React from 'react';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'Tidewave Ops Console',
  description: 'Internal operations management for Tidewave Music',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
