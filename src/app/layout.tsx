import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family Tree — Build & Share Your Family Story",
  description: "Interactive family tree builder with photos, timeline events, real-time collaboration, PNG/PDF export. Powered by Next.js + Supabase.",
  keywords: ["Family Tree", "Genealogy", "Next.js", "Supabase", "Family History"],
  authors: [{ name: "Family Tree App" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Family Tree",
    description: "Build, visualize, and share your family's story.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Family Tree",
    description: "Build, visualize, and share your family's story.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
