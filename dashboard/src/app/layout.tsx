import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "Reels Automation",
  description: "Dashboard for turning product footage into Instagram Reels",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <MobileNav />
        <main className="p-4 sm:p-6">{children}</main>
      </body>
    </html>
  );
}
