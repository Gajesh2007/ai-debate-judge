import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Debate Judge | Many models. One clear verdict.",
  description: "Upload a debate transcript, and multiple LLMs will independently score both sides. See the verdict and reasoning in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
