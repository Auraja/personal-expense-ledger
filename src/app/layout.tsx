import type { Metadata } from 'next';
import { DM_Sans, Libre_Baskerville } from 'next/font/google';
import './globals.css';

const sans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const display = Libre_Baskerville({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Personal Expense Ledger',
  description: 'A private, considered record of your everyday finances.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>;
}
