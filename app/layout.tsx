import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balloon Base — The All-in-One Platform for Balloon Businesses",
  description:
    "Quote builder, tiered pricing, AI estimator, Stripe payments, CRM, inventory and more — everything balloon business owners need.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
