import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import NavWrapper from "@/components/layout/NavWrapper";
import { Toaster } from "sonner";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vouchit — Secure P2P Wagering",
  description: "The trust layer for social bets. Funds locked in escrow. Winner gets paid.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vouchit",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d9488",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
        {/* Global nav conditionally rendered */}
        <NavWrapper />

        {/* Page content — offset for fixed desktop top nav + mobile bottom nav */}
        <div className="flex-1 w-full flex flex-col pb-[68px] md:pb-0 md:pt-[65px]">
          {children}
        </div>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
