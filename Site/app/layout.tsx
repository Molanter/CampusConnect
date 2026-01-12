import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { ThemeProvider } from "./theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus Connect",
  description: "Connect with your campus community.",
  manifest: "/manifest.json",
  icons: {
    icon: "https://firebasestorage.googleapis.com/v0/b/campus-vibes-e34f0.firebasestorage.app/o/config%2Fapp%2Fmac1024.png?alt=media&token=fcdcb54c-3962-4ae9-a596-f567dcdc3a47",
    apple: "https://firebasestorage.googleapis.com/v0/b/campus-vibes-e34f0.firebasestorage.app/o/config%2Fapp%2Fmac1024.png?alt=media&token=fcdcb54c-3962-4ae9-a596-f567dcdc3a47",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen overflow-hidden`}
      >
        <ThemeProvider>
          <LayoutShell>{children}</LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  );
}