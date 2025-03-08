import type React from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 overflow-hidden">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
