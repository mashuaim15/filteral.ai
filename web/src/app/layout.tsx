import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-logo",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Filteral - Your Personal AI Information Filter",
  description:
    "Your personal AI-powered information filter. Connect Bilibili, YouTube, Reddit, and X to get daily curated content recommendations tailored to your interests.",
  keywords: [
    "AI recommendations",
    "content curation",
    "Bilibili",
    "YouTube",
    "Reddit",
    "personalized content",
    "daily digest",
  ],
  authors: [{ name: "Filteral" }],
  creator: "Filteral",
  metadataBase: new URL("https://filteral.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://filteral.app",
    siteName: "Filteral",
    title: "Filteral - Your Personal AI Information Filter",
    description:
      "Connect your favorite platforms and let AI filter the noise. Get daily personalized content recommendations.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Filteral - Your Personal AI Information Filter",
    description:
      "Connect your favorite platforms and let AI filter the noise. Get daily personalized content recommendations.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${sora.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
