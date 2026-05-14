import type { Metadata } from "next";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Vaultr",
  description: "Vaultr legal AI assistant",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased tracking-tight">
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
