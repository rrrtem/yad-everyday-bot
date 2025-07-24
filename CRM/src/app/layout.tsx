import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM',
  description: 'CRM система',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
} 