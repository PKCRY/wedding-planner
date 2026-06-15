import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import InstallPrompt from "@/components/InstallPrompt";
import NotificationAutoPrompt from "@/components/NotificationAutoPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wedding Planner",
  description: "Our wedding planning dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon-v3.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#7a9e7e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-v3.png" />
      </head>
      <body className="min-h-full flex flex-col safe-top">
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <NotificationAutoPrompt />
        {children}
      </body>
    </html>
  );
}
