import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inter Migration Intelligence",
  description: "Australian migration analytics — ML + RAG platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
