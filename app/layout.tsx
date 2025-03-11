import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "SlipShark - AI Sports Betting Tracker & Research Assistant",
  description:
    "Smart bet tracking + AI research assistant in one simple iOS app. The ChatGPT of sports betting. Share screenshots to track bets automatically. Get personalized insights to make smarter betting decisions.",

  openGraph: {
    title:
      "SlipShark - ChatGPT for Sports Betting | Smart Bet Tracking & AI Research",
    description:
      "Transform your sports betting with AI-powered bet tracking and research. Share bet slips, get instant insights, and make data-driven decisions. The smartest betting companion for iOS.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SlipShark AI Sports Betting App",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "SlipShark - Your AI Sports Betting Assistant",
    description:
      "Smart bet tracking + AI research in one app. Automatic tracking through screenshots, personalized insights, and data-driven recommendations for smarter betting.",
    images: ["/og-image.png"],
  },
};

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
