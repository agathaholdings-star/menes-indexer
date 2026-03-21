import React from "react"
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const GTM_ID = 'GTM-5Q9GX6S4'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://menes-skr.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'メンズエステの口コミならメンエスSKR',
    template: '%s - メンエスSKR',
  },
  description: 'メンズエステの口コミならメンエスSKR。エリア、タイプ、スタイルで理想のセラピストを発見。',
  keywords: ['メンズエステ', '口コミ', 'メンエス', 'セラピスト', 'レビュー', '体験談', 'メンエスSKR'],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'メンエスSKR',
    title: 'メンズエステの口コミならメンエスSKR',
    description: 'メンズエステの口コミならメンエスSKR。エリア、タイプ、スタイルで理想のセラピストを発見。',
    url: siteUrl,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'メンエスSKR' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'メンエスSKR',
    description: 'メンズエステの口コミならメンエスSKR',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://menes-skr.com/',
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
      <Script id="gtm" strategy="afterInteractive">{`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');
      `}</Script>
      <body className={`font-sans antialiased`}>
        <noscript>
          <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{display:'none',visibility:'hidden'}} />
        </noscript>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
