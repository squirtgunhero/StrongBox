import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ServiceWorkerRegistration } from "@/components/providers/ServiceWorker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StrongBox — Real Estate Lending Platform",
  description:
    "Multi-user real estate lending platform for loan origination, execution, and servicing.",
  manifest: "/manifest.json",
  themeColor: "#C33732",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StrongBox",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          <ServiceWorkerRegistration />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
