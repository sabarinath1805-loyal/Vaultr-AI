import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EB_Garamond, Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vaultr",
  description: "Local-first AI legal assistant. Your documents never leave your device.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${ebGaramond.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
