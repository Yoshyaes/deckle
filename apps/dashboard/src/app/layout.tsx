import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: 'DocuForge Dashboard',
  description: 'Manage your PDF generation API',
};

const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DOCUFORGE_DEV_BYPASS === 'true';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (DEV_MODE) {
    return (
      <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
        <body className="font-sans antialiased">
          {children}
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorBackground: '#111113',
          colorText: '#FAFAFA',
          colorPrimary: '#F97316',
          colorTextSecondary: '#A1A1AA',
        },
        elements: {
          userButtonPopoverCard: {
            backgroundColor: '#1a1a1d',
            borderColor: '#333',
          },
          userButtonPopoverActionButton: {
            color: '#FAFAFA',
          },
          userButtonPopoverActionButtonText: {
            color: '#FAFAFA',
          },
          userButtonPopoverActionButtonIcon: {
            color: '#A1A1AA',
          },
          userButtonPopoverFooter: {
            display: 'none',
          },
        },
      }}
    >
      <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
        <body className="font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
