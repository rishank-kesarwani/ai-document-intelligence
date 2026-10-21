import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'AI Multimodal Document Intelligence | Secure Ingestion & Evidence-Linked Extraction',
  description:
    'Human-in-the-loop document intelligence platform for PDF and image ingestion, schema-constrained extraction, evidence-linked fields, validation rules, exception review, and safe natural-language queries.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
