import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { cn } from '@/presentation/lib/cn';
import { ThemeProvider, ThemeScript } from '@/presentation/providers/theme-provider';
import '@/presentation/styles/globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Omni Inbox',
  description: 'Agent inbox — รวมทุกแชทจากทุกช่องทางไว้ที่เดียว',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // data-theme/.dark ถูก ThemeScript+ThemeProvider mutate ฝั่ง client → suppressHydrationWarning
  return (
    <html
      lang="en"
      data-theme="violet"
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable, 'h-full antialiased')}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
