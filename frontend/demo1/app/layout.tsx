import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://menes-indexer.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'メンズエステの口コミならメンエスSKR',
    template: '%s - メンエスSKR',
  },
  description: 'メンズエステの口コミ・体験談ならメンエスSKR。エリア・タイプ・スタイルで理想のセラピストを発見。',
  keywords: ['メンズエステ', '口コミ', 'メンエス', 'セラピスト', 'レビュー', '体験談', 'メンエスSKR'],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'メンエスSKR',
    title: 'メンズエステの口コミならメンエスSKR',
    description: 'メンズエステの口コミ・体験談ならメンエスSKR。エリア・タイプ・スタイルで理想のセラピストを発見。',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'メンエスSKR',
    description: 'メンズエステの口コミ・体験談ならメンエスSKR',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
