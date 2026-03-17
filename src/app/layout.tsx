import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orhan Karaköprü | AI Product Manager",
  description: "AI Product Manager Orhan Karaköprü'nün dijital ikizi. Kariyer, ürün yönetimi ve yapay zeka hakkında konuş.",
  openGraph: {
    title: "Orhan Karaköprü | Dijital İkiz",
    description: "AI Product Manager Orhan Karaköprü'nün dijital ikizi. Kariyer, ürün yönetimi ve yapay zeka hakkında sorularını yanıtlıyor.",
    url: "https://orhankarakopru.com.tr",
    siteName: "OrhanGPT",
    images: [{ url: "https://orhankarakopru.com.tr/avatar.jpg", width: 800, height: 800, alt: "Orhan Karaköprü" }],
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orhan Karaköprü | Dijital İkiz",
    description: "AI Product Manager Orhan Karaköprü'nün dijital ikizi. Sorularını yanıtlıyor.",
    images: ["https://orhankarakopru.com.tr/avatar.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
