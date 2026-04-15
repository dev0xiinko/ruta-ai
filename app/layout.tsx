import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: 'RUTA - Navigate Cebu Jeepneys with AI',
    template: '%s | RUTA',
  },
  description:
    'RUTA helps you navigate Cebu’s jeepney system with ease — find routes, transfers, and travel smarter.',
  
  applicationName: 'RUTA',
  generator: 'RUTA by 0xiinko',

  icons: {
    icon: [
      {
        url: '/ruta.ico', // 🔥 PRIMARY favicon
      },
      {
        url: '/ruta-icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/ruta.ico',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}