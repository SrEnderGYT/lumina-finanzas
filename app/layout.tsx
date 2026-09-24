import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lúmina — Finanzas personales",
  description: "Tus gastos de Gmail, organizados y convertidos en decisiones claras.",
  other: {
    "codex-preview": "development",
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
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
