import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ClientLayout } from "./components/ClientLayout";

const SITE_URL = "https://getjudgedbyai.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI Debate Judge | Many models. One clear verdict.",
    template: "%s | AI Debate Judge",
  },
  description: "Upload a debate transcript, and multiple LLMs will independently score both sides. See the verdict and reasoning in seconds.",
  keywords: ["AI", "debate", "judge", "LLM", "GPT", "Claude", "Gemini", "analysis", "verdict"],
  authors: [{ name: "AI Debate Judge" }],
  creator: "AI Debate Judge",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "AI Debate Judge",
    title: "AI Debate Judge | Many models. One clear verdict.",
    description: "Upload a debate transcript, and multiple LLMs will independently score both sides. See the verdict and reasoning in seconds.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI Debate Judge - Many models. One clear verdict.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Debate Judge | Many models. One clear verdict.",
    description: "Upload a debate transcript, and multiple LLMs will independently score both sides. See the verdict and reasoning in seconds.",
    images: ["/og-image.png"],
    creator: "@getjudgedbyai",
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
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          <ClientLayout>{children}</ClientLayout>
        </body>
      </html>
    </ClerkProvider>
  );
}
