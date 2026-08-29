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
  metadataBase: new URL("https://maximehp.com"),
  title: "Maxime Hendryx-Parker | CTSG",
  description:
    "Maxime Hendryx-Parker for Cornell Tech Student Government Technical Co-President.",
  alternates: {
    canonical: "/ctsg/",
  },
  openGraph: {
    type: "website",
    url: "/ctsg/",
    title: "Maxime Hendryx-Parker | CTSG",
    description:
      "Maxime Hendryx-Parker for Cornell Tech Student Government Technical Co-President.",
    images: [
      {
        url: "/ctsg/maxime-headshot.png",
        width: 800,
        height: 800,
        alt: "Maxime Hendryx-Parker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maxime Hendryx-Parker | CTSG",
    description:
      "Maxime Hendryx-Parker for Cornell Tech Student Government Technical Co-President.",
    images: ["/ctsg/maxime-headshot.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
