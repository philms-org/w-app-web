import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const montserrat = Montserrat({ 
  subsets: ["latin"],
  weight: ['300', '400', '600', '700'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The W App",
    template: "%s · The W App",
  },
  applicationName: "The W App",
  description:
    "The W App connects you with the people around you. Check in at a venue to see who's there, make connections, and join the room's live chat.",
  keywords: [
    "meet people nearby",
    "venue check-in",
    "location social app",
    "connect at events",
    "who's here",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The W App",
  },
  openGraph: {
    type: "website",
    siteName: "The W App",
    url: SITE_URL,
    title: "The W App",
    description: "Connect with people at your location.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The W App",
    description: "Connect with people at your location.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch zoom stays enabled (WCAG 1.4.4); inputs use 16px font so iOS
  // doesn't auto-zoom on focus anyway.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="font-montserrat bg-w-back-gray text-w-black antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}