import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: {
    default: "RUTA | Cebu Jeepney Navigation, Decoded",
    template: "%s | RUTA",
  },
  description:
    "RUTA helps commuters in Cebu understand jeepney codes, compare route options, and ride with more confidence.",
  applicationName: "RUTA",
  generator: "RUTA by 0xiinko",

  icons: {
    icon: [
      {
        url: "/ruta.ico",
      },
      {
        url: "/ruta-icon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/ruta.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#08141d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${spaceGrotesk.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
