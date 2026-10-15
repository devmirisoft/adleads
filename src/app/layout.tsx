import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster, TooltipProvider } from '@/modules/core/components';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AdLeads',
  description: 'WhatsApp ad leads, trials and enrollments',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
